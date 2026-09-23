-- CCTV Command Center. Apply once to the named Supabase project after review.
-- No operational or demo data is inserted by this migration.
begin;
create schema if not exists cc_private;
revoke all on schema cc_private from public, anon;
grant usage on schema cc_private to authenticated;

create table public.cc_organizations (
 id uuid primary key default gen_random_uuid(), name text not null
);
create table public.cc_profiles (
 id uuid primary key references auth.users(id),
 org_id uuid not null references public.cc_organizations(id),
 display_name text not null check(length(trim(display_name)) between 1 and 200),
 role text not null check(role in ('administrator','supervisor','operator','viewer')),
 active boolean not null default true
);
create index cc_profiles_org on public.cc_profiles(org_id);
create table public.cc_records (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.cc_organizations(id),
 kind text not null check(kind in ('camera','incident','job','vehicle','sighting','case','timeline','evidence','route')),
 parent_id uuid references public.cc_records(id),
 data jsonb not null check(jsonb_typeof(data)='object'),
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 archived boolean not null default false,
 check (length(trim(data->>'title')) between 1 and 300 and data ? 'title'),
 check (length(trim(data->>'code')) between 1 and 100 and data ? 'code'),
 check (data ? 'status')
);
create unique index cc_records_code on public.cc_records(org_id,kind,(data->>'code'));
create index cc_records_org_kind on public.cc_records(org_id,kind) where not archived;
create index cc_records_parent on public.cc_records(parent_id);
create index cc_records_creator on public.cc_records(created_by);
create index cc_records_camera on public.cc_records((data->>'camera_id'));
create index cc_records_incident on public.cc_records((data->>'incident_id'));
create table public.cc_audit (
 id uuid primary key default gen_random_uuid(),org_id uuid not null references public.cc_organizations(id),
 record_id uuid, actor_id uuid references auth.users(id),action text not null,
 created_at timestamptz not null default now(),details jsonb not null default '{}'
);
create index cc_audit_org_time on public.cc_audit(org_id,created_at desc);
create index cc_audit_actor on public.cc_audit(actor_id);

-- Trusted membership is read from a protected table, never user_metadata or JWT roles.
-- Definer helpers live outside the API schema and fail closed without auth.uid().
create function cc_private.org_id() returns uuid language sql stable security definer set search_path='' as $$
 select org_id from public.cc_profiles where id=(select auth.uid()) and auth.uid() is not null and active
$$;
create function cc_private.role() returns text language sql stable security definer set search_path='' as $$
 select role from public.cc_profiles where id=(select auth.uid()) and auth.uid() is not null and active
$$;
revoke all on function cc_private.org_id(),cc_private.role() from public,anon;
grant execute on function cc_private.org_id(),cc_private.role() to authenticated;

alter table public.cc_organizations enable row level security;
alter table public.cc_profiles enable row level security;
alter table public.cc_records enable row level security;
alter table public.cc_audit enable row level security;
revoke all on public.cc_organizations,public.cc_profiles,public.cc_records,public.cc_audit from anon,authenticated;
grant select on public.cc_organizations,public.cc_profiles,public.cc_records,public.cc_audit to authenticated;
grant insert on public.cc_records to authenticated;
grant update(data,parent_id,archived) on public.cc_records to authenticated;
create policy organization_read on public.cc_organizations for select to authenticated using(id=(select cc_private.org_id()));
create policy profile_read on public.cc_profiles for select to authenticated using(org_id=(select cc_private.org_id()));
create policy record_read on public.cc_records for select to authenticated using(org_id=(select cc_private.org_id()));
create policy record_insert on public.cc_records for insert to authenticated with check(
 org_id=(select cc_private.org_id()) and created_by=(select auth.uid()) and not archived
 and (select cc_private.role()) in ('administrator','supervisor','operator')
 and (kind<>'camera' or (select cc_private.role())='administrator')
);
create policy record_update on public.cc_records for update to authenticated using(
 org_id=(select cc_private.org_id()) and (select cc_private.role()) in ('administrator','supervisor','operator')
 and (kind<>'camera' or (select cc_private.role())='administrator')
) with check(
 org_id=(select cc_private.org_id()) and (select cc_private.role()) in ('administrator','supervisor','operator')
 and (kind<>'camera' or (select cc_private.role())='administrator')
);
create policy audit_read on public.cc_audit for select to authenticated using(org_id=(select cc_private.org_id()));

