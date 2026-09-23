import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
`);
const migration = (await readdir("supabase/migrations")).find((f) =>
  f.endsWith("_command_center.sql"),
);
await db.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
const org = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const admin = "10000000-0000-4000-8000-000000000001",
  operator = "10000000-0000-4000-8000-000000000002",
  viewer = "10000000-0000-4000-8000-000000000003",
  outsider = "10000000-0000-4000-8000-000000000004";
await db.exec(
  `insert into public.cc_organizations values('${org}','A'),('${other}','B'); insert into auth.users values('${admin}'),('${operator}'),('${viewer}'),('${outsider}');insert into public.cc_profiles values('${admin}','${org}','Admin','administrator',true),('${operator}','${org}','Operator','operator',true),('${viewer}','${org}','Viewer','viewer',true),('${outsider}','${other}','Other','administrator',true);`,
);
const as = async (id, sql) => {
  await db.exec(
    `reset role;set role authenticated;set request.jwt.claim.sub='${id}';`,
  );
  return db.query(sql);
};
const fails = async (id, sql) => {
  let rejected = false;
  try {
    await as(id, sql);
  } catch {
    rejected = true;
  }
  assert.ok(rejected, `Should reject: ${sql}`);
};
const cam = "20000000-0000-4000-8000-000000000001",
  caseId = "20000000-0000-4000-8000-000000000002";
const data = JSON.stringify({
  title: "Camera",
  code: "CAM-1",
  status: "online",
  lat: 6.4,
  lng: 101.8,
});
const insert = (id, kind, payload, parent = null) =>
  `insert into public.cc_records(id,org_id,kind,data,parent_id) values('${id}','${org}','${kind}','${JSON.stringify(payload)}',${parent ? `'${parent}'` : "null"}) returning id`;
await as(
  admin,
  `insert into public.cc_records(id,org_id,kind,data) values('${cam}','${org}','camera','${data}')`,
);
await as(
  operator,
  insert(caseId, "case", {
    title: "Case",
    code: "INV-1",
    status: "open",
    occurred_at: "2026-09-23T01:00:00Z",
  }),
);
assert.equal(
  (await as(viewer, "select * from public.cc_records")).rows.length,
  2,
);
assert.equal(
  (await as(outsider, "select * from public.cc_records")).rows.length,
  0,
);
await fails(
  viewer,
  insert("20000000-0000-4000-8000-000000000003", "case", {
    title: "X",
    code: "X",
    status: "open",
    occurred_at: "2026-09-23T01:00:00Z",
  }),
);
assert.equal(
  (
    await as(
      operator,
      `update public.cc_records set data=data||'{"title":"hacked"}' where id='${cam}' returning id`,
    )
  ).rows.length,
  0,
);
await fails(
  admin,
  `update public.cc_records set org_id='${other}' where id='${cam}'`,
);
await fails(
  admin,
  insert("20000000-0000-4000-8000-000000000004", "camera", {
    title: "Bad",
    code: "BAD",
    status: "online",
    lat: 91,
    lng: 101,
  }),
);
await fails(
  operator,
  insert(
    "20000000-0000-4000-8000-000000000005",
    "timeline",
    {
      title: "Bad",
      code: "TL",
      status: "confirmed",
      lat: 6,
      lng: 101,
      occurred_at: "2026-09-23T01:00:00Z",
      observation: "Recorded",
    },
    cam,
  ),
);
await fails(
  viewer,
  `update public.cc_profiles set role='administrator' where id='${viewer}'`,
);
await fails(
  operator,
  `select public.cc_manage_member('${viewer}','Escalate','administrator',true)`,
);
await fails(
  admin,
  `select public.cc_manage_member('${outsider}','Move','operator',true)`,
);
await fails(viewer, `select public.cc_log_access('EXPORT_CSV',null)`);
await as(operator, `select public.cc_log_access('EXPORT_CSV','${caseId}')`);
await as(
  operator,
  `insert into storage.objects(bucket_id,name) values('cc-evidence','${org}/${caseId}/proof.png')`,
);
await fails(
  outsider,
  `insert into storage.objects(bucket_id,name) values('cc-evidence','${org}/${caseId}/bad.png')`,
);
await fails(
  viewer,
  `insert into storage.objects(bucket_id,name) values('cc-evidence','${org}/${caseId}/bad.png')`,
);
assert.equal(
  (await as(outsider, "select * from storage.objects")).rows.length,
  0,
);
assert.equal(
  (await as(operator, "delete from storage.objects returning id")).rows.length,
  0,
);
assert.equal(
  (await as(operator, `update storage.objects set name='bad' returning id`))
    .rows.length,
  0,
);
await fails(admin, `delete from public.cc_audit`);
assert.equal((await as(admin, "select * from public.cc_audit")).rows.length, 3);
await fails(
  operator,
  insert("20000000-0000-4000-8000-000000000006", "route", {
    title: "Invalid route",
    code: "BAD-ROUTE",
    status: "draft",
    points: [
      [99, 101],
      [6, 102],
    ],
    corridor: 100,
  }),
);
await as(
  operator,
  insert(
    "20000000-0000-4000-8000-000000000007",
    "evidence",
    {
      title: "Evidence",
      code: "EVD-1",
      status: "unverified",
      occurred_at: "2026-09-23T01:00:00Z",
      file_path: `${org}/${caseId}/proof.png`,
      sha256: "a".repeat(64),
    },
    caseId,
  ),
);
await fails(
  operator,
  `update public.cc_records set data=data||'{"sha256":"${"b".repeat(64)}"}' where id='20000000-0000-4000-8000-000000000007'`,
);
await fails(
  admin,
  `update public.cc_records set archived=true where id='${caseId}'`,
);
await as(
  admin,
  `select public.cc_manage_member('${operator}','Operator','operator',false)`,
);
assert.equal(
  (await as(operator, "select * from public.cc_records")).rows.length,
  0,
);
assert.equal(
  (await as(operator, "select * from storage.objects")).rows.length,
  0,
);
await db.exec("reset role;set role anon;");
await assert.rejects(() => db.query("select * from public.cc_records"));
console.log(
  "PASS: migration, organization isolation, RBAC, protected identities, validation, audit, private storage, revoked membership, anonymous denial",
);
await db.close();
