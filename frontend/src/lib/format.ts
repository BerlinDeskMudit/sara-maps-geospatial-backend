export const fmtKm = (km: number) => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
};

export const fmtMin = (min: number) => {
  const s = Math.round(min * 60);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem} s`;
  if (rem === 0) return `${m} min`;
  return `${m} min ${rem} s`;
};

export const fmtMs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`);
