import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Polyline,
  Polygon,
  Tooltip,
  useMapEvents,
  useMap,
} from "react-leaflet";
import {
  CENTER,
  coverage,
  position,
  s,
  type Point,
  type RecordRow,
} from "./domain";
import { buffer, lineString } from "@turf/turf";
const color = (r: RecordRow) =>
  s(r, "status") === "offline"
    ? "#fb7185"
    : s(r, "status") === "maintenance"
      ? "#fbbf24"
      : r.kind === "incident"
        ? "#60a5fa"
        : "#35d7ac";
function Events({
  onClick,
  focus,
}: {
  onClick?: (p: Point) => void;
  focus?: Point;
}) {
  const map = useMapEvents({
    click: (e) => onClick?.([e.latlng.lat, e.latlng.lng]),
  });
  useEffect(() => {
    if (focus) map.flyTo(focus, 16, { duration: 0.6 });
  }, [focus?.[0], focus?.[1]]);
  useEffect(() => {
    const ob = new ResizeObserver(() => map.invalidateSize());
    ob.observe(map.getContainer());
    return () => ob.disconnect();
  }, [map]);
  return null;
}
function Home() {
  const map = useMap();
  return (
    <button
      className="map-home"
      onClick={() => map.setView(CENTER, 14)}
      title="กลับสู่เมืองนราธิวาส"
    >
      ⌖
    </button>
  );
}
interface Props {
  cameras: RecordRow[];
  incidents?: RecordRow[];
  onSelect?: (r: RecordRow) => void;
  onClick?: (p: Point) => void;
  center?: Point;
  radius?: number;
  multi?: boolean;
  route?: Point[];
  polygon?: Point[];
  fov?: boolean;
  focus?: Point;
  selected?: string;
  heat?: RecordRow[];
  children?: React.ReactNode;
}
export default function MapView(p: Props) {
  const [tileError, setTileError] = useState(false);
  const corridor =
    p.route && p.route.length > 1 && p.radius
      ? buffer(lineString(p.route.map(([lat, lng]) => [lng, lat])), p.radius, {
          units: "meters",
        })
      : null;
  return (
    <div className="map-shell">
      <MapContainer
        center={CENTER}
        zoom={14}
        minZoom={5}
        maxZoom={19}
        scrollWheelZoom
        className="leaflet-map"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <Events onClick={p.onClick} focus={p.focus} />
        <Home />
        {p.center &&
          (p.multi ? [200, 500, 1000, 2000] : [p.radius || 500]).map(
            (radius) => (
              <Circle
                key={radius}
                center={p.center!}
                radius={radius}
                pathOptions={{
                  color: "#38bdf8",
                  weight: 1,
                  dashArray: "5 5",
                  fillOpacity: 0.04,
                }}
              />
            ),
          )}
        {p.center && (
          <CircleMarker
            center={p.center}
            radius={5}
            pathOptions={{
              color: "#fff",
              fillColor: "#38bdf8",
              fillOpacity: 1,
            }}
          />
        )}
        {p.polygon && p.polygon.length > 1 && (
          <Polygon
            positions={p.polygon}
            pathOptions={{ color: "#a78bfa", weight: 2, fillOpacity: 0.1 }}
          />
        )}
        {corridor?.geometry.type === "Polygon" && (
          <Polygon
            positions={corridor.geometry.coordinates.map((ring) =>
              ring.map(([lng, lat]) => [lat, lng] as Point),
            )}
            pathOptions={{ color: "#38bdf8", weight: 1, fillOpacity: 0.1 }}
          />
        )}
        {p.route && p.route.length > 1 && (
          <Polyline
            positions={p.route}
            pathOptions={{
              color: "#38bdf8",
              weight: 4,
              opacity: 0.85,
              dashArray: "8 5",
            }}
          />
        )}
        {p.route?.map((v, i) => (
          <CircleMarker
            key={i}
            center={v}
            radius={5}
            pathOptions={{
              color: "#fff",
              fillColor: "#38bdf8",
              fillOpacity: 1,
            }}
          >
            <Tooltip>{i + 1}</Tooltip>
          </CircleMarker>
        ))}
        {p.fov &&
          p.cameras.map((c) => (
            <Polygon
              key={`f${c.id}`}
              positions={coverage(c)}
              pathOptions={{ color: color(c), weight: 1, fillOpacity: 0.15 }}
            />
          ))}
        {p.heat?.flatMap((c) =>
          [220, 140, 70].map((r, i) => (
            <Circle
              key={`${c.id}-${i}`}
              center={position(c)}
              radius={r}
              interactive={false}
              pathOptions={{
                stroke: false,
                fillColor: ["#fdba74", "#fb923c", "#fb7185"][i],
                fillOpacity: 0.12,
              }}
            />
          )),
        )}
        {p.cameras.map((c) => (
          <CircleMarker
            key={c.id}
            center={position(c)}
            radius={p.selected === c.id ? 10 : 5}
            pathOptions={{
              color: p.selected === c.id ? "white" : color(c),
              weight: 2,
              fillColor: color(c),
              fillOpacity: 0.9,
            }}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                p.onSelect?.(c);
              },
            }}
          >
            <Tooltip direction="top">
              <b>{s(c, "code")}</b>
              <br />
              {s(c, "title")}
            </Tooltip>
          </CircleMarker>
        ))}
        {p.incidents?.map((c) => (
          <CircleMarker
            key={c.id}
            center={position(c)}
            radius={7}
            pathOptions={{ color: "#60a5fa", weight: 2, fillOpacity: 0.35 }}
            eventHandlers={{ click: () => p.onSelect?.(c) }}
          >
            <Tooltip>{s(c, "title")}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="map-label">
        <span className="dot" /> NARATHIWAT <span>6.4264° N · 101.8231° E</span>
      </div>
      {tileError && (
        <div className="map-warning">
          โหลดแผนที่พื้นหลังบางส่วนไม่ได้ • ตรวจสอบอินเทอร์เน็ต
        </div>
      )}
      {p.children}
    </div>
  );
}
