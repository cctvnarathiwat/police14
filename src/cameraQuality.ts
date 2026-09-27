import { cameraSiteKey, displayCode, groupCameraSites, s, type RecordRow } from "./domain";
export function inspectCameras(rows: RecordRow[]) {
 const cameras = rows.filter(r => r.kind === "camera" && !r.archived);
 const valid = (r: RecordRow) => ["lat", "lng"].every(k => s(r,k).trim() !== "" && Number.isFinite(Number(r.data[k]))) && Math.abs(Number(r.data.lat)) <= 90 && Math.abs(Number(r.data.lng)) <= 180;
 const uidGroups = new Map<string, RecordRow[]>();
 for (const r of cameras) {
  const uid = displayCode(r).trim();
  if (!uid || uid === "-") continue;
  const key = `${r.org_id}:${uid.toUpperCase()}`;
  uidGroups.set(key, [...(uidGroups.get(key) ?? []), r]);
 }
 const repeated = [...uidGroups.values()].filter(g => g.length > 1);
 return {
  sites: groupCameraSites(cameras.filter(valid)),
  missing: new Set(cameras.filter(r => !displayCode(r).trim() || displayCode(r).trim() === "-").map(r => r.id)),
  duplicate: new Set(repeated.flatMap(g => g.map(r => r.id))),
  differentSites: new Set(repeated.filter(g => new Set(g.map(cameraSiteKey)).size > 1).flatMap(g => g.map(r => r.id))),
  coordinates: new Set(cameras.filter(r => !valid(r)).map(r => r.id)),
  text: new Set(cameras.filter(r => ["title", "area", "agency"].some(k => s(r,k).includes("\uFFFD"))).map(r => r.id)),
 };
}
