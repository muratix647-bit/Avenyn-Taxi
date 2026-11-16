export const dynamic = "force-dynamic";
const TTL = 10 * 60 * 1000;
let cached: { body: Record<string, unknown>; expires: number } | undefined;
let pending: Promise<Record<string, unknown>> | undefined;
let retryAfter = 0;
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
async function lookup() {
  const key = process.env.GOOGLE_WEATHER_API_KEY;
  if (!key) throw new Error("not_configured");
  const response = await fetch("https://weather.googleapis.com/v1/forecast/days:lookup?location.latitude=57.7089&location.longitude=11.9746&unitsSystem=METRIC&languageCode=sv&days=7&pageSize=7", {
    headers: { "X-Goog-Api-Key": key }, signal: AbortSignal.timeout(8000), cache: "no-store",
  });
  if (!response.ok) { console.warn("Weather forecast status", response.status); throw new Error("provider_unavailable"); }
  const data = await response.json() as any;
  if (!Array.isArray(data.forecastDays)) throw new Error("invalid_forecast");
  const days = data.forecastDays.slice(0,7).map((day: any) => {
    const d = day.displayDate;
    if (!d || !Number.isInteger(d.year) || !Number.isInteger(d.month) || !Number.isInteger(d.day)) throw new Error("invalid_date");
    const max = day.maxTemperature?.unit === "CELSIUS" ? number(day.maxTemperature.degrees) : null;
    const min = day.minTemperature?.unit === "CELSIUS" ? number(day.minTemperature.degrees) : null;
    if (max === null || min === null) throw new Error("invalid_temperature");
    const daytime = day.daytimeForecast;
    return { date: `${d.year}-${String(d.month).padStart(2,"0")}-${String(d.day).padStart(2,"0")}`, max, min,
      description: typeof daytime?.weatherCondition?.description?.text === "string" ? daytime.weatherCondition.description.text.slice(0,160) : "",
      precipitationPercent: number(daytime?.precipitation?.probability?.percent) };
  });
  if (days.length !== 7) throw new Error("incomplete_forecast");
  const body = { city: "Göteborg", days };
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
