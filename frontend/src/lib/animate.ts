import { decodePolyline, encodePolyline } from './geo';

export function animatePolyline(
  geometry: string,
  precision: number,
  onFrame: (partialGeometry: string) => void,
  frames = 42,
): () => void {
  const coords = decodePolyline(geometry, precision);
  if (coords.length < 2) {
    onFrame(geometry);
    return () => undefined;
  }
  const step = Math.max(1, Math.ceil(coords.length / frames));
  let i = step;
  let raf = 0;
  const tick = () => {
    const n = Math.min(coords.length, i);
    onFrame(encodePolyline(coords.slice(0, n), precision));
    if (n < coords.length) {
      i += step;
      raf = requestAnimationFrame(tick);
    }
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
