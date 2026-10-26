/** Logo d'e-mail : uniquement un fichier de marque de cet événement, jamais une photo de souhait. */
export function isBrandLogoUrl(url: string, eventId: string, buckets: string[], emulator: boolean): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  const storageHost = parsed.protocol === "https:" && parsed.hostname === "firebasestorage.googleapis.com";
  const emulatorHost = emulator && parsed.protocol === "http:" && parsed.hostname === "127.0.0.1" && parsed.port === "9199";
  if (!storageHost && !emulatorHost) return false;
  const match = parsed.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match) return false;
  const bucket = decodeURIComponent(match[1]);
  const objectPath = decodeURIComponent(match[2]);
  if (!buckets.includes(bucket)) return false;
  if (objectPath.includes("/wishes/")) return false;
  const prefix = `events/${eventId}/brand/`;
  if (!objectPath.startsWith(prefix)) return false;
  return /^[a-zA-Z0-9._-]{1,80}$/.test(objectPath.slice(prefix.length));
}
