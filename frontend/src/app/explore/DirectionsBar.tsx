import { useApp } from '../store';
import { fmtKm } from '../../lib/format';
import { haversineM } from '../../lib/geo';
import type { RouteMode } from '../../lib/types';
import { BikeIcon, CarIcon, CloseIcon, TurnIcon, WalkIcon } from './icons';

const MODES: { m: RouteMode; label: string; icon: typeof CarIcon }[] = [
  { m: 'auto', label: 'Drive', icon: CarIcon },
  { m: 'bicycle', label: 'Cycle', icon: BikeIcon },
  { m: 'pedestrian', label: 'Walk', icon: WalkIcon },
];

export default function DirectionsBar() {
  const { state, dispatch } = useApp();
  const sel = state.explore.selection;
  if (!sel || !state.explore.directionOpen) return null;

  const r = state.explore.route;
  const from = state.explore.location ?? state.explore.origin;
  const dist = haversineM(from, sel.center);
  const arrive = r ? new Date(Date.now() + r.duration_min * 60000) : null;

  const mvs = r?.maneuvers ?? [];
  const hasSteps = mvs.length >= 2;
  const last = Math.max(mvs.length - 1, 0);
  const step = Math.min(state.explore.navStep, last);
  const arrived = hasSteps && step >= last;
  const mv = mvs[Math.min(step, mvs.length - 1)];

  const setMode = (m: RouteMode) =>
    dispatch({ type: 'SET_ROUTE_INPUTS', origin: state.explore.origin, destination: sel.center, routeMode: m });

  const clear = () => {
    dispatch({ type: 'SET_DIRECTIONS_OPEN', open: false });
    dispatch({ type: 'SELECT_PLACE', selection: null });
    dispatch({ type: 'SET_ROUTE', route: null });
  };

  const next = () => dispatch({ type: 'SET_NAV_STEP', step: Math.min(step + 1, last) });
  const prev = () => dispatch({ type: 'SET_NAV_STEP', step: Math.max(step - 1, 0) });
  const progress = hasSteps ? (step / last) * 100 : 0;

  return (
    <section className="bottom-sheet dir-bar nav" aria-label="Navigation">
      <header className="sheet-head">
        <div className="sheet-title">
          <h2>{sel.name}</h2>
          <p className="sheet-sub">
            {fmtKm(dist / 1000)}
            <span className="dot-sep" />
            {state.explore.routeLoading ? 'planning…' : r ? `${fmtKm(r.distance_km)} · ${Math.round(r.duration_min)} min` : 'tap a mode'}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={clear} aria-label="Exit navigation">
          <CloseIcon />
        </button>
      </header>

      <div className="dir-modes" role="radiogroup" aria-label="Travel mode">
        {MODES.map((x) => (
          <button
            key={x.m}
            type="button"
            role="radio"
            aria-checked={state.explore.routeMode === x.m}
            className={`dir-mode${state.explore.routeMode === x.m ? ' active' : ''}`}
            onClick={() => setMode(x.m)}
          >
            <x.icon />
            {x.label}
          </button>
        ))}
      </div>

      {!r && (
        <div className="nav-turn">
          <div className="nav-turn-icon idle">
            <TurnIcon type={1} />
          </div>
          <div className="nav-turn-text">
            <strong>{state.explore.routeLoading ? 'Planning route…' : 'Get directions to move'}</strong>
            <span>tilted 3D view will guide you turn by turn</span>
          </div>
        </div>
      )}

      {r && hasSteps && !arrived && mv && (
        <div className="nav-turn">
          <div className="nav-turn-icon">
            <TurnIcon type={mv.type} />
          </div>
          <div className="nav-turn-text">
            <strong>{mv.instruction}</strong>
            <span>
              {fmtKm(mv.distance_km)}
              {mv.duration_min > 0 ? ` · ~${Math.round(mv.duration_min)} min` : ''}
            </span>
          </div>
        </div>
      )}

      {r && hasSteps && arrived && (
        <div className="nav-turn">
          <div className="nav-turn-icon arrive">
            <TurnIcon type={4} />
          </div>
          <div className="nav-turn-text">
            <strong>You&apos;ve arrived</strong>
            <span>{sel.name}</span>
          </div>
        </div>
      )}

      {r && hasSteps && (
        <div className="nav-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="dir-meta">
        <div className="eta-strip">
          <span className="eta-big">{arrived ? 'Done' : r ? `${Math.round(r.duration_min)} min` : '…'}</span>
          <span className="eta-note">
            {arrived
              ? 'at destination'
              : r
                ? `arrive ${arrive ? arrive.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`
                : 'choose a mode'}
            {r && <em>{fmtKm(r.distance_km)}</em>}
          </span>
        </div>

        {r && hasSteps && (
          <div className="nav-foot">
            <button type="button" className="mini" onClick={prev} disabled={step === 0} aria-label="Previous step">
              Prev
            </button>
            <span className="nav-count">
              {arrived ? last + 1 : step + 1}/{last + 1}
            </span>
            <button type="button" className="mini" onClick={next} disabled={arrived} aria-label="Next step">
              Next
            </button>
          </div>
        )}
        <button type="button" className="btn primary go" onClick={clear}>
          Exit
        </button>
      </div>
    </section>
  );
}
