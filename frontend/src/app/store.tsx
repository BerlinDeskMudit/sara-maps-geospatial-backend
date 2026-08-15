import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { FlyTo, Overlays, Pins } from '../components/MapView';
import type { IsochroneFeature, LatLng, PoiResult, RouteManeuver, RouteMode } from '../lib/types';

export type Mode = 'explore' | 'console';

export interface RouteLine {
  geometry: string;
  distance_km: number;
  duration_min: number;
  maneuvers: RouteManeuver[];
}

export interface ExploreSlice {
  location: LatLng | null;
  nearby: PoiResult[];
  selection: PoiResult | null;
  tapPoint: LatLng | null;
  origin: LatLng;
  destination: LatLng;
  routeMode: RouteMode;
  route: RouteLine | null;
  routeLoading: boolean;
  directionOpen: boolean;
  navStep: number;
  isochrones: IsochroneFeature[] | null;
  isoCenter: LatLng | null;
  isoOpen: boolean;
  trace: Overlays['trace'];
  traceOpen: boolean;
  saved: PoiResult[];
  tourDone: boolean;
}

export interface AppState {
  mode: Mode;
  overlays: Overlays;
  pins: Pins;
  flyTo: FlyTo | null;
  cursor: { lat: number; lon: number; zoom: number } | null;
  explore: ExploreSlice;
}

export type AppAction =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_CURSOR'; cursor: AppState['cursor'] }
  | { type: 'SET_FLYTO'; flyTo: FlyTo | null }
  | { type: 'SET_OVERLAYS'; overlays: Partial<Overlays> }
  | { type: 'SET_PINS'; pins: Partial<Pins> }
  | { type: 'SET_LOCATION'; location: LatLng }
  | { type: 'SET_NEARBY'; nearby: PoiResult[] }
  | { type: 'EXPLORE_TAP'; ll: LatLng }
  | { type: 'CLEAR_TAP' }
  | { type: 'SELECT_PLACE'; selection: PoiResult | null }
  | { type: 'SET_ROUTE'; route: RouteLine | null; routeLoading?: boolean }
  | { type: 'SET_ROUTE_INPUTS'; origin: LatLng; destination: LatLng; routeMode: RouteMode }
  | { type: 'SET_DIRECTIONS_OPEN'; open: boolean }
  | { type: 'SET_NAV_STEP'; step: number }
  | { type: 'SET_ISO'; isochrones: IsochroneFeature[] | null; isoCenter: LatLng }
  | { type: 'SET_ISO_OPEN'; open: boolean }
  | { type: 'SET_TRACE'; trace: Overlays['trace'] }
  | { type: 'SET_TRACE_OPEN'; open: boolean }
  | { type: 'SAVE_PLACE'; place: PoiResult }
  | { type: 'UNSAVE_PLACE'; id: string }
  | { type: 'TOUR_DONE' };

export const DEFAULT_ORIGIN: LatLng = { lat: 23.1668, lon: 79.9394 };
export const DEFAULT_DEST: LatLng = { lat: 23.1815, lon: 79.9864 };

const SAVED_KEY = 'sara.saved.v1';
const TOUR_KEY = 'sara.tourDone.v1';

export const placeId = (p: PoiResult) => `${p.center.lat.toFixed(5)},${p.center.lon.toFixed(5)}`;

