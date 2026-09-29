import { expect, it } from "vitest";
import { orderedTimeline, evidenceForPoint } from "../src/investigationData";
import type { RecordRow } from "../src/domain";
const row = (id:string, kind:string, data:object, parent_id="case-a", archived=false) => ({id, kind, parent_id, archived, data:{title:id,...data}} as RecordRow);
it("orders actual instants across timezone offsets and excludes other cases and archived points", () => {
 const early=row("a","timeline",{occurred_at:"2026-09-29T09:00:00+07:00"});
 const late=row("b","timeline",{occurred_at:"2026-09-29T03:00:00Z"});
 expect(orderedTimeline([late, row("x","timeline",early.data,"case-b"), row("gone","timeline",early.data,"case-a",true), early],"case-a").map(r=>r.id)).toEqual(["a","b"]);
});
it("keeps evidence scoped to its case and explicit observation when a camera is revisited", () => {
 const point=row("point-a","timeline",{camera_id:"cam"});
 const evidence=[row("direct","evidence",{timeline_id:"point-a",camera_id:"cam"}),row("camera","evidence",{camera_id:"cam"}),row("other-visit","evidence",{timeline_id:"point-b",camera_id:"cam"}),row("other-case","evidence",{camera_id:"cam"},"case-b")];
 expect(evidenceForPoint(evidence,point).map(r=>r.id)).toEqual(["direct","camera"]);
 expect(evidenceForPoint(evidence,row("no-camera","timeline",{}))).toEqual([]);
});
