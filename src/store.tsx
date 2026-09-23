import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { StoreContext as Context, supabase, demo } from "./context";
import {
  canWrite,
  validateData,
  type RecordRow,
  type Profile,
  type Audit,
  type Kind,
  type Data,
} from "./domain";
import { makeDemo, DEMO_ORG } from "./demo";

const CACHE = "police14.demo.v1";
async function blobStore<T>(
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("police14-demo-files", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction("files", "readwrite");
      const req = run(tx.objectStore("files"));
      tx.oncomplete = () => {
        resolve(req.result);
        db.close();
      };
      tx.onerror = () => {
        reject(tx.error);
        db.close();
      };
    };
  });
}
export function Provider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<RecordRow[]>([]),
    [audit, setAudit] = useState<Audit[]>([]),
    [profile, setProfile] = useState<Profile | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refreshVersion = useRef(0);
  async function refresh() {
    const version = ++refreshVersion.current;
    setError("");
    try {
      if (demo) {
        const stored = localStorage.getItem(CACHE);
        const data = stored
          ? JSON.parse(stored)
          : { rows: makeDemo(), audit: [] };
        if (!stored) localStorage.setItem(CACHE, JSON.stringify(data));
        setRows(data.rows);
        setAudit(data.audit);
        setProfile({
          id: "00000000-0000-4000-8000-000000000002",
          org_id: DEMO_ORG,
          display_name: "เจ้าหน้าที่สาธิต",
          role: "administrator",
          active: true,
        });
        return;
      }
      if (!supabase) return;
      const {
        data: { session: ses },
        error: authError,
      } = await supabase.auth.getSession();
      if (version !== refreshVersion.current) return;
      if (authError) throw authError;
      setSession(ses);
      if (!ses) {
        setProfile(null);
        setRows([]);
        setAudit([]);
        return;
      }
      const { data: p, error: pe } = await supabase
        .from("cc_profiles")
        .select("*")
        .eq("id", ses.user.id)
        .single();
      if (version !== refreshVersion.current) return;
      if (pe)
        throw new Error(
          "บัญชีนี้ยังไม่มีสิทธิ์ในศูนย์ กรุณาให้ผู้ดูแลเพิ่มสมาชิก",
        );
      if (!p.active) throw new Error("บัญชีถูกระงับ");
      const all: RecordRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error: e } = await supabase
          .from("cc_records")
          .select("*")
          .eq("org_id", p.org_id)
          .eq("archived", false)
          .order("id")
          .range(from, from + 999);
        if (version !== refreshVersion.current) return;
        if (e) throw e;
        all.push(...data);
        if (data.length < 1000) break;
      }
      const { data: logs, error: le } = await supabase
        .from("cc_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (version !== refreshVersion.current) return;
      if (le) throw le;
      setProfile(p);
      setRows(all);
      setAudit(logs);
    } catch (e) {
      if (version !== refreshVersion.current) return;
      if (!demo) {
        setProfile(null);
        setRows([]);
        setAudit([]);
      }
      setError(
        e instanceof Error
          ? e.message
          : String((e as { message?: string })?.message ?? e),
      );
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    if (!demo && supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          refreshVersion.current++;
          setProfile(null);
          setSession(null);
          setRows([]);
          setAudit([]);
        }
        setTimeout(() => void refresh(), 0);
      });
      return () => subscription.unsubscribe();
    }
  }, []);
  function commitDemo(next: RecordRow[], logs: Audit[]) {
    localStorage.setItem(CACHE, JSON.stringify({ rows: next, audit: logs }));
    setRows(next);
    setAudit(logs);
  }
  function auditEntry(action: string, id?: string): Audit {
    return {
      id: crypto.randomUUID(),
      record_id: id ?? null,
      action,
      actor_id: profile!.id,
      created_at: new Date().toISOString(),
      details: {},
    };
  }
  async function log(action: string, id?: string) {
    if (!profile) throw new Error("กรุณาเข้าสู่ระบบ");
    if (demo) {
      commitDemo(rows, [auditEntry(action, id), ...audit]);
      return;
    }
    const { error: e } = await supabase!.rpc("cc_log_access", {
      p_action: action,
      p_record: id ?? null,
    });
    if (e) throw e;
  }
  async function save(
    kind: Kind,
    data: Data,
    existing?: RecordRow,
    parent?: string | null,
  ) {
    if (!profile || !canWrite(profile.role, kind))
      throw new Error("ไม่มีสิทธิ์แก้ไขข้อมูลนี้");
    validateData(kind, data);
    const now = new Date().toISOString();
    const row: RecordRow = {
      id: existing?.id ?? crypto.randomUUID(),
      org_id: profile.org_id,
      kind,
      data,
      parent_id: parent ?? existing?.parent_id ?? null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      created_by: existing?.created_by ?? profile.id,
      archived: false,
    };
    if (demo) {
      if (
        rows.some(
          (r) =>
            r.id !== row.id && r.kind === kind && r.data.code === data.code,
        )
      )
        throw new Error("รหัสนี้มีอยู่แล้ว");
      commitDemo(
        existing
          ? rows.map((r) => (r.id === row.id ? row : r))
          : [...rows, row],
        [auditEntry(existing ? "UPDATE" : "INSERT", row.id), ...audit],
      );
      return row;
    }
    const q = existing
      ? supabase!
          .from("cc_records")
          .update({ data, parent_id: row.parent_id })
          .eq("id", row.id)
          .eq("updated_at", existing.updated_at)
      : supabase!.from("cc_records").insert(row);
    const { data: saved, error: e } = await q.select().single();
    if (e)
      throw new Error(
        e.code === "PGRST116"
          ? "ข้อมูลเปลี่ยนโดยผู้ใช้อื่น กรุณารีเฟรชก่อนแก้ไข"
          : e.message,
      );
    setRows((prev) =>
      existing
        ? prev.map((r) => (r.id === saved.id ? saved : r))
        : [...prev, saved],
    );
    return saved as RecordRow;
  }
  async function archive(r: RecordRow) {
    if (!profile || !canWrite(profile.role, r.kind))
      throw new Error("ไม่มีสิทธิ์");
    if (
      rows.some(
        (child) =>
          child.parent_id === r.id ||
          ["camera_id", "incident_id"].some((k) => child.data[k] === r.id),
      )
    )
      throw new Error(
        "รายการนี้ยังมีข้อมูลอ้างอิง กรุณาปิดสถานะแทนการเก็บเข้าคลัง",
      );
    if (demo) {
      commitDemo(
        rows.filter((x) => x.id !== r.id),
        [auditEntry("ARCHIVE", r.id), ...audit],
      );
      return;
    }
    const { data, error: e } = await supabase!
      .from("cc_records")
      .update({ archived: true })
      .eq("id", r.id)
      .eq("updated_at", r.updated_at)
      .select("id");
    if (e) throw e;
    if (!data.length) throw new Error("ข้อมูลเปลี่ยน กรุณารีเฟรช");
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  }
  async function upload(file: File, parent: string) {
    if (!profile || profile.role === "viewer")
      throw new Error("ไม่มีสิทธิ์อัปโหลด");
    if (file.size > 50 * 1024 * 1024) throw new Error("ไฟล์ต้องไม่เกิน 50 MB");
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "application/pdf": "pdf",
    };
    if (!extensions[file.type])
      throw new Error("รองรับ JPG, PNG, WebP, MP4, WebM และ PDF");
    const hash = await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );
    const sha256 = Array.from(new Uint8Array(hash))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const path = `${profile.org_id}/${parent}/${crypto.randomUUID()}.${extensions[file.type]}`;
    if (demo) await blobStore((s) => s.put(file, path));
    else {
      const { error: e } = await supabase!.storage
        .from("cc-evidence")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (e) throw e;
    }
    return { path, sha256 };
  }
  async function fileUrl(path: string) {
    if (demo) {
      const blob = await blobStore((s) => s.get(path));
      if (!blob) throw new Error("ไม่พบไฟล์ในเครื่องนี้");
      return URL.createObjectURL(blob);
    }
    const { data, error: e } = await supabase!.storage
      .from("cc-evidence")
      .createSignedUrl(path, 300);
    if (e) throw e;
    return data.signedUrl;
  }
  return (
    <Context.Provider
      value={{
        rows,
        audit,
        profile,
        session,
        loading,
        error,
        refresh,
        save,
        archive,
        upload,
        fileUrl,
        log,
      }}
    >
      {children}
    </Context.Provider>
  );
}
