import { expect, it } from "vitest";
import { displayCode, groupCameraSites, type RecordRow } from "../src/domain";
const camera = (id: string, lat: unknown, lng: unknown, org_id = "a") => ({ id, kind: "camera", org_id, data: { title: id, lat, lng } }) as RecordRow;
it("keeps every UID at identical coordinates without merging nearby sites or organizations", () => {
 const rows = [camera("one", 6.4, 101.8), camera("two", "6.400", "101.800"), camera("near", 6.40001, 101.8), camera("other-org", 6.4, 101.8, "b")];
 expect(groupCameraSites(rows).map(g => g.map(r => r.id))).toEqual([["one", "two"], ["near"], ["other-org"]]);
});
it("does not group records with missing coordinates", () => {
 expect(groupCameraSites([camera("one", "", ""), camera("two", undefined, undefined)]).length).toBe(2);
});

it("shows real UIDs, hides import references, and preserves non-camera codes", () => {
 const r = camera("one", 6.4, 101.8);
 r.data.code = "CSV-DUP-1234567890abcdef-2";
 expect(displayCode(r)).toBe("");
 r.data.source_uid = "SSAT-123";
 expect(displayCode(r)).toBe("SSAT-123");
 r.data.source_uid = "-";
 r.data.code = "CAM-101";
 expect(displayCode(r)).toBe("CAM-101");
 r.kind = "case";
 r.data.code = "CASE-101";
 expect(displayCode(r)).toBe("CASE-101");
});

