import { useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import { DEFAULT_ORIGIN, useApp } from '../store';
import { api } from '../../lib/api';
import { fmtLatLon } from '../../lib/geo';
import type { IsochroneFeature, LatLng } from '../../lib/types';

export default function IsoBubble({ mapRef }: { mapRef: { current: maplibregl.Map | null } }) {
  const { state, dispatch } = useApp();
  const open = state.explore.isoOpen;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !open) return;
    const center = state.explore.isoCenter ?? state.explore.location ?? DEFAULT_ORIGIN;
    const el = document.createElement('div');
    el.className = 'iso-bubble-marker';
    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([center.lon, center.lat])
      .addTo(map);
    let alive = true;

    const fetchIso = (c: LatLng) => {
      api.isochrone(fmtLatLon(c), '10', 'auto').then((r) => {
        if (!alive || !r.ok) return;
        dispatch({
          type: 'SET_ISO',
          isochrones: (r.body as { features: IsochroneFeature[] }).features,
          isoCenter: c,
        });
      });
    };

    marker.on('dragend', () => {
      const lg = marker.getLngLat();
      fetchIso({ lat: lg.lat, lon: lg.lng });
    });
    fetchIso(center);

    return () => {
      alive = false;
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {open && (
        <div className="iso-tip" role="status">
          Drag the bubble — how far in 10 min?
        </div>
      )}
    </>
  );
}
