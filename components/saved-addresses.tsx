"use client";
import { useEffect, useState } from "react";
import { cleanSavedPlace, type SavedPlace } from "@/lib/rebook";

export default function SavedAddresses({ owner, from, to, onPick }: {
  owner: string; from: SavedPlace; to: SavedPlace;
  onPick: (field: "from" | "to", place: SavedPlace) => void;
}) {
  const key = `avenyn-addresses-v1:${owner}`;
  const [places, setPlaces] = useState<Record<string, SavedPlace>>({});
  const [field, setField] = useState<"from" | "to">("from");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "{}");
      const next: Record<string, SavedPlace> = {};
      for (const name of ["Hem", "Jobb"]) {
        const place = cleanSavedPlace(stored?.[name]);
        if (place) next[name] = place;
      }
      setPlaces(next);
    } catch { setPlaces({}); }
    setReady(true);
  }, [key]);
  const save = (next: Record<string, SavedPlace>) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setPlaces(next);
      setNotice("Sparat på den här enheten.");
    } catch { setNotice("Adressen kunde inte sparas. Tillåt lokal lagring i webbläsaren."); }
  };
  const current = cleanSavedPlace(field === "from" ? from : to);
  const canSave = ready && current && Number.isFinite(current.lat) && Number.isFinite(current.lng);
  return <details className="savedAddresses">
    <summary>Mina adresser · Hem och Jobb</summary>
    <p>Spara valda adresser på den här enheten. Du kan ta bort dem här.</p>
    <label>Använd som <select value={field} onChange={e => setField(e.target.value as "from" | "to")}>
      <option value="from">Hämtadress</option><option value="to">Destination</option>
    </select></label>
    {["Hem", "Jobb"].map(name => <div className="savedAddressRow" key={name}>
      <div><strong>{name}</strong><small>{places[name]?.label || "Ingen adress sparad"}</small></div>
      {places[name] && <button type="button" onClick={() => { onPick(field, places[name]); setNotice(`${name} valt som ${field === "from" ? "hämtadress" : "destination"}.`); }}>Välj</button>}
      <button type="button" disabled={!canSave} onClick={() => current && save({ ...places, [name]: current })}>{places[name] ? "Ersätt" : "Spara"}</button>
      {places[name] && <button type="button" aria-label={`Ta bort ${name}`} onClick={() => { const next = { ...places }; delete next[name]; save(next); }}>Ta bort</button>}
    </div>)}
    <small>Välj först en fullständig adress i bokningen. Spara använder din valda {field === "from" ? "hämtadress" : "destination"}.</small>
    {notice && <p role="status">{notice}</p>}
  </details>;
}
