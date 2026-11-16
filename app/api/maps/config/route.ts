// This endpoint deliberately exposes only a browser-restricted Maps key.
// Never fall back to a server, Firebase or Android Navigation key.
export async function GET() {
  const browserKey = process.env.GOOGLE_MAPS_BROWSER_KEY || "";
  return Response.json({ browserKey, provider: browserKey ? "google" : "openstreetmap" },
    { headers: { "Cache-Control": "no-store" } });
}
