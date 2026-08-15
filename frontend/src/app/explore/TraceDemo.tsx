import { useEffect } from 'react';
import { DEFAULT_DEST, DEFAULT_ORIGIN, useApp } from '../store';
import { api } from '../../lib/api';
import { genTrace } from '../../lib/geo';
import { animatePolyline } from '../../lib/animate';
import type { TraceResult } from '../../lib/types';

export default function TraceDemo() {
  const { state, dispatch } = useApp();
  const open = state.explore.traceOpen;

  useEffect(() => {
    if (!open) return;
    const a = state.explore.origin ?? DEFAULT_ORIGIN;
    const b = state.explore.destination ?? DEFAULT_DEST;
    const trace = genTrace(a, b, 48);
    let alive = true;
    api.trace(trace, 'auto').then((r) => {
      if (!alive || !r.ok) return;
      const t = r.body as TraceResult;
      dispatch({ type: 'SET_TRACE', trace: { geometry: t.geometry, raw: trace, matched: t.matched_points } });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const t = state.explore.trace;
    if (!t || !open) return;
    return animatePolyline(t.geometry, 5, (partial) => {
      dispatch({ type: 'SET_OVERLAYS', overlays: { trace: { ...t, geometry: partial } } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.explore.trace, open]);

  return null;
}
