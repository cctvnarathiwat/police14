import { s, hasPosition, position, meters, type RecordRow } from "./domain";

export function observationTime(value: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "ไม่ระบุเวลา";
  return new Date(value).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function timelineSummary(timeline: RecordRow[]) {
  const times = timeline
    .map((r) => Date.parse(s(r, "occurred_at")))
    .filter(Number.isFinite);
  let distanceMeters = 0;
  for (let i = 1; i < timeline.length; i++) {
    if (hasPosition(timeline[i - 1]) && hasPosition(timeline[i]))
      distanceMeters += meters(
        position(timeline[i - 1]),
        position(timeline[i]),
      );
  }
  return {
    durationMinutes: times.length
      ? (Math.max(...times) - Math.min(...times)) / 60000
      : null,
    distanceMeters,
  };
}

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
