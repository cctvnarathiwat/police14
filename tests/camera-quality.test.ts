import { expect, it } from "vitest";
import { inspectCameras } from "../src/cameraQuality";
import type { RecordRow } from "../src/domain";
it("counts coordinates separately, detects UID issues and keeps every row", () => {
 const make = (id: string, data: object, org_id = "a") => ({id,org_id,kind:"camera",archived:false,data:{title:"camera",lat:6,lng:101,...data}}) as RecordRow;
 const rows = [make("1",{code:"CSV-1234567890abcdef",source_uid:"-"}),make("2",{code:"UID-1"}),make("3",{code:"UID-1",lat:7}),make("4",{code:"UID-1"},"b"),make("5",{code:"UID-5",lat:"",area:"bad\uFFFD"})];
 const result = inspectCameras(rows);
 expect(result.sites).toHaveLength(3);
 expect([...result.missing]).toEqual(["1"]);
 expect([...result.duplicate]).toEqual(["2","3"]);
 expect([...result.differentSites]).toEqual(["2","3"]);
 expect([...result.coordinates]).toEqual(["5"]);
 expect([...result.text]).toEqual(["5"]);
 expect(rows).toHaveLength(5);
});
