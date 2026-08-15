import { useCallback, useEffect, useRef, useState } from 'react';
import MapView from '../components/MapView';
import { useApp } from './store';
import { api } from '../lib/api';
import type { GeocodeResult, HealthResponse, LatLng } from '../lib/types';
import ExploreView from './explore/ExploreView';
import ConsoleView from './ConsoleView';

export default function AppShell() {
  const { state, dispatch } = useApp();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<number | null>(null);
  const rawMapRef = useRef<import('maplibre-gl').Map | null>(null);
  const consolePickRef = useRef<((ll: LatLng) => void) | null>(null);

  useEffect(() => {
    let alive = true;
    api.health().then((r) => {
      if (alive && r.ok) setHealth(r.body as HealthResponse);
    });
    return () => {
      alive = false;
    };
  }, []);

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setSearching(true);
    const r = await api.geocode(trimmed);
    setSearching(false);
    if (!r.ok) {
      setResults([]);
      return;
    }
    const res = (r.body as { results: GeocodeResult[] }).results;
    setResults(res);
    setShowResults(res.length > 0);
  };

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQ.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    searchTimer.current = window.setTimeout(() => void runSearch(searchQ), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ]);

  const pickSearch = (hit: GeocodeResult) => {
    setSearchQ(hit.name);
    setShowResults(false);
    const c = hit.center;
    if (state.mode === 'explore') {
      const poi = {
        name: hit.name,
        category: hit.category,
        subcategory: hit.subcategory,
        center: c,
        distance_m: 0,
      };
      dispatch({ type: 'SELECT_PLACE', selection: poi });
    } else {
      dispatch({ type: 'SET_PINS', pins: { center: c } });
      dispatch({ type: 'SET_FLYTO', flyTo: { lat: c.lat, lon: c.lon, zoom: 15, nonce: Date.now() } });
    }
  };

  const onPickMap = useCallback(
    (p: LatLng) => {
      if (state.mode === 'explore') {
        dispatch({ type: 'EXPLORE_TAP', ll: p });
      } else if (consolePickRef.current) {
        consolePickRef.current(p);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.mode],
  );

  const onCursor = useCallback(
    (c: { lat: number; lon: number; zoom: number } | null) => dispatch({ type: 'SET_CURSOR', cursor: c }),
    [dispatch],
  );

  const toggleFullscreen = () => {
    const el = document.getElementById('app-shell');
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void el.requestFullscreen().catch(() => undefined);
    }
  };

  return (
    <div className="app" id="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>
            Sara<span className="dim">Maps</span>
          </h1>
        </div>

        <div className="search-wrap">
          <div className="search">
            <svg className="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M16.5 16.5L21 21" />
            </svg>
            <input
              className="search-input"
              type="text"
              value={searchQ}
              spellCheck={false}
              autoComplete="off"
              placeholder="Search places in Jabalpur"
              aria-label="Search places"
              onFocus={() => results.length > 0 && setShowResults(true)}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (results[0]) pickSearch(results[0]);
                }
              }}
            />
            {searching && <span className="search-spin" aria-hidden="true" />}
          </div>
          {showResults && (
            <ul className="search-results" role="listbox">
              {results.map((r) => (
                <li key={r.id ?? `${r.name}-${r.center.lat}`}>
                  <button type="button" role="option" onClick={() => pickSearch(r)}>
                    <span className="res-title">{r.name}</span>
                    <span className="res-sub">{r.category} · {r.subcategory}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="top-actions">
          <button
            type="button"
            className="mode-toggle"
            onClick={() => dispatch({ type: 'SET_MODE', mode: state.mode === 'explore' ? 'console' : 'explore' })}
            aria-label={state.mode === 'explore' ? 'Open API console' : 'Back to map'}
          >
            {state.mode === 'explore' ? 'Console' : 'Map'}
          </button>
          <div className="coords" aria-live="off">
            {state.cursor ? (
              <>
                <span>
                  {state.cursor.lat.toFixed(5)}, {state.cursor.lon.toFixed(5)}
                </span>
                <span>z{state.cursor.zoom.toFixed(1)}</span>
              </>
            ) : (
              <span className="muted">lat, lon</span>
            )}
          </div>
        </div>

        <div className="chips">
          <span className={`chip ${health?.status === 'ok' ? 'ok' : 'idle'}`} title="Fastify API gateway">
            <span className="dot" /> api
          </span>
          <span className={`chip ${health?.dependencies?.martin?.status === 'up' ? 'ok' : 'idle'}`} title="Martin MVT tile server">
            <span className="dot" /> tiles
          </span>
          <span className={`chip ${health?.dependencies?.valhalla?.status === 'up' ? 'ok' : 'idle'}`} title="Valhalla routing engine">
            <span className="dot" /> routing
          </span>
          <span className={`chip ${health?.dependencies?.postgis?.status === 'up' ? 'ok' : 'idle'}`} title="PostGIS + OSM data">
            <span className="dot" /> postgis
          </span>
        </div>
      </header>

      <main className="stage">
        <div className="map-shell">
          <MapView
            overlays={state.overlays}
            pins={state.pins}
            flyTo={state.flyTo}
            blueDot={state.mode === 'explore' ? state.explore.location : undefined}
            onPick={onPickMap}
            onCursor={onCursor}
            onMapReady={(m) => {
              rawMapRef.current = m;
              (window as unknown as { __saraMap?: unknown }).__saraMap = m;
            }}
          />
          <div className="legend" role="list" aria-label="Overlay legend">
            <span role="listitem"><i className="sw" style={{ background: '#00d9c8' }} /> route</span>
            <span role="listitem"><i className="sw" style={{ background: '#a78bfa' }} /> isochrone</span>
            <span role="listitem"><i className="sw" style={{ background: '#ffb020' }} /> POI</span>
            <span role="listitem"><i className="sw" style={{ background: '#4ade80' }} /> trace</span>
            <span role="listitem"><i className="sw" style={{ background: '#fb7185' }} /> matrix</span>
          </div>
          <button type="button" className="map-fs" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
          {state.mode === 'explore' ? (
            <ExploreView mapRef={rawMapRef} />
          ) : (
            <ConsoleView onPickRef={consolePickRef} />
          )}
        </div>
      </main>
    </div>
  );
}
