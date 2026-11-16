"use client";

import {AppText} from "@/components/app-language";
import { useEffect, useState } from "react";

export default function DriverDailyGoal({ owner, summary, updatedAt }: {
  owner: string; summary: { revenue?: number; trips?: number }; updatedAt: number | null;
}) {
  const [goal, setGoal] = useState(0);
  const [draft, setDraft] = useState("3000");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(`avenyn-daily-goal:${owner}`));
      if (Number.isFinite(saved) && saved > 0 && saved <= 100000) { setGoal(saved); setDraft(String(saved)); }
    } catch { /* The card remains usable without persistent storage. */ }
  }, [owner]);
  const revenue = Math.max(0, Number(summary.revenue) || 0);
  const progress = goal ? Math.min(100, Math.round(revenue / goal * 100)) : 0;
  const money = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 0 });
  return <section className="driverGoalCard" aria-label="Dagens inkört och dagsmål">
    <div className="driverGoalRing" role="img" aria-label={goal ? `${progress} procent av dagsmålet` : "Inget dagsmål valt"}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" className="goalTrack"/><circle cx="50" cy="50" r="42" className="goalProgress" pathLength="100" strokeDasharray={`${progress} 100`}/></svg>
      <strong>{<AppText text={goal && updatedAt ? `${progress}%` : "—"} />}</strong>
    </div>
    <div className="driverGoalBody"><small><AppText text={"DAGENS INKÖRT"} /></small><h2>{<AppText text={updatedAt ? `${money(revenue)} kr` : "Hämtar dagens körningar…"} />}</h2>
      <p>{<AppText text={Number(summary.trips || 0)} />} <AppText text={"avslutade körningar · före provision"} /></p>
      {goal > 0 && <p>{<AppText text={revenue >= goal ? "Dagsmålet uppnått!" : `${money(Math.max(0, goal - revenue))} kr kvar till målet`} />} <AppText text={"· mål"} />{<AppText text={money(goal)} />} <AppText text={"kr"} /></p>}
      <button type="button" onClick={() => setEditing(!editing)}>{<AppText text={goal ? "Ändra dagsmål" : "Sätt ditt dagsmål"} />}</button>
      {editing && <form onSubmit={e => {
        e.preventDefault();
        const value = Number(draft.replace(",", "."));
        if (!Number.isFinite(value) || value <= 0 || value > 100000) { setError("Ange ett mål mellan 1 och 100 000 kr."); return; }
        try { localStorage.setItem(`avenyn-daily-goal:${owner}`, String(value)); setError(""); }
        catch { setError("Målet gäller nu men kunde inte sparas på enheten."); }
        setGoal(value); setEditing(false);
      }}><label><AppText text={"Dagsmål i kronor"} /><input type="number" min="1" max="100000" step="1" value={draft} onChange={e => setDraft(e.target.value)} /></label><button type="submit"><AppText text={"Spara mål"} /></button></form>}
      {error && <p role="alert">{<AppText text={error} />}</p>}
      <small>{<AppText text={updatedAt ? `Senast uppdaterat ${new Date(updatedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" })}. ` : ""} />}<AppText text={"Svensk kalenderdag. Målet sparas på den här enheten."} /></small>
    </div>
  </section>;
}
