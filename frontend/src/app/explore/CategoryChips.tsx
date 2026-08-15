import { useEffect, useState } from 'react';
import { DEFAULT_ORIGIN, useApp } from '../store';
import { api } from '../../lib/api';
import type { PoiResult } from '../../lib/types';
import { CarIcon, CrossIcon, FoodIcon, TreeIcon } from './icons';

const CATS = [
  { key: 'fuel', label: 'Fuel', icon: CarIcon },
  { key: 'restaurant', label: 'Food', icon: FoodIcon },
  { key: 'hospital', label: 'Care', icon: CrossIcon },
  { key: 'park', label: 'Park', icon: TreeIcon },
];

const RADIUS = 2500;

export default function CategoryChips() {
  const { state, dispatch } = useApp();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const center = state.explore.location ?? DEFAULT_ORIGIN;
  const key = `${center.lat.toFixed(4)},${center.lon.toFixed(4)}`;

  useEffect(() => {
    let alive = true;
    Promise.all(
      CATS.map(async (c) => {
        const r = await api.poiNearby(center.lat, center.lon, RADIUS, undefined, 100, c.key);
        return { key: c.key, n: r.ok ? (r.body as { results: PoiResult[] }).results.length : 0 };
      }),
    ).then((rows) => {
      if (alive) setCounts(Object.fromEntries(rows.map((x) => [x.key, x.n])));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const open = async (sub: string) => {
    setLoading(sub);
    const r = await api.poiNearby(center.lat, center.lon, RADIUS, undefined, 100, sub);
    setLoading(null);
    if (!r.ok) return;
    dispatch({ type: 'SET_NEARBY', nearby: (r.body as { results: PoiResult[] }).results });
    dispatch({ type: 'SET_FLYTO', flyTo: { lat: center.lat, lon: center.lon, zoom: 14, nonce: Date.now() } });
  };

  return (
    <div className="chips-row" role="group" aria-label="What's near you">
      {CATS.map((c) => (
        <button
          key={c.key}
          type="button"
          className="cat-chip"
          onClick={() => void open(c.key)}
          aria-busy={loading === c.key}
        >
          <c.icon className="cat-chip-icon" />
          <span>{c.label}</span>
          <em className="cat-count">{loading === c.key ? '…' : (counts[c.key] ?? '–')}</em>
        </button>
      ))}
    </div>
  );
}
