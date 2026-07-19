export function normaliseSystemDirectoryAlias(path: string, platform = process.platform): string {
  // macOS exposes these ordinary system directories through /private aliases; Linux does not.
  if (platform !== "darwin") return path;
  if (path === "/tmp" || path.startsWith("/tmp/")) return `/private${path}`;
  if (path === "/var" || path.startsWith("/var/")) return `/private${path}`;
  return path;
}
