"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

const requestTypes = [
  "Budkörning",
  "Arbetsresa via Försäkringskassan",
  "Resa via försäkringsbolag",
  "Hjälp att planera en försäkringsresa",
];

export default function ServiceRequestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const type = String(data.get("type") || "");
    const route = String(data.get("route") || "");
    const requestedAt = String(data.get("requestedAt") || "");
    const payer = String(data.get("payer") || "");
    const details = String(data.get("details") || "");
    const message = [
      `Tjänst: ${type}`,
      `Från och till: ${route}`,
      requestedAt && `Önskat datum/tid: ${requestedAt}`,
      payer && `Företag/försäkringsgivare/referens: ${payer}`,
      details && `Övrigt: ${details}`,
    ].filter(Boolean).join("\n");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          message,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Förfrågan kunde inte skickas.");
      form.reset();
      setStatus("sent");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Förfrågan kunde inte skickas.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="serviceRequestSuccess" role="status">
        <CheckCircle2 />
        <div>
          <b>Förfrågan är skickad</b>
          <p>Vi återkommer med besked. Förfrågan är inte ett beslut om ersättning eller en bekräftad resa.</p>
        </div>
        <button type="button" onClick={() => setStatus("idle")}>Skicka en ny</button>
      </div>
    );
  }

  return (
    <form className="serviceRequestForm" onSubmit={submit}>
      <div className="serviceRequestFormIntro">
        <small>SKICKA FÖRFRÅGAN</small>
        <h3>Bud eller försäkringsresa</h3>
        <p>Fyll i grunduppgifterna så kontaktar vi dig om pris, underlag och tillgänglighet.</p>
      </div>
      <label className="serviceFormWide">
        <span>Vad gäller förfrågan? *</span>
        <select name="type" required defaultValue="">
          <option value="" disabled>Välj tjänst</option>
          {requestTypes.map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <label>
        <span>Namn *</span>
        <input name="name" required autoComplete="name" />
      </label>
      <label>
        <span>Telefon *</span>
        <input name="phone" type="tel" required autoComplete="tel" />
      </label>
      <label>
        <span>E-post *</span>
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        <span>Önskat datum och tid</span>
        <input name="requestedAt" type="datetime-local" />
      </label>
      <label className="serviceFormWide">
        <span>Från och till *</span>
        <input name="route" required placeholder="Hämtadress och destination" />
      </label>
      <label className="serviceFormWide">
        <span>Företag, försäkringsgivare eller referens</span>
        <input name="payer" placeholder="Valfritt – om du redan har godkännande" />
      </label>
      <label className="serviceFormWide">
        <span>Övrig praktisk information</span>
        <textarea name="details" rows={3} placeholder="Till exempel paketets storlek, antal resenärer eller önskad hämtningstid" />
      </label>
      <p className="servicePrivacy">Skriv inte personnummer, diagnos eller andra känsliga medicinska uppgifter här.</p>
      <button className="serviceSubmit" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Skickar…" : "Skicka förfrågan"} <Send />
      </button>
      {status === "error" && <p className="serviceFormError" role="alert">{error}</p>}
    </form>
  );
}
