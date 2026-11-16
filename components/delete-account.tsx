"use client";


import {AppText} from "@/components/app-language";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";

export default function DeleteAccount({
  accessToken,
  kind,
  onDeleted,
}: {
  accessToken: string;
  kind: "customer" | "driver";
  onDeleted: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const remove = async () => {
    const account = kind === "driver" ? "förarkontot" : "kundkontot";
    if (
      !window.confirm(
        `Vill du radera ${account}? Du blir utloggad och kan inte ångra detta.`,
      )
    )
      return;
    if (!window.confirm("Bekräfta en sista gång att kontot ska raderas.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/delete-account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kind }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error || "Kontot kunde inte raderas.");
      await onDeleted();
      window.location.replace("/?account_deleted=1");
    } catch (error: any) {
      setMessage(error?.message || "Kontot kunde inte raderas.");
      setBusy(false);
    }
  };

  return (
    <section className="appAccountSettings" aria-labelledby={`${kind}-account-title`}>
      <div>
        <ShieldCheck />
        <span>
          <h2 id={`${kind}-account-title`}><AppText text={"Konto och integritet"} /></h2>
          <p>
            <AppText text={"Läs hur Avenyn Taxi hanterar dina uppgifter eller radera kontot."} /></p>
        </span>
      </div>
      <nav aria-label="Konto och integritet">
        <a href="/bokningsvillkor"><AppText text={"Bokningsvillkor"} /></a>
        <a href="/integritet"><AppText text={"Integritetspolicy"} /></a>
        <a href="/radera-konto"><AppText text={"Information om kontoradering"} /></a>
        <button type="button" onClick={remove} disabled={busy}>
          <Trash2 /> {<AppText text={busy ? "Raderar konto…" : "Radera konto"} />}
        </button>
      </nav>
      {message && <p className="appAccountError" role="alert">{<AppText text={message} />}</p>}
    </section>
  );
}
