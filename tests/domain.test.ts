import { describe, it, expect } from "vitest";
import {
  meters,
  routeDistance,
  inside,
  canWrite,
  validateData,
  csvCell,
} from "../src/domain";
describe("geospatial search", () => {
  it("uses geodesic meters and zero distance for same point", () => {
    expect(meters([0, 0], [0, 0])).toBe(0);
    expect(meters([0, 0], [0, 0.001])).toBeCloseTo(111.195, 1);
  });
  it("finds corridor distance and preserves order along a route", () => {
    const a = routeDistance(
        [0, 0.002],
        [
          [0, 0],
          [0, 0.01],
        ],
      ),
      b = routeDistance(
        [0, 0.008],
        [
          [0, 0],
          [0, 0.01],
        ],
      );
    expect(a.distance).toBeCloseTo(0, 2);
    expect(a.along).toBeLessThan(b.along);
    expect(
      routeDistance(
        [0.001, 0.005],
        [
          [0, 0],
          [0, 0.01],
        ],
      ).distance,
    ).toBeCloseTo(111.195, 1);
  });
  it("handles empty routes and polygons without false matches", () => {
    expect(routeDistance([0, 0], []).distance).toBe(Infinity);
    expect(inside([0, 0], [])).toBe(false);
    expect(
      inside(
        [0.5, 0.5],
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
        ],
      ),
    ).toBe(true);
    expect(
      inside(
        [2, 2],
        [
          [0, 0],
          [0, 1],
          [1, 1],
        ],
      ),
    ).toBe(false);
  });
});
describe("validation and permissions", () => {
  it("blocks invalid camera coordinates and statuses", () => {
    const d = {
      title: "Camera",
      code: "CAM-1",
      status: "online",
      lat: 6,
      lng: 101,
      area: "test",
    };
    expect(validateData("camera", d)).toEqual(d);
    expect(() => validateData("camera", { ...d, lat: 91 })).toThrow();
    expect(() => validateData("camera", { ...d, status: "admin" })).toThrow();
  });
  it("requires a timestamp and observation for a timeline", () => {
    expect(() =>
      validateData("timeline", {
        title: "event",
        code: "TL",
        status: "confirmed",
        lat: 6,
        lng: 101,
      }),
    ).toThrow();
  });
  it("restricts camera management to administrators and viewer writes", () => {
    expect(canWrite("operator", "camera")).toBe(false);
    expect(canWrite("administrator", "camera")).toBe(true);
    expect(canWrite("operator", "case")).toBe(true);
    expect(canWrite("viewer", "case")).toBe(false);
  });
  it("escapes CSV formulas and quotes", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("a,b")).toBe('"a,b"');
  });
});
