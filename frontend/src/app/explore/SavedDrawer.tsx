import { useState } from 'react';
import { placeId, useApp } from '../store';
import type { PoiResult } from '../../lib/types';
import { BookmarkIcon, CloseIcon } from './icons';

export default function SavedDrawer() {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const saved = state.explore.saved;

  const select = (p: PoiResult) => {
    dispatch({ type: 'SELECT_PLACE', selection: p });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="rail-fab saved-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Saved places"
        aria-expanded={open}
      >
        <BookmarkIcon />
        {saved.length > 0 && <span className="fab-badge">{saved.length}</span>}
      </button>

      {open && (
        <aside className="saved-drawer" aria-label="Saved places">
          <header className="saved-head">
            <h2>Saved places</h2>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close saved">
              <CloseIcon />
            </button>
          </header>
          {saved.length === 0 ? (
            <p className="saved-empty">Tap the bookmark on any place card to save it here.</p>
          ) : (
            <ul className="saved-list">
              {saved.map((p) => (
                <li key={placeId(p)}>
                  <button type="button" className="saved-item" onClick={() => select(p)}>
                    <span className="saved-name">{p.name}</span>
                    <span className="saved-sub">
                      {p.subcategory || p.category}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mini"
                    onClick={() => dispatch({ type: 'UNSAVE_PLACE', id: placeId(p) })}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
    </>
  );
}
