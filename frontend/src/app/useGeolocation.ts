import { useEffect, useState } from 'react';
import type { LatLng } from '../lib/types';

interface GeoState {
  granted: boolean;
  coords: LatLng | null;
}

export function useGeolocation(): GeoState {
  const [geo, setGeo] = useState<GeoState>({ granted: false, coords: null });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      if (alive) setGeo((g) => (g.coords ? g : { granted: false, coords: null }));
    }, 6000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!alive) return;
        clearTimeout(timer);
        setGeo({
          granted: true,
          coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
        });
      },
      () => {
        if (!alive) return;
        clearTimeout(timer);
        setGeo({ granted: false, coords: null });
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return geo;
}
