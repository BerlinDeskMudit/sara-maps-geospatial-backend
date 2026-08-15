import { useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import { useApp } from '../store';
import { useGeolocation } from '../useGeolocation';
import { api } from '../../lib/api';
import { fmtLatLon, nearestPoi } from '../../lib/geo';
import { animatePolyline } from '../../lib/animate';
import type { LatLng, PoiResult, RouteResult } from '../../lib/types';
import CategoryChips from './CategoryChips';
import PlaceCard from './PlaceCard';
import DirectionsBar from './DirectionsBar';
import IsoBubble from './IsoBubble';
import TraceDemo from './TraceDemo';
import SavedDrawer from './SavedDrawer';
import Tour from './Tour';
import { BubbleIcon, GpsIcon, LocateIcon } from './icons';

function bearingDeg(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const la1 = a.lat * rad;
  const la2 = b.lat * rad;
  const dLon = (b.lon - a.lon) * rad;
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

export default function ExploreView({ mapRef }: { mapRef: { current: maplibregl.Map | null } }) {
  const { state, dispatch } = useApp();
  const geo = useGeolocation();

  useEffect(() => {
    if (geo.granted && geo.coords && !state.explore.location) {
      dispatch({ type: 'SET_LOCATION', location: geo.coords });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.granted, geo.coords]);

  useEffect(() => {
    if (state.mode !== 'explore') return;
    const e = state.explore;
    dispatch({
      type: 'SET_OVERLAYS',
      overlays: {
        pois: e.nearby.length ? e.nearby : null,
        route: e.route,
        isochrones: e.isochrones,
        trace: e.trace,
      },
    });
    dispatch({
      type: 'SET_PINS',
      pins: { origin: e.origin, destination: e.selection?.center },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mode]);

  useEffect(() => {
    const p = state.explore.tapPoint;
    if (!p) return;
    dispatch({ type: 'CLEAR_TAP' });
    const hit = nearestPoi(p, state.explore.nearby, 2500);
    if (hit) {
      dispatch({ type: 'SELECT_PLACE', selection: hit });
      return;
    }
    let alive = true;
    api.poiNearby(p.lat, p.lon, 400, undefined, 1).then((r) => {
      if (!alive || !r.ok) return;
      const res = (r.body as { results: PoiResult[] }).results;
      if (res[0]) {
        dispatch({ type: 'SET_NEARBY', nearby: [...state.explore.nearby, res[0]] });
        dispatch({ type: 'SELECT_PLACE', selection: res[0] });
      } else {
        dispatch({ type: 'SELECT_PLACE', selection: null });
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.explore.tapPoint]);

  useEffect(() => {
    const sel = state.explore.selection;
    if (!sel || state.mode !== 'explore') return;
    dispatch({ type: 'SET_ROUTE', route: null, routeLoading: true });
    let alive = true;
    api.route(fmtLatLon(state.explore.origin), fmtLatLon(sel.center), state.explore.routeMode).then((r) => {
      if (!alive || !r.ok) return;
      const res = r.body as RouteResult;
      dispatch({
        type: 'SET_ROUTE',
        route: {
          geometry: res.geometry,
          distance_km: res.summary.distance_km,
          duration_min: res.summary.duration_min,
          maneuvers: res.maneuvers,
        },
        routeLoading: false,
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.explore.selection, state.explore.routeMode]);

  useEffect(() => {
    const r = state.explore.route;
    if (!r || state.mode !== 'explore') return;
    return animatePolyline(r.geometry, 5, (partial) => {
      dispatch({ type: 'SET_OVERLAYS', overlays: { route: { ...r, geometry: partial } } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.explore.route]);

  useEffect(() => {
    const map = mapRef.current;
    const e = state.explore;
    if (!map || state.mode !== 'explore' || !e.directionOpen) return;
    const r = e.route;
    if (!r || r.maneuvers.length < 2) return;
    const i = Math.min(e.navStep, r.maneuvers.length - 2);
    const from = r.maneuvers[i].start;
    const to = r.maneuvers[i + 1].start;
    map.easeTo({
      center: [to.lon, to.lat],
      bearing: bearingDeg(from, to),
      pitch: 58,
      duration: 1200,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.explore.directionOpen, state.explore.navStep, state.explore.route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (state.explore.directionOpen && state.mode === 'explore') return;
    if (map.getPitch() > 0) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.explore.directionOpen, state.mode]);

  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (map && map.getPitch() > 0) {
        map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = () => {
    const c = state.explore.location;
    if (!c) return;
    dispatch({ type: 'SET_FLYTO', flyTo: { lat: c.lat, lon: c.lon, zoom: 14.5, nonce: Date.now() } });
  };

  return (
    <>
      <div className="tool-rail" role="group" aria-label="Tools">
        <button
          type="button"
          className="rail-fab"
          onClick={locate}
          disabled={!state.explore.location}
          aria-label="My location"
        >
          <LocateIcon />
        </button>
        <SavedDrawer />
        <button
          type="button"
          className={`rail-fab${state.explore.isoOpen ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'SET_ISO_OPEN', open: !state.explore.isoOpen })}
          aria-pressed={state.explore.isoOpen}
          aria-label="How far in 10 minutes"
          title="How far in 10 minutes?"
        >
          <BubbleIcon />
        </button>
        <button
          type="button"
          className={`rail-fab${state.explore.traceOpen ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TRACE_OPEN', open: !state.explore.traceOpen })}
          aria-pressed={state.explore.traceOpen}
          aria-label="GPS trace demo"
          title="Snap a GPS trace to the roads"
        >
          <GpsIcon />
        </button>
      </div>

      {!state.explore.selection && <CategoryChips />}
      <PlaceCard />
      <DirectionsBar />
      <IsoBubble mapRef={mapRef} />
      <TraceDemo />
      <Tour />
    </>
  );
}
