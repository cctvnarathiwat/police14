import { s, type RecordRow } from "./domain";

export function orderedTimeline(rows: RecordRow[], caseId: string) {
  return rows
    .filter(
      (r) => !r.archived && r.kind === "timeline" && r.parent_id === caseId,
    )
    .sort(
      (a, b) =>
        Date.parse(s(a, "occurred_at")) - Date.parse(s(b, "occurred_at")) ||
        a.id.localeCompare(b.id),
    );
}

export function evidenceForPoint(rows: RecordRow[], point: RecordRow) {
  return rows.filter(
    (e) =>
      !e.archived &&
      e.kind === "evidence" &&
      e.parent_id === point.parent_id &&
      (e.data.timeline_id
        ? e.data.timeline_id === point.id
        : !!point.data.camera_id && e.data.camera_id === point.data.camera_id),
  );
}
