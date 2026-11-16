"use client";
import { useEffect, useState } from "react";
import { CloudSun } from "lucide-react";
import styles from "./gothenburg-weather.module.css";
type Weather = { temperature: number; feelsLike: number | null; description: string; windKmh: number | null; precipitationPercent: number | null; currentTime: string };
type ForecastDay = { date: string; max: number; min: number; description: string; precipitationPercent: number | null };
export default function GothenburgWeather() {
  const [days, setDays] = useState<ForecastDay[]>([]);
  const [forecastFailed, setForecastFailed] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/weather/gothenburg", { signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (typeof data.temperature !== "number") throw new Error("invalid");
        if (!controller.signal.aborted) { setWeather(data); setFailed(false); }
      } catch { if (!controller.signal.aborted) { setWeather(null); setFailed(true); } }
    };
    const refreshWeek = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/weather/gothenburg/week", { signal: controller.signal });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json();
        if (!Array.isArray(data.days) || data.days.length !== 7) throw new Error("invalid");
        if (!controller.signal.aborted) { setDays(data.days); setForecastFailed(false); }
      } catch { if (!controller.signal.aborted) { setDays([]); setForecastFailed(true); } }
    };
    const refreshAll = () => { void refresh(); void refreshWeek(); };
    refreshAll();
    const interval = setInterval(refreshAll, 600000);
    document.addEventListener("visibilitychange", refreshAll);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener("visibilitychange", refreshAll); };
  }, []);
  return <aside className={styles.card} aria-label="Väder i Göteborg">
    <details>
      <summary className={styles.summary}><CloudSun size={18} aria-hidden="true" /><strong>Göteborg</strong><span>{weather ? `${Math.round(weather.temperature)}°C · ${weather.description}` : failed ? "Vädret är tillfälligt otillgängligt" : "Hämtar väder…"}</span><small>7 dagar ▾</small></summary>
      {weather && <div className={styles.details}>
        {weather.feelsLike !== null && <span>Känns som <b>{Math.round(weather.feelsLike)}°C</b></span>}
        {weather.windKmh !== null && <span>Vind <b>{Math.round(weather.windKmh / 3.6)} m/s</b></span>}
        {weather.precipitationPercent !== null && <span>Nederbördsrisk <b>{weather.precipitationPercent}%</b></span>}
        <span>Väderdata kl. {new Date(weather.currentTime).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" })}</span>
      </div>}
    <section aria-label="Sjudagarsprognos" className={styles.forecast}>
      <h3>Göteborg · kommande 7 dagar</h3>
      {days.length ? <div className={styles.week}>{days.map(day => <article key={day.date} className={styles.day}>
        <time dateTime={day.date}>{new Date(day.date + "T12:00:00Z").toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Stockholm" })}</time>
        <strong>{Math.round(day.max)}° <span>/ {Math.round(day.min)}°</span></strong>
        <span>{day.description}</span>
        {day.precipitationPercent !== null && <small>Nederbörd dagtid {day.precipitationPercent}%</small>}
      </article>)}</div> : <p>{forecastFailed ? "Veckoprognosen är tillfälligt otillgänglig." : "Hämtar veckoprognos…"}</p>}
      <p className={styles.legend}>Temperatur: högsta / lägsta</p>
    </section>
    </details>
    <footer className={styles.attribution}><span className={styles.google} translate="no">Google Maps</span><span>Source: Includes weather data from Google</span></footer>
  </aside>;
}
