"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Mail, Phone, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

type DriverForm = {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
  taxiDriverLicenseNumber: string;
  approved: boolean;
};

const emptyDriver = (): DriverForm => ({
  fullName: "",
  email: "",
  phone: "",
  taxiDriverLicenseNumber: "",
  approved: true,
});

export default function DriverEditorDialog({
  open,
  driver,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  driver?: any | null;
  onOpenChange: (open: boolean) => void;
  onSave: (body: any) => Promise<any>;
}) {
  const [form, setForm] = useState<DriverForm>(emptyDriver);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(
      driver
        ? {
            id: driver.id,
            fullName: driver.name || driver.full_name || "",
            email: driver.email || "",
            phone: driver.phone || "",
            taxiDriverLicenseNumber:
              driver.taxi_driver_license_number || "",
            approved: Boolean(driver.approved && driver.active !== false),
          }
        : emptyDriver(),
    );
    setError("");
  }, [open, driver]);

  const change = (next: Partial<DriverForm>) =>
    setForm((current) => ({ ...current, ...next }));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await onSave({ action: "save_driver", driver: form });
      if (!result?.ok) {
        setError(result?.error || "Föraren kunde inte sparas.");
        return;
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="driverEditorDialog">
        <DialogHeader>
          <DialogTitle>
            <UserRound /> {driver ? "Redigera förare" : "Lägg till förare"}
          </DialogTitle>
          <DialogDescription>
            {driver
              ? "Uppdatera förarens kontaktuppgifter och kontoåtkomst."
              : "Skapa föraren här. En personlig länk skickas så att föraren kan välja sitt eget lösenord."}
          </DialogDescription>
        </DialogHeader>

        <div className="driverEditorFields">
          <label>
            <span>
              <UserRound /> Namn *
            </span>
            <input
              autoFocus
              value={form.fullName}
              onChange={(event) => change({ fullName: event.target.value })}
              placeholder="Förarens för- och efternamn"
            />
          </label>
          <label>
            <span>
              <Mail /> E-post *
            </span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => change({ email: event.target.value })}
              placeholder="namn@exempel.se"
            />
          </label>
          <label>
            <span>
              <Phone /> Mobilnummer *
            </span>
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => change({ phone: event.target.value })}
              placeholder="070 123 45 67"
            />
          </label>
          <label>
            <span>
              <BadgeCheck /> Taxiförarlegitimation
            </span>
            <input
              value={form.taxiDriverLicenseNumber}
              onChange={(event) =>
                change({ taxiDriverLicenseNumber: event.target.value })
              }
              placeholder="Legitimationsnummer"
              autoComplete="off"
            />
            <small className="driverFieldHelp">
              Numret visas endast i Admin / Dispatch.
            </small>
          </label>
          <div className="driverAccessSetting">
            <div>
              <b>Aktivt och godkänt konto</b>
              <small>
                Avstängt läge hindrar föraren från att ta emot körningar.
              </small>
            </div>
            <Switch
              checked={form.approved}
              onCheckedChange={(approved) => change({ approved })}
              aria-label="Aktivt och godkänt konto"
            />
          </div>
        </div>

        {error && (
          <div className="bookingEditError" role="alert">
            {error}
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            className="editCancelButton"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="editSaveButton"
            disabled={busy}
            onClick={save}
          >
            {busy ? "Sparar…" : driver ? "Spara ändringar" : "Lägg till förare"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
