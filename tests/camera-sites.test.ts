import { expect, it } from "vitest";
import { groupCameraSites, type RecordRow } from "../src/domain";
const camera = (id: string, lat: unknown, lng: unknown, org_id = "a") => ({ id, kind: "camera", org_id, data: { title: id, lat, lng } }) as RecordRow;
it("keeps every UID at identical coordinates without merging nearby sites or organizations", () => {
 const rows = [camera("one", 6.4, 101.8), camera("two", "6.400", "101.800"), camera("near", 6.40001, 101.8), camera("other-org", 6.4, 101.8, "b")];
 expect(groupCameraSites(rows).map(g => g.map(r => r.id))).toEqual([["one", "two"], ["near"], ["other-org"]]);
});
it("does not group records with missing coordinates", () => {
 expect(groupCameraSites([camera("one", "", ""), camera("two", undefined, undefined)]).length).toBe(2);
});
