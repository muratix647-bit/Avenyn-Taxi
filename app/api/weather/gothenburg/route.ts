export const dynamic = "force-dynamic";
const TTL = 10 * 60 * 1000;
let cached: { body: Record<string, unknown>; expires: number } | undefined;
let pending: Promise<Record<string, unknown>> | undefined;
let retryAfter = 0;
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
async function lookup() {
  const key = process.env.GOOGLE_WEATHER_API_KEY;
  if (!key) throw new Error("not_configured");
  const response = await fetch("https://weather.googleapis.com/v1/currentConditions:lookup?location.latitude=57.7089&location.longitude=11.9746&unitsSystem=METRIC&languageCode=sv", {
    headers: { "X-Goog-Api-Key": key }, signal: AbortSignal.timeout(8000), cache: "no-store",
  });
  if (!response.ok) { console.warn("Weather provider status", response.status); throw new Error("provider_unavailable"); }
  const data = await response.json() as any;
  const temperature = number(data.temperature?.degrees);
  if (temperature === null || data.temperature?.unit !== "CELSIUS" || !Number.isFinite(Date.parse(data.currentTime))) throw new Error("invalid_weather");
  const body = { city: "Göteborg", currentTime: data.currentTime,
    temperature, feelsLike: number(data.feelsLikeTemperature?.degrees),
    description: typeof data.weatherCondition?.description?.text === "string" ? data.weatherCondition.description.text.slice(0,160) : "",
    windKmh: data.wind?.speed?.unit === "KILOMETERS_PER_HOUR" ? number(data.wind.speed.value) : null,
    precipitationPercent: number(data.precipitation?.probability?.percent),
  };
  cached = { body, expires: Date.now() + TTL };
  return body;
}
export async function GET() {
  try {
    if (cached && cached.expires <= Date.now()) cached = undefined;
    if (!cached && Date.now() < retryAfter) throw new Error("cooldown");
    if (!cached && !pending) pending = lookup().catch(error => { retryAfter = Date.now() + 60000; throw error; }).finally(() => { pending = undefined; });
    const body = cached?.body ?? await pending;
    return Response.json(body, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch {
    return Response.json({ error: "Vädret är tillfälligt otillgängligt" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "60" } });
  }
}
