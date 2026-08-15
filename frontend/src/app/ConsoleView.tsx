import { useCallback, useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import type { FlyTo, Overlays, Pins } from '../components/MapView';
import { useApp } from './store';
import { api, type ApiResult } from '../lib/api';
import { asLatLng, fmtLatLon, genTrace, haversineM } from '../lib/geo';
import { fmtMs } from '../lib/format';
import type {
  HealthResponse,
  IsochroneFeature,
  LatLng,
  PoiResult,
  PinRole,
  RouteMode,
  RouteResult,
  TraceResult,
} from '../lib/types';

type Tab = 'route' | 'iso' | 'geocode' | 'poi' | 'matrix' | 'trace' | 'health';

interface Entry {
  id: number;
  label: string;
  status: number;
  latencyMs: number;
  ok: boolean;
  body: unknown;
}

const DEFAULT_CENTER = { lat: 23.1668, lon: 79.9394 };
const DEFAULT_MATRIX = '23.1668,79.9394; 23.1815,79.9864; 23.1755,79.9470; 23.1560,79.9530';

const MODES: RouteMode[] = ['auto', 'bicycle', 'pedestrian'];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <em className="field-hint">{hint}</em>}
      </span>
      {children}
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" spellCheck={false} autoComplete="off" {...props} className="input" />;
}