create function cc_private.validate_record() returns trigger language plpgsql security invoker set search_path='' as $$
declare allowed text[]; parent_kind text; ref_id text; expected text; refkey text; route_point jsonb;
begin
 if tg_op='UPDATE' then
  if new.org_id<>old.org_id or new.kind<>old.kind or new.id<>old.id or new.created_by is distinct from old.created_by then raise exception 'Record identity cannot change'; end if;
  if new.kind='evidence' and (new.data->>'file_path' is distinct from old.data->>'file_path' or new.data->>'sha256' is distinct from old.data->>'sha256') then raise exception 'Original evidence file and hash are immutable'; end if;
  if new.archived and not old.archived and exists(select 1 from public.cc_records r where not r.archived and (r.parent_id=new.id or r.data->>'camera_id'=new.id::text or r.data->>'incident_id'=new.id::text)) then raise exception 'Record has active references; close its status instead'; end if;
  new.created_at=old.created_at;
 else new.created_at=now(); new.created_by=auth.uid(); end if;
 new.updated_at=clock_timestamp();
 allowed=case new.kind
 when 'camera' then array['online','offline','maintenance'] when 'incident' then array['open','investigating','in_progress','closed']
 when 'job' then array['open','assigned','in_progress','review','completed'] when 'vehicle' then array['active','closed']
 when 'case' then array['open','investigating','waiting','review','closed'] when 'route' then array['draft','review']
 else array['unverified','confirmed'] end;
 if new.data->>'status' is null or not(new.data->>'status'=any(allowed)) then raise exception 'Invalid status for record type'; end if;
 if new.kind in ('camera','incident','timeline','sighting') then
  if not(new.data ? 'lat' and new.data ? 'lng') or new.data->>'lat' is null or new.data->>'lng' is null then raise exception 'Coordinates required'; end if;
  if not ((new.data->>'lat')::numeric between -90 and 90) or not ((new.data->>'lng')::numeric between -180 and 180) then raise exception 'Coordinates out of range'; end if;
 end if;
 if new.kind in ('incident','case','timeline','sighting','evidence') then
  if coalesce(new.data->>'occurred_at','')='' then raise exception 'Timestamp required'; end if;
  perform (new.data->>'occurred_at')::timestamptz;
 end if;
 if new.kind='timeline' and length(trim(coalesce(new.data->>'observation','')))=0 then raise exception 'Observation required'; end if;
 if new.kind in ('timeline','evidence','sighting') and new.parent_id is null then raise exception 'Parent required'; end if;
 if new.parent_id is not null then
  select kind into parent_kind from public.cc_records where id=new.parent_id and org_id=new.org_id and not archived;
  if parent_kind is null then raise exception 'Parent is unavailable'; end if;
  if (new.kind='timeline' and parent_kind<>'case') or (new.kind='sighting' and parent_kind<>'vehicle') or (new.kind='evidence' and parent_kind not in ('case','incident','job')) then raise exception 'Invalid parent type'; end if;
 end if;
 foreach refkey in array array['camera_id','incident_id'] loop
  ref_id=nullif(new.data->>refkey,''); expected=case refkey when 'camera_id' then 'camera' else 'incident' end;
  if ref_id is not null and not exists(select 1 from public.cc_records where id=ref_id::uuid and org_id=new.org_id and kind=expected and not archived) then raise exception 'Invalid % reference',refkey; end if;
 end loop;
 if new.kind='job' and coalesce(new.data->>'camera_id','')='' then raise exception 'Camera required'; end if;
 if new.kind='evidence' then
  if coalesce(new.data->>'file_path','') not like new.org_id::text||'/'||new.parent_id::text||'/%' then raise exception 'Invalid evidence path'; end if;
  if coalesce(new.data->>'sha256','') !~ '^[a-f0-9]{64}$' then raise exception 'SHA256 required'; end if;
 end if;
 if new.kind='route' and (jsonb_typeof(new.data->'points') is distinct from 'array' or jsonb_array_length(new.data->'points')<2) then raise exception 'Route requires at least two points'; end if;
 if new.kind='route' then
  for route_point in select value from jsonb_array_elements(new.data->'points') loop
   if jsonb_typeof(route_point)<>'array' or jsonb_array_length(route_point)<>2 or route_point->>0 is null or route_point->>1 is null or not((route_point->>0)::numeric between -90 and 90) or not((route_point->>1)::numeric between -180 and 180) then raise exception 'Invalid route coordinate'; end if;
  end loop;
  if coalesce((new.data->>'corridor')::numeric,0) not between 1 and 10000 then raise exception 'Invalid route corridor'; end if;
 end if;
 return new;
