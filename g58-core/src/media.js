export function mediaResponseHeaders(isPublic) {
  return {
    "Cache-Control": isPublic ? "public, max-age=86400" : "private, no-store",
    "Content-Disposition": "inline",
    "Cross-Origin-Resource-Policy": isPublic ? "cross-origin" : "same-origin",
  };
}
