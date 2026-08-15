import { placeId, useApp } from '../store';
import { fmtKm } from '../../lib/format';
import { haversineM } from '../../lib/geo';
import { BookmarkIcon, CloseIcon, DirectionsIcon } from './icons';

export default function PlaceCard() {
  const { state, dispatch } = useApp();
  const sel = state.explore.selection;
  if (!sel || state.explore.directionOpen) return null;

  const from = state.explore.location ?? state.explore.origin;
  const dist = haversineM(from, sel.center);
  const saved = state.explore.saved.some((p) => placeId(p) === placeId(sel));
  const route = state.explore.route;
  const eta = state.explore.routeLoading ? '…' : route ? `${Math.round(route.duration_min)} min` : '—';

  return (
    <section className="bottom-sheet" aria-label={sel.name}>
      <header className="sheet-head">
        <div className="sheet-title">
          <h2>{sel.name}</h2>
          <p className="sheet-sub">
            {sel.subcategory || sel.category}
            <span className="dot-sep" />
            {fmtKm(dist / 1000)} away
          </p>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => dispatch({ type: 'SELECT_PLACE', selection: null })}
          aria-label="Close place"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="eta-strip">
        <span className="eta-big">{eta}</span>
        <span className="eta-note">
          drive time
          {route && <em>{fmtKm(route.distance_km)}</em>}
        </span>
      </div>

      <div className="sheet-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => dispatch({ type: 'SET_DIRECTIONS_OPEN', open: true })}
        >
          <DirectionsIcon /> Directions
        </button>
        <button
          type="button"
          className={`btn${saved ? ' saved' : ''}`}
          onClick={() =>
            dispatch(saved ? { type: 'UNSAVE_PLACE', id: placeId(sel) } : { type: 'SAVE_PLACE', place: sel })
          }
          aria-pressed={saved}
        >
          <BookmarkIcon /> {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </section>
  );
}
