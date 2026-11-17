const GOOGLE_AVATAR_HOSTS = [
  "googleusercontent.com",
  "google.com",
  "ggpht.com",
];

function isGoogleAvatarHost(hostname: string) {
  const host = hostname.toLowerCase();
  return GOOGLE_AVATAR_HOSTS.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * Google serves profile photos at whatever size the URL asks for. Sign-in
 * tokens usually carry `=s96-c`, which looks soft in 44-64px avatars, so ask
 * for a crisp square instead. Non-Google URLs are returned untouched, and
 * anything that is not an http(s) URL is rejected so it never reaches an img.
 */
export function resolveAvatarUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  // Uploaded photos are served by this app from a root-relative path.
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return undefined;
  }

  if (!isGoogleAvatarHost(parsed.hostname)) return trimmed;

  return trimmed.replace(/=(?:s\d+|w\d+-h\d+)(?:-[a-z0-9]+)*$/i, "=s256-c");
}
