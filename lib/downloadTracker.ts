// how many clients can be hammering the server with base64 chunk requests simultaneously
// bump this up if your server has RAM to spare, lower it if it starts sweating
export const BASE64_DOWNLOAD_LIMIT = 3

// attach to global so it survives Next.js hot reloads without resetting to 0
const g = global as typeof global & { _activeBase64Downloads?: number }
if (g._activeBase64Downloads === undefined) g._activeBase64Downloads = 0

export const downloadTracker = {
  get active() { return g._activeBase64Downloads! },
  increment() { g._activeBase64Downloads!++ },
  decrement() { if (g._activeBase64Downloads! > 0) g._activeBase64Downloads!-- },
  // client checks this before deciding whether to use base64 or Capacitor download
  available() { return g._activeBase64Downloads! < BASE64_DOWNLOAD_LIMIT },
}