function ModePicker({ value, onChange }: { value: RouteMode; onChange: (m: RouteMode) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Travel mode">
      {MODES.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          className={`seg-btn${value === m ? ' active' : ''}`}
          onClick={() => onChange(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function TargetPicker({
  value,
  options,
  onChange,
}: {
  value: PinRole;
  options: { role: PinRole; label: string }[];
  onChange: (r: PinRole) => void;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label="Map click target">
      {options.map((o) => (
        <button
          key={o.role}
          type="button"
          role="radio"
          aria-checked={value === o.role}
          className={`seg-btn${value === o.role ? ' active' : ''}`}
          onClick={() => onChange(o.role)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ConsoleView({ onPickRef }: { onPickRef: { current: ((ll: LatLng) => void) | null } }) {
  const { state, dispatch } = useApp();
  const pins: Pins = state.pins;
  const setPins = (p: Partial<Pins>) => dispatch({ type: 'SET_PINS', pins: p });
  const setOverlays = (o: Partial<Overlays>) => dispatch({ type: 'SET_OVERLAYS', overlays: o });
  const flyTo = (f: FlyTo) => dispatch({ type: 'SET_FLYTO', flyTo: f });

  const [tab, setTab] = useState<Tab>('route');
  const [pickRole, setPickRole] = useState<PinRole>('destination');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const [route, setRoute] = useState({ origin: fmtLatLon(pins.origin ?? DEFAULT_CENTER), destination: fmtLatLon(pins.destination ?? DEFAULT_CENTER), mode: 'auto' as RouteMode, alternatives: false });
  const [iso, setIso] = useState({ center: fmtLatLon(DEFAULT_CENTER), contours: '10,20', mode: 'auto' as RouteMode });
  const [geocode, setGeocode] = useState({ q: 'hospital', hint: fmtLatLon(DEFAULT_CENTER) });
  const [rev, setRev] = useState({ lat: String(DEFAULT_CENTER.lat), lon: String(DEFAULT_CENTER.lon) });
  const [poi, setPoi] = useState({ q: 'hospital', radius: 2000, limit: 20 });
  const [nearby, setNearby] = useState({ radius: 1500, category: '', limit: 20 });
  const [matrix, setMatrix] = useState({ locations: DEFAULT_MATRIX, mode: 'auto' as RouteMode });
  const [traceMode, setTraceMode] = useState<RouteMode>('auto');

  const nextId = useMemo(() => ({ n: 0 }), []);  const pushEntry = useCallback(
    (label: string, r: ApiResult<unknown>) => {
      const id = ++nextId.n;
      setEntries((e) => [{ id, label, status: r.status, latencyMs: r.latencyMs, ok: r.ok, body: r.body }, ...e].slice(0, 20));
      setActiveId(id);
      return id;
    },
    [nextId],
  );

  const active = entries.find((e) => e.id === activeId) ?? entries[0];

  const runHealth = useCallback(async () => {
    const r = await api.health();
    pushEntry('GET /health', r as ApiResult<unknown>);
    if (r.ok) setHealth(r.body as HealthResponse);
  }, [pushEntry]);

  useEffect(() => {
    runHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runRoute = async () => {
    const waypoints = pins.waypoint ? [fmtLatLon(pins.waypoint)] : [];
    const r = await api.route(route.origin, route.destination, route.mode, route.alternatives, waypoints);
    pushEntry(`GET /v1/route · ${route.mode}${waypoints.length > 0 ? ' · via' : ''}`, r as ApiResult<unknown>);
    if (r.ok) {
      const res = r.body as RouteResult;
      setOverlays({ route: { geometry: res.geometry, distance_km: res.summary.distance_km, duration_min: res.summary.duration_min } });
    }
  };

  const runIso = async () => {
    const r = await api.isochrone(iso.center, iso.contours, iso.mode);
    pushEntry(`GET /v1/isochrone · ${iso.contours.split(',').length} contour(s)`, r as ApiResult<unknown>);
    if (r.ok) {
      setOverlays({ isochrones: (r.body as { features: IsochroneFeature[] }).features });
    }
  };

  const runGeocode = async () => {
    const r = await api.geocode(geocode.q, geocode.hint);
    pushEntry(`GET /v1/geocode?q=${geocode.q}`, r as ApiResult<unknown>);
    if (r.ok) {
      const results = (r.body as { results: { name: string; category: string; subcategory: string; center: LatLng }[] }).results;
      const c = pins.center ?? DEFAULT_CENTER;
      const pois: PoiResult[] = results.map((x) => ({
        name: x.name,
        category: x.category,
        subcategory: x.subcategory,
        center: x.center,
        distance_m: x.center ? Math.round(haversineM(c, x.center)) : 0,
      }));
      setOverlays({ pois });
    }
  };

  const runReverse = async () => {
    const r = await api.reverseGeocode(Number(rev.lat), Number(rev.lon));
    pushEntry(`GET /v1/geocode/reverse · ${rev.lat},${rev.lon}`, r as ApiResult<unknown>);
  };

  const runPoiSearch = async () => {
    const c = pins.center ?? DEFAULT_CENTER;
    const r = await api.poiSearch(poi.q, fmtLatLon(c), poi.radius, poi.limit);
    pushEntry(`GET /v1/poi/search?q=${poi.q}`, r as ApiResult<unknown>);
    if (r.ok) setOverlays({ pois: (r.body as { results: PoiResult[] }).results });
  };

  const runPoiNearby = async () => {
    const c = pins.center ?? DEFAULT_CENTER;
    const r = await api.poiNearby(c.lat, c.lon, nearby.radius, nearby.category || undefined, nearby.limit);
    pushEntry(`GET /v1/poi/nearby · ${nearby.radius}m`, r as ApiResult<unknown>);
    if (r.ok) setOverlays({ pois: (r.body as { results: PoiResult[] }).results });
  };

  const runMatrix = async () => {
    const r = await api.matrix(matrix.locations, matrix.mode);
    pushEntry(`GET /v1/matrix · ${matrix.mode}`, r as ApiResult<unknown>);
    if (r.ok) {
      const body = r.body as { rows: { durations_s: number[]; distances_m: number[] }[] };
      const locations = matrix.locations
        .split(';')
        .map((s) => asLatLng(s))
        .filter((x): x is LatLng => !!x);
      setOverlays({ matrix: { rows: body.rows, locations } });
    }
  };

  const runTrace = async () => {
    const a = pins.origin ?? DEFAULT_CENTER;
    const b = pins.destination ?? DEFAULT_CENTER;
    const trace = genTrace(a, b, 48);
    const r = await api.trace(trace, traceMode);
    pushEntry(`POST /v1/trace/route · ${traceMode}`, r as ApiResult<unknown>);
    if (r.ok) {
      const t = r.body as TraceResult;
      setOverlays({ trace: { geometry: t.geometry, raw: trace, matched: t.matched_points } });
    }
  };

  const setPick = useCallback(
    (role: PinRole) => (p: LatLng) => {
      setPins({ [role]: p });
      if (role === 'rev') setRev({ lat: p.lat.toFixed(5), lon: p.lon.toFixed(5) });
      if (role === 'origin') setRoute((r) => ({ ...r, origin: fmtLatLon(p) }));
      if (role === 'destination') setRoute((r) => ({ ...r, destination: fmtLatLon(p) }));
      if (role === 'center') setIso((i) => ({ ...i, center: fmtLatLon(p) }));
      flyTo({ lat: p.lat, lon: p.lon, zoom: 15, nonce: Date.now() });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handlePick = useCallback(
    (p: LatLng) => {
      if (pickRole === 'origin' || pickRole === 'destination' || pickRole === 'waypoint' || pickRole === 'center' || pickRole === 'rev') {
        setPick(pickRole)(p);
      }
    },
    [pickRole, setPick],
  );

  useEffect(() => {
    onPickRef.current = handlePick;
  });

  const pickRoleForTab: Record<Tab, PinRole | null> = {
    route: pickRole,
    iso: 'center',
    geocode: 'rev',
    poi: 'center',
    matrix: null,
    trace: 'destination',
    health: null,
  };

  const tabDefs: { id: Tab; label: string }[] = [
    { id: 'route', label: 'Route' },
    { id: 'iso', label: 'Isochrone' },
    { id: 'geocode', label: 'Geocode' },
    { id: 'poi', label: 'POI' },
    { id: 'matrix', label: 'Matrix' },
    { id: 'trace', label: 'Trace' },
    { id: 'health', label: 'Health' },
  ];

  return (
    <>
      <aside className="rail" aria-label="API explorer">
        <nav className="tabs" role="tablist" aria-label="Endpoints">
          {tabDefs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="rail-body">
          {tab === 'route' && (
            <div className="pane">
              <p className="pane-desc">Turn-by-turn routing via Valhalla. Precision-5 polyline geometry.</p>
              <Field label="Click target" hint="tap the map">
                <TargetPicker
                  value={pickRole}
                  options={[
                    { role: 'origin', label: 'A origin' },
                    { role: 'destination', label: 'B dest' },
                    { role: 'waypoint', label: 'W via' },
                  ]}
                  onChange={setPickRole}
                />
              </Field>
              <Field label="Origin A">
                <TextInput value={route.origin} onChange={(e) => setRoute((r) => ({ ...r, origin: e.target.value }))} />
              </Field>
              <Field label="Destination B">
                <TextInput value={route.destination} onChange={(e) => setRoute((r) => ({ ...r, destination: e.target.value }))} />
              </Field>
              <Field label="Mode">
                <ModePicker value={route.mode} onChange={(m) => setRoute((r) => ({ ...r, mode: m }))} />
              </Field>
              <label className="check">
                <input type="checkbox" checked={route.alternatives} onChange={(e) => setRoute((r) => ({ ...r, alternatives: e.target.checked }))} />
                alternatives
              </label>
              <button type="button" className="btn primary" onClick={runRoute}>
                Run route
              </button>
            </div>
          )}

          {tab === 'iso' && (
            <div className="pane">
              <p className="pane-desc">Reachability polygons for time contours from a center point.</p>
              <Field label="Center C" hint="click map">
                <TextInput value={iso.center} onChange={(e) => setIso((i) => ({ ...i, center: e.target.value }))} />
              </Field>
              <Field label="Contours (min)">
                <TextInput value={iso.contours} onChange={(e) => setIso((i) => ({ ...i, contours: e.target.value }))} />
              </Field>
              <Field label="Mode">
                <ModePicker value={iso.mode} onChange={(m) => setIso((i) => ({ ...i, mode: m }))} />
              </Field>
              <button type="button" className="btn primary" onClick={runIso}>
                Run isochrone
              </button>
            </div>
          )}

          {tab === 'geocode' && (
            <div className="pane">
              <p className="pane-desc">Forward &amp; reverse geocoding from the PostGIS places table.</p>
              <Field label="Query">
                <TextInput value={geocode.q} onChange={(e) => setGeocode((g) => ({ ...g, q: e.target.value }))} />
              </Field>
              <Field label="Center hint" hint="optional">
                <TextInput value={geocode.hint} onChange={(e) => setGeocode((g) => ({ ...g, hint: e.target.value }))} />
              </Field>
              <button type="button" className="btn primary" onClick={runGeocode}>
                Geocode
              </button>
              <div className="divider" />
              <Field label="Reverse · lat" hint="click map sets both">
                <TextInput value={rev.lat} onChange={(e) => setRev((r) => ({ ...r, lat: e.target.value }))} />
              </Field>
              <Field label="Reverse · lon">
                <TextInput value={rev.lon} onChange={(e) => setRev((r) => ({ ...r, lon: e.target.value }))} />
              </Field>
              <button type="button" className="btn" onClick={runReverse}>
                Reverse geocode
              </button>
            </div>
          )}

          {tab === 'poi' && (
            <div className="pane">
              <p className="pane-desc">Point-of-interest search and radius queries over the sara.places index.</p>
              <Field label="Search query">
                <TextInput value={poi.q} onChange={(e) => setPoi((p) => ({ ...p, q: e.target.value }))} />
              </Field>
              <Field label="Radius (m)">
                <TextInput value={poi.radius} onChange={(e) => setPoi((p) => ({ ...p, radius: Number(e.target.value) }))} />
              </Field>
              <button type="button" className="btn primary" onClick={runPoiSearch}>
                Search POIs
              </button>
              <div className="divider" />
              <p className="pane-desc">Nearby — centered on pin C <em>(click map to move)</em>.</p>
              <Field label="Radius (m)">
                <TextInput value={nearby.radius} onChange={(e) => setNearby((n) => ({ ...n, radius: Number(e.target.value) }))} />
              </Field>
              <Field label="Category" hint="optional">
                <TextInput value={nearby.category} onChange={(e) => setNearby((n) => ({ ...n, category: e.target.value }))} />
              </Field>
              <button type="button" className="btn primary" onClick={runPoiNearby}>
                Nearby POIs
              </button>
            </div>
          )}

          {tab === 'matrix' && (
            <div className="pane">
              <p className="pane-desc">Source-to-target duration &amp; distance matrix. Semicolon-separated lat,lon.</p>
              <Field label="Locations">
                <textarea
                  className="input area"
                  spellCheck={false}
                  rows={4}
                  value={matrix.locations}
                  onChange={(e) => setMatrix((m) => ({ ...m, locations: e.target.value }))}
                />
              </Field>
              <Field label="Mode">
                <ModePicker value={matrix.mode} onChange={(m) => setMatrix((x) => ({ ...x, mode: m }))} />
              </Field>
              <button type="button" className="btn primary" onClick={runMatrix}>
                Run matrix
              </button>
            </div>
          )}

          {tab === 'trace' && (
            <div className="pane">
              <p className="pane-desc">Map-matching: snap a synthetic GPS trace onto the road graph.</p>
              <Field label="Mode">
                <ModePicker value={traceMode} onChange={setTraceMode} />
              </Field>
              <button type="button" className="btn primary" onClick={runTrace}>
                Generate GPS &amp; trace
              </button>
            </div>
          )}

          {tab === 'health' && (
            <div className="pane">
              <p className="pane-desc">Gateway dependency health check.</p>
              <button type="button" className="btn primary" onClick={runHealth}>
                Re-check health
              </button>
              {health && (
                <ul className="deps">
                  {Object.entries(health.dependencies).map(([k, v]) => (
                    <li key={k}>
                      <span className={v.status === 'up' ? 'ok' : 'err'}>{v.status === 'up' ? '●' : '○'}</span>
                      <code>{k}</code>
                      <span className="muted">{v.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <section className="response" aria-label="Response">
          <header className="response-head">
            <span className="resp-meta">
              {active && (
                <>
                  <span className={`pill ${active.ok ? 'pill-ok' : 'pill-err'}`}>{active.status}</span>
                  <span>{fmtMs(active.latencyMs)}</span>
                </>
              )}
            </span>
          </header>
          <div className="response-body">
            {active ? (
              <pre className="json" aria-label="Response JSON">
                {JSON.stringify(active.body, null, 2)}
              </pre>
            ) : (
              <p className="muted">Run a request to inspect its response.</p>
            )}
          </div>
          <footer className="response-foot">
            <span>{entries.length} request{entries.length === 1 ? '' : 's'} this session</span>
            <button
              type="button"
              className="mini"
              onClick={() => {
                if (active) {
                  void navigator.clipboard?.writeText(JSON.stringify(active.body, null, 2));
                }
              }}
            >
              copy
            </button>
          </footer>
        </section>
      </aside>

      <div className="map-hint-wrap">
        {pickRoleForTab[tab] && (
          <div className="map-hint" role="status">
            <span className="dot" aria-hidden="true" />
            {pickRoleForTab[tab] === 'origin' && 'click map to set origin (A)'}
            {pickRoleForTab[tab] === 'destination' && 'click map to set destination (B)'}
            {pickRoleForTab[tab] === 'waypoint' && 'click map to set waypoint (W)'}
            {pickRoleForTab[tab] === 'center' && 'click map to set center (C)'}
            {pickRoleForTab[tab] === 'rev' && 'click map to reverse-geocode'}
          </div>
        )}
      </div>
    </>
  );
}

