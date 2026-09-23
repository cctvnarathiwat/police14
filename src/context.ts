import { createContext, useContext } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import type { RecordRow, Profile, Audit, Kind, Data } from "./domain";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const demo = import.meta.env.VITE_DEMO_MODE === "true";
export const supabase = !demo && url && key ? createClient(url, key) : null;
export interface State {
  rows: RecordRow[];
  audit: Audit[];
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  save: (
    kind: Kind,
    data: Data,
    existing?: RecordRow,
    parent?: string | null,
  ) => Promise<RecordRow>;
  archive: (r: RecordRow) => Promise<void>;
  upload: (
    file: File,
    parent: string,
  ) => Promise<{ path: string; sha256: string }>;
  fileUrl: (path: string) => Promise<string>;
  log: (action: string, id?: string) => Promise<void>;
}
export const StoreContext = createContext<State | null>(null);
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("Store provider unavailable");
  return value;
}