end $$;
revoke all on function cc_private.validate_record() from public,anon,authenticated;
create trigger cc_validate_record before insert or update on public.cc_records for each row execute function cc_private.validate_record();

-- Only a trigger can write mutation audit rows; users cannot forge or edit them.
create function cc_private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authenticated actor required'; end if;
 insert into public.cc_audit(org_id,record_id,actor_id,action,details) values(new.org_id,new.id,auth.uid(),case when new.archived then 'ARCHIVE' else tg_op end,jsonb_build_object('before',case when tg_op='UPDATE' then old.data else null end,'after',new.data));
 return new;
end $$;
revoke all on function cc_private.audit_record() from public,anon,authenticated;
create trigger cc_audit_record after insert or update on public.cc_records for each row execute function cc_private.audit_record();

create function cc_private.manage_member(p_id uuid,p_name text,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare org uuid=cc_private.org_id();
begin
 if auth.uid() is null or cc_private.role() is distinct from 'administrator' or org is null then raise exception 'Administrator required'; end if;
 if p_id=auth.uid() then raise exception 'Cannot change your own membership'; end if;
 if exists(select 1 from public.cc_profiles where id=p_id and org_id<>org) then raise exception 'Member belongs to another organization'; end if;
 insert into public.cc_profiles(id,org_id,display_name,role,active) values(p_id,org,p_name,p_role,p_active) on conflict(id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active;
 insert into public.cc_audit(org_id,actor_id,action,details) values(org,auth.uid(),'MANAGE_MEMBER',jsonb_build_object('member',p_id,'role',p_role,'active',p_active));
end $$;
revoke all on function cc_private.manage_member(uuid,text,text,boolean) from public,anon;
grant execute on function cc_private.manage_member(uuid,text,text,boolean) to authenticated;
create function public.cc_manage_member(p_id uuid,p_name text,p_role text,p_active boolean) returns void language sql security invoker set search_path='' as $$select cc_private.manage_member(p_id,p_name,p_role,p_active)$$;
revoke all on function public.cc_manage_member(uuid,text,text,boolean) from public,anon;
grant execute on function public.cc_manage_member(uuid,text,text,boolean) to authenticated;

create function cc_private.log_access(p_action text,p_record uuid) returns void language plpgsql security definer set search_path='' as $$
declare org uuid=cc_private.org_id();
begin
 if auth.uid() is null or org is null then raise exception 'Membership required'; end if;
 if p_action not in ('VIEW_EVIDENCE','DOWNLOAD_EVIDENCE','EXPORT_CSV','EXPORT_XLSX','EXPORT_PRINT') then raise exception 'Invalid audit action'; end if;
 if p_action like 'EXPORT_%' and cc_private.role()='viewer' then raise exception 'Export denied'; end if;
 if p_record is not null and not exists(select 1 from public.cc_records where id=p_record and org_id=org) then raise exception 'Record unavailable'; end if;
 insert into public.cc_audit(org_id,record_id,actor_id,action) values(org,p_record,auth.uid(),p_action);
end $$;
revoke all on function cc_private.log_access(text,uuid) from public,anon;
grant execute on function cc_private.log_access(text,uuid) to authenticated;
create function public.cc_log_access(p_action text,p_record uuid default null) returns void language sql security invoker set search_path='' as $$select cc_private.log_access(p_action,p_record)$$;
revoke all on function public.cc_log_access(text,uuid) from public,anon;
grant execute on function public.cc_log_access(text,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('cc-evidence','cc-evidence',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']);
create policy cc_file_read on storage.objects for select to authenticated using(
 bucket_id='cc-evidence' and (storage.foldername(name))[1]=(select cc_private.org_id())::text
);
create policy cc_file_insert on storage.objects for insert to authenticated with check(
 bucket_id='cc-evidence' and (storage.foldername(name))[1]=(select cc_private.org_id())::text
 and (select cc_private.role()) in ('administrator','supervisor','operator')
 and exists(select 1 from public.cc_records where id::text=(storage.foldername(name))[2] and org_id=(select cc_private.org_id()) and kind in ('case','incident','job') and not archived)
);
-- Evidence originals cannot be overwritten or deleted from the browser.
commit;