function loadSaved(): PoiResult[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as PoiResult[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function loadTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

function initialState(): AppState {
  return {
    mode: 'explore',
    overlays: {},
    pins: { origin: DEFAULT_ORIGIN, destination: DEFAULT_DEST },
    flyTo: null,
    cursor: null,
    explore: {
      location: null,
      nearby: [],
      selection: null,
      tapPoint: null,
      origin: DEFAULT_ORIGIN,
      destination: DEFAULT_DEST,
      routeMode: 'auto',
      route: null,
      routeLoading: false,
      directionOpen: false,
      navStep: 0,
      isochrones: null,
      isoCenter: null,
      isoOpen: false,
      trace: null,
      traceOpen: false,
      saved: loadSaved(),
      tourDone: loadTourDone(),
    },
  };
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        overlays: {},
        pins: { origin: state.explore.origin, destination: state.explore.destination },
        flyTo: null,
      };
    case 'SET_CURSOR':
      return { ...state, cursor: action.cursor };
    case 'SET_FLYTO':
      return { ...state, flyTo: action.flyTo };
    case 'SET_OVERLAYS':
      return { ...state, overlays: { ...state.overlays, ...action.overlays } };
    case 'SET_PINS':
      return { ...state, pins: { ...state.pins, ...action.pins } };
    case 'SET_LOCATION':
      return {
        ...state,
        pins: { ...state.pins, origin: action.location },
        flyTo: { lat: action.location.lat, lon: action.location.lon, zoom: 14, nonce: Date.now() },
        explore: { ...state.explore, location: action.location, origin: action.location },
      };
    case 'SET_NEARBY':
      return {
        ...state,
        overlays: { ...state.overlays, pois: action.nearby },
        explore: { ...state.explore, nearby: action.nearby },
      };
    case 'EXPLORE_TAP':
      return { ...state, explore: { ...state.explore, tapPoint: action.ll } };
    case 'CLEAR_TAP':
      return { ...state, explore: { ...state.explore, tapPoint: null } };
    case 'SELECT_PLACE':
      return {
        ...state,
        pins: { ...state.pins, destination: action.selection?.center },
        flyTo: action.selection
          ? { lat: action.selection.center.lat, lon: action.selection.center.lon, zoom: 15, nonce: Date.now() }
          : state.flyTo,
        explore: {
          ...state.explore,
          selection: action.selection,
          directionOpen: action.selection ? state.explore.directionOpen : false,
        },
      };
    case 'SET_ROUTE':
      return {
        ...state,
        overlays: { ...state.overlays, route: action.route },
        explore: {
          ...state.explore,
          route: action.route,
          routeLoading: action.routeLoading ?? false,
          navStep: action.route ? 0 : state.explore.navStep,
        },
      };
    case 'SET_ROUTE_INPUTS':
      return {
        ...state,
        pins: { ...state.pins, origin: action.origin, destination: action.destination },
        explore: { ...state.explore, origin: action.origin, destination: action.destination, routeMode: action.routeMode },
      };
    case 'SET_DIRECTIONS_OPEN':
      return {
        ...state,
        explore: {
          ...state.explore,
          directionOpen: action.open,
          navStep: action.open ? state.explore.navStep : 0,
        },
      };
    case 'SET_NAV_STEP':
      return { ...state, explore: { ...state.explore, navStep: action.step } };
    case 'SET_ISO':
      return {
        ...state,
        overlays: { ...state.overlays, isochrones: action.isochrones },
        explore: { ...state.explore, isochrones: action.isochrones, isoCenter: action.isoCenter },
      };
    case 'SET_ISO_OPEN':
      return { ...state, explore: { ...state.explore, isoOpen: action.open } };
    case 'SET_TRACE':
      return {
        ...state,
        overlays: { ...state.overlays, trace: action.trace },
        explore: { ...state.explore, trace: action.trace },
      };
    case 'SET_TRACE_OPEN':
      return { ...state, explore: { ...state.explore, traceOpen: action.open } };
    case 'SAVE_PLACE': {
      const id = placeId(action.place);
      const exists = state.explore.saved.some((p) => placeId(p) === id);
      const saved = exists ? state.explore.saved : [...state.explore.saved, action.place];
      return { ...state, explore: { ...state.explore, saved } };
    }
    case 'UNSAVE_PLACE': {
      const saved = state.explore.saved.filter((p) => placeId(p) !== action.id);
      return { ...state, explore: { ...state.explore, saved } };
    }
    case 'TOUR_DONE':
      return { ...state, explore: { ...state.explore, tourDone: true } };
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(state.explore.saved));
    } catch {
      /* ignore */
    }
  }, [state.explore.saved]);

  useEffect(() => {
    try {
      localStorage.setItem(TOUR_KEY, state.explore.tourDone ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [state.explore.tourDone]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
