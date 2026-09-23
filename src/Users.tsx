import { useEffect, useState } from "react";
import { supabase, demo, useStore } from "./context";
import { type Profile, type Role } from "./domain";
export default function Users() {
  const { profile } = useStore();
  const [users, setUsers] = useState<Profile[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [id, setId] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState<Role>("viewer");
  async function load() {
    if (demo) {
      setUsers([profile!]);
      return;
    }
    const { data, error: e } = await supabase!.from("cc_profiles").select("*");
    if (e) setError(e.message);
    else setUsers(data);
  }
  useEffect(() => {
    void load();
  }, []);
  async function update(
    target: string,
    display: string,
    r: Role,
    active: boolean,
  ) {
    setBusy(true);
    setError("");
    try {
      if (demo) throw new Error("โหมดสาธิตไม่เปลี่ยนสิทธิ์บัญชีจริง");
      const { error: e } = await supabase!.rpc("cc_manage_member", {
        p_id: target,
        p_name: display,
        p_role: r,
        p_active: active,
      });
      if (e) throw e;
      await load();
      setId("");
      setName("");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel user-panel">
      <h2>สมาชิกและสิทธิ์ในหน่วยงาน</h2>
      <p className="muted">
        Administrator จัดการทะเบียนกล้องและสมาชิก · Supervisor / Operator
        จัดการงานและแฟ้ม · Viewer อ่านอย่างเดียว
      </p>
      {error && <p className="error">{error}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>สิทธิ์</th>
              <th>สถานะ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.display_name}</td>
                <td>
                  {profile!.role === "administrator" && u.id !== profile!.id ? (
                    <select
                      aria-label={`สิทธิ์ ${u.display_name}`}
                      disabled={busy}
                      value={u.role}
                      onChange={(e) =>
                        void update(
                          u.id,
                          u.display_name,
                          e.target.value as Role,
                          u.active,
                        )
                      }
                    >
                      {[
                        "administrator",
                        "supervisor",
                        "operator",
                        "viewer",
                      ].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    u.role
                  )}
                </td>
                <td>{u.active ? "ใช้งาน" : "ระงับ"}</td>
                <td>
                  {profile!.role === "administrator" &&
                    u.id !== profile!.id && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void update(u.id, u.display_name, u.role, !u.active)
                        }
                      >
                        {u.active ? "ระงับสิทธิ์" : "เปิดสิทธิ์"}
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {profile!.role === "administrator" && (
        <form
          className="member-form"
          onSubmit={(e) => {
            e.preventDefault();
            void update(id, name, role, true);
          }}
        >
          <h3>เพิ่มบัญชีที่มีอยู่ใน Supabase Auth</h3>
          <p className="muted">
            สร้างบัญชีใน Supabase Auth ก่อน แล้วนำ User UUID มากำหนดสิทธิ์ที่นี่
          </p>
          <div className="form-grid">
            <label>
              User UUID
              <input
                required
                pattern="[0-9a-fA-F-]{36}"
                value={id}
                onChange={(e) => setId(e.target.value)}
              />
            </label>
            <label>
              ชื่อผู้ใช้งาน
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              สิทธิ์
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {["viewer", "operator", "supervisor", "administrator"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <button className="button primary" disabled={busy || demo}>
            เพิ่มสมาชิก
          </button>
        </form>
      )}
    </section>
  );
}
