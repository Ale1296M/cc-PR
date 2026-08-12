export type CapturedPosition = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

/** Ask the browser for a location. Resolves to null when unavailable or denied. */
export function capturePosition(timeoutMs = 10000): Promise<CapturedPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export function formatDuration(startISO: string, endISO: string) {
  const mins = Math.max(0, Math.round((+new Date(endISO) - +new Date(startISO)) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}
