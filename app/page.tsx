"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

type Driver = {
  id: string;
  full_name: string;
  phone: string | null;
  salary_percent: number | null;
  active: boolean | null;
  created_at?: string | null;
};

type Vehicle = {
  id: string;
  name: string;
  reg: string | null;
  status: string | null;
  driver_id: string | null;
  created_at?: string | null;
};

type Trip = {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  amount: number;
  source: string | null;
  trip_date: string;
  note: string | null;
  halda_row_id?: string | null;
  created_at?: string | null;
};

type Advance = {
  id: string;
  driver_id: string | null;
  amount: number;
  note: string | null;
  advance_date: string;
  created_at?: string | null;
};

type Cost = {
  id: string;
  vehicle_id: string | null;
  amount: number;
  type: string | null;
  note: string | null;
  cost_date: string;
  created_at?: string | null;
};

type DriverProfile = {
  id?: string;
  driver_id: string;
  full_address: string | null;
  personal_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
  cash_handled: number | null;
  cash_note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type HaldaImportRow = {
  id: string;
  trip_date: string;
  driver_id: string | null;
  vehicle_id: string | null;
  amount: number;
  meter_total: number | null;
  cash_amount: number | null;
  card_amount: number | null;
  source: string | null;
  shift_code: string | null;
  external_ref: string | null;
  note: string | null;
  processed: boolean | null;
  processed_trip_id: string | null;
  created_at?: string | null;
};

const COMPANY = {
  name: "Avenyn Taxi",
  legalName: "Citra Trans och Bilservice AB",
  city: "Göteborg",
  website: "avenyntaxi.se",
};

const DEFAULT_SALARY_PERCENT = 33;
const DEFAULT_CASH_NOTE =
  "Kontanthantering påverkar ej lönen, endast informationsrad";

const STATUS_OPTIONS = [
  "Aktiv",
  "På service",
  "Service bokad",
  "Uthyrd",
  "Offline",
];

const SOURCE_OPTIONS = [
  "Avenyn Taxi",
  "Uber",
  "Bolt",
  "Kontant",
  "Swish",
  "Halda M2",
];

const COST_TYPE_OPTIONS = [
  "Service",
  "Reparation",
  "Däck",
  "Tvätt",
  "Bränsle",
  "Försäkring",
  "Leasing",
  "Skatt",
  "Övrigt",
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function money(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString("sv-SE")} kr`;
}

function numberValue(value: string | number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function prettyDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("sv-SE");
}

function inRange(dateValue: string, fromDate: string, toDate: string) {
  return dateValue >= fromDate && dateValue <= toDate;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Page() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "magic">("login");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [profiles, setProfiles] = useState<DriverProfile[]>([]);
  const [haldaRows, setHaldaRows] = useState<HaldaImportRow[]>([]);

  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayString());

  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverSalaryPercent, setDriverSalaryPercent] =
    useState(DEFAULT_SALARY_PERCENT);

  const [vehicleName, setVehicleName] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState("Aktiv");
  const [vehicleDriverId, setVehicleDriverId] = useState("");

  const [tripVehicleId, setTripVehicleId] = useState("");
  const [tripDriverId, setTripDriverId] = useState("");
  const [tripAmount, setTripAmount] = useState("");
  const [tripSource, setTripSource] = useState("Avenyn Taxi");
  const [tripDate, setTripDate] = useState(todayString());
  const [tripNote, setTripNote] = useState("");

  const [advanceDriverId, setAdvanceDriverId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(todayString());
  const [advanceNote, setAdvanceNote] = useState("");

  const [costVehicleId, setCostVehicleId] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costType, setCostType] = useState("Service");
  const [costDate, setCostDate] = useState(todayString());
  const [costNote, setCostNote] = useState("");

  const [selectedPayrollDriverId, setSelectedPayrollDriverId] = useState("");

  const [editDriverId, setEditDriverId] = useState("");
  const [editDriverName, setEditDriverName] = useState("");
  const [editDriverPhone, setEditDriverPhone] = useState("");
  const [editDriverSalaryPercent, setEditDriverSalaryPercent] = useState("33");
  const [editDriverActive, setEditDriverActive] = useState(true);

  const [editVehicleId, setEditVehicleId] = useState("");
  const [editVehicleName, setEditVehicleName] = useState("");
  const [editVehicleReg, setEditVehicleReg] = useState("");
  const [editVehicleStatus, setEditVehicleStatus] = useState("Aktiv");
  const [editVehicleDriverId, setEditVehicleDriverId] = useState("");

  const [editTripId, setEditTripId] = useState("");
  const [editTripVehicleId, setEditTripVehicleId] = useState("");
  const [editTripDriverId, setEditTripDriverId] = useState("");
  const [editTripAmount, setEditTripAmount] = useState("");
  const [editTripSource, setEditTripSource] = useState("Avenyn Taxi");
  const [editTripDate, setEditTripDate] = useState(todayString());
  const [editTripNote, setEditTripNote] = useState("");

  const [editAdvanceId, setEditAdvanceId] = useState("");
  const [editAdvanceDriverId, setEditAdvanceDriverId] = useState("");
  const [editAdvanceAmount, setEditAdvanceAmount] = useState("");
  const [editAdvanceDate, setEditAdvanceDate] = useState(todayString());
  const [editAdvanceNote, setEditAdvanceNote] = useState("");

  const [editCostId, setEditCostId] = useState("");
  const [editCostVehicleId, setEditCostVehicleId] = useState("");
  const [editCostAmount, setEditCostAmount] = useState("");
  const [editCostType, setEditCostType] = useState("Service");
  const [editCostDate, setEditCostDate] = useState(todayString());
  const [editCostNote, setEditCostNote] = useState("");

  const [profileDriverId, setProfileDriverId] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profilePersonalNumber, setProfilePersonalNumber] = useState("");
  const [profileBankName, setProfileBankName] = useState("");
  const [profileBankAccount, setProfileBankAccount] = useState("");
  const [profileCashHandled, setProfileCashHandled] = useState("");
  const [profileCashNote, setProfileCashNote] = useState(DEFAULT_CASH_NOTE);

  const [haldaTripDate, setHaldaTripDate] = useState(todayString());
  const [haldaDriverId, setHaldaDriverId] = useState("");
  const [haldaVehicleId, setHaldaVehicleId] = useState("");
  const [haldaAmount, setHaldaAmount] = useState("");
  const [haldaMeterTotal, setHaldaMeterTotal] = useState("");
  const [haldaCashAmount, setHaldaCashAmount] = useState("");
  const [haldaCardAmount, setHaldaCardAmount] = useState("");
  const [haldaShiftCode, setHaldaShiftCode] = useState("");
  const [haldaExternalRef, setHaldaExternalRef] = useState("");
  const [haldaNote, setHaldaNote] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{
    type: "driver" | "vehicle" | "trip" | "advance" | "cost";
    id: string;
    label: string;
  } | null>(null);

  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState("");

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setPageError(
        "Supabase-miljövariabler saknas. Lägg till NEXT_PUBLIC_SUPABASE_URL och NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local."
      );
      setAuthReady(true);
      return;
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    setSupabase(client);

    client.auth.getSession().then(({ data, error }) => {
      if (error) {
        setAuthError(error.message);
      }
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession ?? null);
      setAuthReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    if (!supabase || !session) return;
    void loadAll();
  }, [supabase, session]);

  async function loadAll() {
    if (!supabase) return;
    setLoading(true);
    setPageError("");

    try {
      const [
        driversRes,
        vehiclesRes,
        tripsRes,
        advancesRes,
        costsRes,
        profilesRes,
        haldaRowsRes,
      ] = await Promise.all([
        supabase.from("drivers").select("*").order("full_name", { ascending: true }),
        supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
        supabase.from("trips").select("*").order("trip_date", { ascending: false }),
        supabase.from("advances").select("*").order("advance_date", { ascending: false }),
        supabase.from("costs").select("*").order("cost_date", { ascending: false }),
        supabase.from("driver_profiles").select("*").order("created_at", { ascending: true }),
        supabase
          .from("halda_import_rows")
          .select("*")
          .order("trip_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      const errors = [
        driversRes.error,
        vehiclesRes.error,
        tripsRes.error,
        advancesRes.error,
        costsRes.error,
        profilesRes.error,
        haldaRowsRes.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        throw new Error(errors.map((e) => e?.message).join(" | "));
      }

      const nextDrivers = (driversRes.data ?? []) as Driver[];
      const nextVehicles = (vehiclesRes.data ?? []) as Vehicle[];
      const nextTrips = (tripsRes.data ?? []) as Trip[];
      const nextAdvances = (advancesRes.data ?? []) as Advance[];
      const nextCosts = (costsRes.data ?? []) as Cost[];
      const nextProfiles = (profilesRes.data ?? []) as DriverProfile[];
      const nextHaldaRows = (haldaRowsRes.data ?? []) as HaldaImportRow[];

      setDrivers(nextDrivers);
      setVehicles(nextVehicles);
      setTrips(nextTrips);
      setAdvances(nextAdvances);
      setCosts(nextCosts);
      setProfiles(nextProfiles);
      setHaldaRows(nextHaldaRows);
      setLastLoadedAt(new Date().toISOString());

      if (!advanceDriverId && nextDrivers[0]) setAdvanceDriverId(nextDrivers[0].id);
      if (!selectedPayrollDriverId && nextDrivers[0]) {
        setSelectedPayrollDriverId(nextDrivers[0].id);
      }
      if (!tripDriverId && nextDrivers[0]) setTripDriverId(nextDrivers[0].id);
      if (!vehicleDriverId && nextDrivers[0]) setVehicleDriverId(nextDrivers[0].id);
      if (!profileDriverId && nextDrivers[0]) setProfileDriverId(nextDrivers[0].id);
      if (!haldaDriverId && nextDrivers[0]) setHaldaDriverId(nextDrivers[0].id);

      if (!tripVehicleId && nextVehicles[0]) setTripVehicleId(nextVehicles[0].id);
      if (!costVehicleId && nextVehicles[0]) setCostVehicleId(nextVehicles[0].id);
      if (!haldaVehicleId && nextVehicles[0]) setHaldaVehicleId(nextVehicles[0].id);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Kunde inte ladda data.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: () => Promise<void>, successText?: string) {
    setSaving(true);
    setPageError("");
    setPageSuccess("");

    try {
      await action();
      await loadAll();
      if (successText) setPageSuccess(successText);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Något gick fel.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    setLoginLoading(true);
    setAuthError("");
    setAuthMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) throw error;
      setAuthMessage("Inloggad.");
      setLoginPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Inloggning misslyckades.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    setLoginLoading(true);
    setAuthError("");
    setAuthMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: loginEmail.trim(),
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      if (error) throw error;
      setAuthMessage("Magic link skickad till din e-post.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Kunde inte skicka magic link.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setAuthMessage("Du har loggats ut.");
  }

  async function addDriver() {
    if (!supabase) return;
    if (!driverName.trim()) throw new Error("Fyll i förarens namn.");

    const salaryPercent =
      Number.isFinite(Number(driverSalaryPercent)) && Number(driverSalaryPercent) >= 0
        ? Number(driverSalaryPercent)
        : DEFAULT_SALARY_PERCENT;

    const { data, error } = await supabase
      .from("drivers")
      .insert({
        full_name: driverName.trim(),
        phone: driverPhone.trim() || null,
        salary_percent: salaryPercent,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    const newDriver = data as Driver;

    const profileRes = await supabase.from("driver_profiles").insert({
      driver_id: newDriver.id,
      full_address: null,
      personal_number: null,
      bank_name: null,
      bank_account: null,
      cash_handled: 0,
      cash_note: DEFAULT_CASH_NOTE,
    });

    if (profileRes.error) throw profileRes.error;

    setDriverName("");
    setDriverPhone("");
    setDriverSalaryPercent(DEFAULT_SALARY_PERCENT);
  }

  async function updateDriver() {
    if (!supabase) return;
    if (!editDriverId) throw new Error("Välj förare att redigera.");
    if (!editDriverName.trim()) throw new Error("Fyll i förarens namn.");

    const { error } = await supabase
      .from("drivers")
      .update({
        full_name: editDriverName.trim(),
        phone: editDriverPhone.trim() || null,
        salary_percent: numberValue(editDriverSalaryPercent),
        active: editDriverActive,
      })
      .eq("id", editDriverId);

    if (error) throw error;
  }

  async function addVehicle() {
    if (!supabase) return;
    if (!vehicleName.trim()) throw new Error("Fyll i bilens namn.");

    const { error } = await supabase.from("vehicles").insert({
      name: vehicleName.trim(),
      reg: vehicleReg.trim() || null,
      status: vehicleStatus,
      driver_id: vehicleDriverId || null,
    });

    if (error) throw error;

    setVehicleName("");
    setVehicleReg("");
    setVehicleStatus("Aktiv");
  }

  async function updateVehicle() {
    if (!supabase) return;
    if (!editVehicleId) throw new Error("Välj bil att redigera.");
    if (!editVehicleName.trim()) throw new Error("Fyll i bilens namn.");

    const { error } = await supabase
      .from("vehicles")
      .update({
        name: editVehicleName.trim(),
        reg: editVehicleReg.trim() || null,
        status: editVehicleStatus,
        driver_id: editVehicleDriverId || null,
      })
      .eq("id", editVehicleId);

    if (error) throw error;
  }

  async function addTrip() {
    if (!supabase) return;
    if (!tripVehicleId) throw new Error("Välj bil.");
    if (!tripDriverId) throw new Error("Välj förare.");
    if (!tripAmount || Number(tripAmount) <= 0) throw new Error("Fyll i giltigt belopp.");

    const { error } = await supabase.from("trips").insert({
      vehicle_id: tripVehicleId,
      driver_id: tripDriverId,
      amount: Number(tripAmount),
      source: tripSource,
      trip_date: tripDate,
      note: tripNote.trim() || null,
    });

    if (error) throw error;

    setTripAmount("");
    setTripSource("Avenyn Taxi");
    setTripDate(todayString());
    setTripNote("");
  }

  async function updateTrip() {
    if (!supabase) return;
    if (!editTripId) throw new Error("Välj resa att redigera.");
    if (!editTripVehicleId) throw new Error("Välj bil.");
    if (!editTripDriverId) throw new Error("Välj förare.");
    if (!editTripAmount || Number(editTripAmount) <= 0) {
      throw new Error("Fyll i giltigt belopp.");
    }

    const { error } = await supabase
      .from("trips")
      .update({
        vehicle_id: editTripVehicleId,
        driver_id: editTripDriverId,
        amount: Number(editTripAmount),
        source: editTripSource,
        trip_date: editTripDate,
        note: editTripNote.trim() || null,
      })
      .eq("id", editTripId);

    if (error) throw error;
  }

  async function addAdvance() {
    if (!supabase) return;
    if (!advanceDriverId) throw new Error("Välj förare.");
    if (!advanceAmount || Number(advanceAmount) <= 0) {
      throw new Error("Fyll i giltigt belopp.");
    }

    const { error } = await supabase.from("advances").insert({
      driver_id: advanceDriverId,
      amount: Number(advanceAmount),
      advance_date: advanceDate,
      note: advanceNote.trim() || null,
    });

    if (error) throw error;

    setAdvanceAmount("");
    setAdvanceDate(todayString());
    setAdvanceNote("");
  }

  async function updateAdvance() {
    if (!supabase) return;
    if (!editAdvanceId) throw new Error("Välj förskott att redigera.");
    if (!editAdvanceDriverId) throw new Error("Välj förare.");
    if (!editAdvanceAmount || Number(editAdvanceAmount) <= 0) {
      throw new Error("Fyll i giltigt belopp.");
    }

    const { error } = await supabase
      .from("advances")
      .update({
        driver_id: editAdvanceDriverId,
        amount: Number(editAdvanceAmount),
        advance_date: editAdvanceDate,
        note: editAdvanceNote.trim() || null,
      })
      .eq("id", editAdvanceId);

    if (error) throw error;
  }

  async function addCost() {
    if (!supabase) return;
    if (!costVehicleId) throw new Error("Välj bil.");
    if (!costAmount || Number(costAmount) <= 0) throw new Error("Fyll i giltigt belopp.");

    const { error } = await supabase.from("costs").insert({
      vehicle_id: costVehicleId,
      amount: Number(costAmount),
      type: costType,
      cost_date: costDate,
      note: costNote.trim() || null,
    });

    if (error) throw error;

    setCostAmount("");
    setCostType("Service");
    setCostDate(todayString());
    setCostNote("");
  }

  async function updateCost() {
    if (!supabase) return;
    if (!editCostId) throw new Error("Välj kostnad att redigera.");
    if (!editCostVehicleId) throw new Error("Välj bil.");
    if (!editCostAmount || Number(editCostAmount) <= 0) {
      throw new Error("Fyll i giltigt belopp.");
    }

    const { error } = await supabase
      .from("costs")
      .update({
        vehicle_id: editCostVehicleId,
        amount: Number(editCostAmount),
        type: editCostType,
        cost_date: editCostDate,
        note: editCostNote.trim() || null,
      })
      .eq("id", editCostId);

    if (error) throw error;
  }

  async function saveDriverProfile() {
    if (!supabase) return;
    if (!profileDriverId) throw new Error("Välj förare.");

    const existing = profiles.find((p) => p.driver_id === profileDriverId);

    if (existing?.id) {
      const { error } = await supabase
        .from("driver_profiles")
        .update({
          full_address: profileAddress.trim() || null,
          personal_number: profilePersonalNumber.trim() || null,
          bank_name: profileBankName.trim() || null,
          bank_account: profileBankAccount.trim() || null,
          cash_handled: numberValue(profileCashHandled),
          cash_note: profileCashNote.trim() || DEFAULT_CASH_NOTE,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("driver_profiles").insert({
      driver_id: profileDriverId,
      full_address: profileAddress.trim() || null,
      personal_number: profilePersonalNumber.trim() || null,
      bank_name: profileBankName.trim() || null,
      bank_account: profileBankAccount.trim() || null,
      cash_handled: numberValue(profileCashHandled),
      cash_note: profileCashNote.trim() || DEFAULT_CASH_NOTE,
    });

    if (error) throw error;
  }

  async function addHaldaRow() {
    if (!supabase) return;
    if (!haldaTripDate) throw new Error("Välj datum.");
    if (!haldaDriverId) throw new Error("Välj förare.");
    if (!haldaVehicleId) throw new Error("Välj bil.");
    if (!haldaAmount || Number(haldaAmount) <= 0) {
      throw new Error("Fyll i giltigt belopp.");
    }

    const { error } = await supabase.from("halda_import_rows").insert({
      trip_date: haldaTripDate,
      driver_id: haldaDriverId,
      vehicle_id: haldaVehicleId,
      amount: Number(haldaAmount),
      meter_total: haldaMeterTotal ? Number(haldaMeterTotal) : null,
      cash_amount: haldaCashAmount ? Number(haldaCashAmount) : null,
      card_amount: haldaCardAmount ? Number(haldaCardAmount) : null,
      source: "Halda M2",
      shift_code: haldaShiftCode.trim() || null,
      external_ref: haldaExternalRef.trim() || null,
      note: haldaNote.trim() || null,
      processed: false,
      processed_trip_id: null,
    });

    if (error) throw error;

    setHaldaTripDate(todayString());
    setHaldaAmount("");
    setHaldaMeterTotal("");
    setHaldaCashAmount("");
    setHaldaCardAmount("");
    setHaldaShiftCode("");
    setHaldaExternalRef("");
    setHaldaNote("");
  }

  async function processHaldaRow(rowId: string) {
    if (!supabase) return;

    const row = haldaRows.find((r) => r.id === rowId);
    if (!row) throw new Error("Halda-raden hittades inte.");
    if (row.processed) throw new Error("Halda-raden är redan behandlad.");

    const tripInsert = await supabase
      .from("trips")
      .insert({
        vehicle_id: row.vehicle_id,
        driver_id: row.driver_id,
        amount: Number(row.amount || 0),
        source: row.source || "Halda M2",
        trip_date: row.trip_date,
        note: row.note
          ? `Halda import · ${row.note}`
          : `Halda import${row.shift_code ? ` · Pass ${row.shift_code}` : ""}${
              row.external_ref ? ` · Ref ${row.external_ref}` : ""
            }`,
        halda_row_id: row.id,
      })
      .select()
      .single();

    if (tripInsert.error) throw tripInsert.error;

    const createdTrip = tripInsert.data as Trip;

    const haldaUpdate = await supabase
      .from("halda_import_rows")
      .update({
        processed: true,
        processed_trip_id: createdTrip.id,
      })
      .eq("id", row.id);

    if (haldaUpdate.error) throw haldaUpdate.error;
  }

  async function deleteDriver(id: string) {
    if (!supabase) return;

    const linkedTrips = trips.some((t) => t.driver_id === id);
    const linkedAdvances = advances.some((a) => a.driver_id === id);
    const linkedVehicles = vehicles.some((v) => v.driver_id === id);
    const linkedHalda = haldaRows.some((r) => r.driver_id === id);

    if (linkedTrips || linkedAdvances || linkedVehicles || linkedHalda) {
      throw new Error(
        "Förare kan inte tas bort eftersom den är kopplad till resor, förskott, Halda-rader eller bilar."
      );
    }

    const profile = profiles.find((p) => p.driver_id === id);
    if (profile?.id) {
      const profileDelete = await supabase.from("driver_profiles").delete().eq("id", profile.id);
      if (profileDelete.error) throw profileDelete.error;
    }

    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) throw error;
  }

  async function deleteVehicle(id: string) {
    if (!supabase) return;

    const linkedTrips = trips.some((t) => t.vehicle_id === id);
    const linkedCosts = costs.some((c) => c.vehicle_id === id);
    const linkedHalda = haldaRows.some((r) => r.vehicle_id === id);

    if (linkedTrips || linkedCosts || linkedHalda) {
      throw new Error(
        "Bil kan inte tas bort eftersom den är kopplad till resor, kostnader eller Halda-rader."
      );
    }

    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) throw error;
  }

  async function deleteTrip(id: string) {
    if (!supabase) return;

    const trip = trips.find((t) => t.id === id);
    if (trip?.halda_row_id) {
      const haldaReset = await supabase
        .from("halda_import_rows")
        .update({
          processed: false,
          processed_trip_id: null,
        })
        .eq("id", trip.halda_row_id);

      if (haldaReset.error) throw haldaReset.error;
    }

    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) throw error;
  }

  async function deleteAdvance(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("advances").delete().eq("id", id);
    if (error) throw error;
  }

  async function deleteCost(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("costs").delete().eq("id", id);
    if (error) throw error;
  }

  async function handleConfirmedDelete() {
    if (!confirmDelete) return;

    const current = confirmDelete;
    setConfirmDelete(null);

    if (current.type === "driver") {
      await runAction(() => deleteDriver(current.id), "Förare borttagen.");
      return;
    }

    if (current.type === "vehicle") {
      await runAction(() => deleteVehicle(current.id), "Bil borttagen.");
      return;
    }

    if (current.type === "trip") {
      await runAction(() => deleteTrip(current.id), "Resa borttagen.");
      return;
    }

    if (current.type === "advance") {
      await runAction(() => deleteAdvance(current.id), "Förskott borttaget.");
      return;
    }

    await runAction(() => deleteCost(current.id), "Kostnad borttagen.");
  }

  function printPayroll() {
    if (typeof window === "undefined") return;
    window.print();
  }

  const driverMap = useMemo(
    () => Object.fromEntries(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.driver_id, p])),
    [profiles]
  );

  const periodTrips = useMemo(
    () => trips.filter((t) => inRange(t.trip_date, fromDate, toDate)),
    [trips, fromDate, toDate]
  );

  const periodAdvances = useMemo(
    () => advances.filter((a) => inRange(a.advance_date, fromDate, toDate)),
    [advances, fromDate, toDate]
  );

  const periodCosts = useMemo(
    () => costs.filter((c) => inRange(c.cost_date, fromDate, toDate)),
    [costs, fromDate, toDate]
  );

  const totalIncome = useMemo(
    () => periodTrips.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [periodTrips]
  );

  const totalAdvances = useMemo(
    () => periodAdvances.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [periodAdvances]
  );

  const totalCosts = useMemo(
    () => periodCosts.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [periodCosts]
  );

  const estimatedSalaryBase = Math.round(totalIncome * (DEFAULT_SALARY_PERCENT / 100));
  const estimatedNetAfterAdvances = estimatedSalaryBase - totalAdvances;
  const companyResult = totalIncome - totalCosts - estimatedSalaryBase;

  const activeVehicles = useMemo(
    () => vehicles.filter((v) => v.status === "Aktiv").length,
    [vehicles]
  );

  const processedHaldaCount = useMemo(
    () => haldaRows.filter((r) => r.processed).length,
    [haldaRows]
  );

  const topDriver = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const trip of periodTrips) {
      const id = trip.driver_id || "";
      if (!id) continue;
      totals[id] = (totals[id] || 0) + Number(trip.amount || 0);
    }

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const first = sorted[0];
    if (!first) return null;

    return {
      driver: driverMap[first[0]],
      income: first[1],
    };
  }, [periodTrips, driverMap]);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.id === selectedPayrollDriverId) || null,
    [drivers, selectedPayrollDriverId]
  );

  const selectedDriverVehicleIds = useMemo(
    () =>
      vehicles
        .filter((v) => v.driver_id === selectedPayrollDriverId)
        .map((v) => v.id),
    [vehicles, selectedPayrollDriverId]
  );

  const payrollTrips = useMemo(
    () =>
      trips.filter(
        (t) =>
          inRange(t.trip_date, fromDate, toDate) &&
          (t.driver_id === selectedPayrollDriverId ||
            (t.vehicle_id ? selectedDriverVehicleIds.includes(t.vehicle_id) : false))
      ),
    [trips, fromDate, toDate, selectedPayrollDriverId, selectedDriverVehicleIds]
  );

  const payrollAdvances = useMemo(
    () =>
      advances.filter(
        (a) =>
          inRange(a.advance_date, fromDate, toDate) &&
          a.driver_id === selectedPayrollDriverId
      ),
    [advances, fromDate, toDate, selectedPayrollDriverId]
  );

  const payrollCosts = useMemo(
    () =>
      costs.filter(
        (c) =>
          inRange(c.cost_date, fromDate, toDate) &&
          !!c.vehicle_id &&
          selectedDriverVehicleIds.includes(c.vehicle_id)
      ),
    [costs, fromDate, toDate, selectedDriverVehicleIds]
  );

  const payrollIncome = payrollTrips.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const payrollAdvanceTotal = payrollAdvances.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const payrollCostTotal = payrollCosts.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );
  const payrollSalaryPct = selectedDriver?.salary_percent ?? DEFAULT_SALARY_PERCENT;
  const payrollSalary = Math.round(payrollIncome * (Number(payrollSalaryPct) / 100));
  const payrollNet = payrollSalary - payrollAdvanceTotal;
  const selectedProfile = selectedDriver ? profileMap[selectedDriver.id] : null;

  useEffect(() => {
    if (!editDriverId) return;
    const driver = drivers.find((d) => d.id === editDriverId);
    if (!driver) return;
    setEditDriverName(driver.full_name || "");
    setEditDriverPhone(driver.phone || "");
    setEditDriverSalaryPercent(String(driver.salary_percent ?? DEFAULT_SALARY_PERCENT));
    setEditDriverActive(Boolean(driver.active ?? true));
  }, [editDriverId, drivers]);

  useEffect(() => {
    if (!editVehicleId) return;
    const vehicle = vehicles.find((v) => v.id === editVehicleId);
    if (!vehicle) return;
    setEditVehicleName(vehicle.name || "");
    setEditVehicleReg(vehicle.reg || "");
    setEditVehicleStatus(vehicle.status || "Aktiv");
    setEditVehicleDriverId(vehicle.driver_id || "");
  }, [editVehicleId, vehicles]);

  useEffect(() => {
    if (!editTripId) return;
    const trip = trips.find((t) => t.id === editTripId);
    if (!trip) return;
    setEditTripVehicleId(trip.vehicle_id || "");
    setEditTripDriverId(trip.driver_id || "");
    setEditTripAmount(String(trip.amount ?? ""));
    setEditTripSource(trip.source || "Avenyn Taxi");
    setEditTripDate(trip.trip_date || todayString());
    setEditTripNote(trip.note || "");
  }, [editTripId, trips]);

  useEffect(() => {
    if (!editAdvanceId) return;
    const advance = advances.find((a) => a.id === editAdvanceId);
    if (!advance) return;
    setEditAdvanceDriverId(advance.driver_id || "");
    setEditAdvanceAmount(String(advance.amount ?? ""));
    setEditAdvanceDate(advance.advance_date || todayString());
    setEditAdvanceNote(advance.note || "");
  }, [editAdvanceId, advances]);

  useEffect(() => {
    if (!editCostId) return;
    const cost = costs.find((c) => c.id === editCostId);
    if (!cost) return;
    setEditCostVehicleId(cost.vehicle_id || "");
    setEditCostAmount(String(cost.amount ?? ""));
    setEditCostType(cost.type || "Service");
    setEditCostDate(cost.cost_date || todayString());
    setEditCostNote(cost.note || "");
  }, [editCostId, costs]);

  useEffect(() => {
    if (!profileDriverId) return;
    const profile = profiles.find((p) => p.driver_id === profileDriverId);
    setProfileAddress(profile?.full_address || "");
    setProfilePersonalNumber(profile?.personal_number || "");
    setProfileBankName(profile?.bank_name || "");
    setProfileBankAccount(profile?.bank_account || "");
    setProfileCashHandled(
      profile?.cash_handled !== null && profile?.cash_handled !== undefined
        ? String(profile.cash_handled)
        : ""
    );
    setProfileCashNote(profile?.cash_note || DEFAULT_CASH_NOTE);
  }, [profileDriverId, profiles]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="h-10 w-40 rounded-xl bg-slate-200 animate-pulse mb-5" />
          <div className="h-4 w-full rounded bg-slate-200 animate-pulse mb-3" />
          <div className="h-4 w-4/5 rounded bg-slate-200 animate-pulse mb-8" />
          <div className="space-y-3">
            <div className="h-12 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="h-12 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="h-12 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#eff6ff_35%,_#f8fafc_100%)] text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
          <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="flex flex-col justify-center">
              <div className="mb-4 inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm text-blue-700">
                Version 5.5 · Ljus UI · Halda + edit + safe delete
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {COMPANY.name} Dashboard
              </h1>

              <p className="mt-4 max-w-2xl text-lg text-slate-600">
                Säker inloggning, ljusare UI och snabb hantering av förare, bilar,
                resor, Halda, förskott, kostnader och lönespecifikationer.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <FeatureCard title="Supabase Auth" text="Lösenord eller magic link." />
                <FeatureCard title="Halda M2" text="Importera och konvertera Halda till resa." />
                <FeatureCard title="Payroll" text="Printvänlig lönespec och bättre actions." />
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-2xl backdrop-blur">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-900">Logga in</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Använd e-post + lösenord eller välj magic link för smidigare login.
                </p>
              </div>

              {pageError ? <AlertBox tone="error">{pageError}</AlertBox> : null}
              {authError ? <AlertBox tone="error">{authError}</AlertBox> : null}
              {authMessage ? <AlertBox tone="success">{authMessage}</AlertBox> : null}

              <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setLoginMode("login")}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-sm font-medium transition",
                    loginMode === "login"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Lösenord
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode("magic")}
                  className={cn(
                    "rounded-xl px-4 py-2.5 text-sm font-medium transition",
                    loginMode === "magic"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Magic link
                </button>
              </div>

              <form
                onSubmit={loginMode === "login" ? handlePasswordLogin : handleMagicLink}
                className="space-y-4"
              >
                <div>
                  <label className="mb-2 block text-sm text-slate-600">E-post</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="namn@bolag.se"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400"
                  />
                </div>

                {loginMode === "login" ? (
                  <div>
                    <label className="mb-2 block text-sm text-slate-600">Lösenord</label>
                    <div className="flex rounded-2xl border border-slate-200 bg-white focus-within:border-blue-400">
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="px-4 text-sm text-slate-600 hover:text-slate-900"
                      >
                        {showPassword ? "Dölj" : "Visa"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loginLoading
                    ? "Vänta..."
                    : loginMode === "login"
                      ? "Logga in"
                      : "Skicka magic link"}
                </button>
              </form>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Förbättrat i 5.5</p>
                <ul className="mt-2 space-y-1">
                  <li>• Ljusare och renare design</li>
                  <li>• Edit-sektioner för alla huvudtabeller</li>
                  <li>• Safe delete med spärr för länkade poster</li>
                  <li>• Halda M2 import med konvertering till resa</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-shell {
            background: white !important;
            color: black !important;
          }
          .print-card {
            border: 1px solid #d4d4d8 !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-blue-600">
              {COMPANY.legalName}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{COMPANY.name}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 sm:block">
              {session.user.email}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Logga ut
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 print-shell">
        {pageError ? <AlertBox tone="error">{pageError}</AlertBox> : null}
        {pageSuccess ? <AlertBox tone="success">{pageSuccess}</AlertBox> : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6 no-print">
          <StatCard title="Period intäkter" value={money(totalIncome)} />
          <StatCard title="Förskott" value={money(totalAdvances)} />
          <StatCard title="Kostnader" value={money(totalCosts)} />
          <StatCard title="Aktiva bilar" value={String(activeVehicles)} />
          <StatCard title="Halda behandlade" value={String(processedHaldaCount)} />
          <StatCard
            title="Top förare"
            value={topDriver?.driver?.full_name || "-"}
            subValue={topDriver ? money(topDriver.income) : undefined}
          />
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 no-print">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Periodfilter</h2>
              <p className="text-sm text-slate-500">
                Filtrerar dashboard, summering och lönedata.
              </p>
            </div>
            <div className="text-sm text-slate-500">
              {loading
                ? "Laddar data..."
                : `Senast uppdaterad: ${prettyDateTime(lastLoadedAt)}`}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <InputField label="Från" type="date" value={fromDate} onChange={setFromDate} />
            <InputField label="Till" type="date" value={toDate} onChange={setToDate} />
            <ReadOnlyField label="Estimerad lön 33%" value={money(estimatedSalaryBase)} />
            <ReadOnlyField label="Bolagsresultat" value={money(companyResult)} />
          </div>

          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            Netto efter förskott enligt 33% schablon:{" "}
            <span className="font-semibold">{money(estimatedNetAfterAdvances)}</span>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2 no-print">
          <Card title="Lägg till förare">
            <div className="grid gap-4 md:grid-cols-3">
              <InputField label="Namn" value={driverName} onChange={setDriverName} />
              <InputField label="Telefon" value={driverPhone} onChange={setDriverPhone} />
              <InputField
                label="Löne-%"
                type="number"
                value={String(driverSalaryPercent)}
                onChange={(v) => setDriverSalaryPercent(Number(v))}
              />
            </div>
            <ActionButton
              disabled={saving}
              onClick={() => runAction(addDriver, "Förare sparad.")}
              text={saving ? "Sparar..." : "Spara förare"}
            />
          </Card>

          <Card title="Redigera förare">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Välj förare"
                value={editDriverId}
                onChange={setEditDriverId}
                options={[
                  { value: "", label: "Välj..." },
                  ...drivers.map((d) => ({ value: d.id, label: d.full_name })),
                ]}
              />
              <InputField label="Namn" value={editDriverName} onChange={setEditDriverName} />
              <InputField
                label="Telefon"
                value={editDriverPhone}
                onChange={setEditDriverPhone}
              />
              <InputField
                label="Löne-%"
                type="number"
                value={editDriverSalaryPercent}
                onChange={setEditDriverSalaryPercent}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <input
                id="edit-driver-active"
                type="checkbox"
                checked={editDriverActive}
                onChange={(e) => setEditDriverActive(e.target.checked)}
              />
              <label htmlFor="edit-driver-active" className="text-sm text-slate-600">
                Aktiv förare
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton
                disabled={saving}
                onClick={() => runAction(updateDriver, "Förare uppdaterad.")}
                text={saving ? "Sparar..." : "Uppdatera förare"}
              />
              <DangerButton
                disabled={!editDriverId || saving}
                onClick={() => {
                  const driver = drivers.find((d) => d.id === editDriverId);
                  if (!driver) return;
                  setConfirmDelete({
                    type: "driver",
                    id: driver.id,
                    label: driver.full_name,
                  });
                }}
                text="Ta bort förare"
              />
            </div>
          </Card>

          <Card title="Lägg till bil">
            <div className="grid gap-4 md:grid-cols-4">
              <InputField label="Bilnamn" value={vehicleName} onChange={setVehicleName} />
              <InputField label="Reg.nr" value={vehicleReg} onChange={setVehicleReg} />
              <SelectField
                label="Status"
                value={vehicleStatus}
                onChange={setVehicleStatus}
                options={STATUS_OPTIONS}
              />
              <SelectField
                label="Förare"
                value={vehicleDriverId}
                onChange={setVehicleDriverId}
                options={[
                  { value: "", label: "Ingen förare" },
                  ...drivers.map((d) => ({ value: d.id, label: d.full_name })),
                ]}
              />
            </div>
            <ActionButton
              disabled={saving}
              onClick={() => runAction(addVehicle, "Bil sparad.")}
              text={saving ? "Sparar..." : "Spara bil"}
            />
          </Card>

          <Card title="Redigera bil">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Välj bil"
                value={editVehicleId}
                onChange={setEditVehicleId}
                options={[
                  { value: "", label: "Välj..." },
                  ...vehicles.map((v) => ({
                    value: v.id,
                    label: `${v.name}${v.reg ? ` · ${v.reg}` : ""}`,
                  })),
                ]}
              />
              <InputField label="Bilnamn" value={editVehicleName} onChange={setEditVehicleName} />
              <InputField label="Reg.nr" value={editVehicleReg} onChange={setEditVehicleReg} />
              <SelectField
                label="Status"
                value={editVehicleStatus}
                onChange={setEditVehicleStatus}
                options={STATUS_OPTIONS}
              />
              <SelectField
                label="Förare"
                value={editVehicleDriverId}
                onChange={setEditVehicleDriverId}
                options={[
                  { value: "", label: "Ingen förare" },
                  ...drivers.map((d) => ({ value: d.id, label: d.full_name })),
                ]}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton
                disabled={saving}
                onClick={() => runAction(updateVehicle, "Bil uppdaterad.")}
                text={saving ? "Sparar..." : "Uppdatera bil"}
              />
              <DangerButton
                disabled={!editVehicleId || saving}
                onClick={() => {
                  const vehicle = vehicles.find((v) => v.id === editVehicleId);
                  if (!vehicle) return;
                  setConfirmDelete({
                    type: "vehicle",
                    id: vehicle.id,
                    label: vehicle.name,
                  });
                }}
                text="Ta bort bil"
              />
            </div>
          </Card>

          <Card title="Registrera resa">
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Bil"
                value={tripVehicleId}
                onChange={setTripVehicleId}
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.name}${v.reg ? ` · ${v.reg}` : ""}`,
                }))}
              />
              <SelectField
                label="Förare"
                value={tripDriverId}
                onChange={setTripDriverId}
                options={drivers.map((d) => ({ value: d.id, label: d.full_name }))}
              />
              <InputField
                label="Belopp"
                type="number"
                value={tripAmount}
                onChange={setTripAmount}
              />
              <SelectField
                label="Källa"
                value={tripSource}
                onChange={setTripSource}
                options={SOURCE_OPTIONS}
              />
              <InputField label="Datum" type="date" value={tripDate} onChange={setTripDate} />
              <InputField label="Notering" value={tripNote} onChange={setTripNote} />
            </div>
            <ActionButton
              disabled={saving}
              onClick={() => runAction(addTrip, "Resa sparad.")}
              text={saving ? "Sparar..." : "Spara resa"}
            />
          </Card>

          <Card title="Halda import / Halda M2">
            <div className="grid gap-4 md:grid-cols-3">
              <InputField
                label="Datum"
                type="date"
                value={haldaTripDate}
                onChange={setHaldaTripDate}
              />
              <SelectField
                label="Förare"
                value={haldaDriverId}
                onChange={setHaldaDriverId}
                options={drivers.map((d) => ({ value: d.id, label: d.full_name }))}
              />
              <SelectField
                label="Bil"
                value={haldaVehicleId}
                onChange={setHaldaVehicleId}
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.name}${v.reg ? ` · ${v.reg}` : ""}`,
                }))}
              />
              <InputField
                label="Belopp"
                type="number"
                value={haldaAmount}
                onChange={setHaldaAmount}
              />
              <InputField
                label="Mätartotal"
                type="number"
                value={haldaMeterTotal}
                onChange={setHaldaMeterTotal}
              />
              <InputField
                label="Kontant"
                type="number"
                value={haldaCashAmount}
                onChange={setHaldaCashAmount}
              />
              <InputField
                label="Kort"
                type="number"
                value={haldaCardAmount}
                onChange={setHaldaCardAmount}
              />
              <InputField
                label="Passkod"
                value={haldaShiftCode}
                onChange={setHaldaShiftCode}
              />
              <InputField
                label="Extern ref"
                value={haldaExternalRef}
                onChange={setHaldaExternalRef}
              />
            </div>

            <div className="mt-4">
              <InputField label="Notering" value={haldaNote} onChange={setHaldaNote} />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton
                disabled={saving}
                onClick={() => runAction(addHaldaRow, "Halda-rad sparad.")}
                text={saving ? "Sparar..." : "Spara Halda-rad"}
              />
            </div>

            <div className="mt-6">
              <SimpleTable
                headers={["Datum", "Förare", "Bil", "Belopp", "Status"]}
                rows={haldaRows.slice(0, 10).map((r) => [
                  r.trip_date,
                  r.driver_id ? driverMap[r.driver_id]?.full_name || "-" : "-",
                  r.vehicle_id ? vehicleMap[r.vehicle_id]?.name || "-" : "-",
                  money(r.amount),
                  r.processed ? "Behandlad" : "Obehandlad",
                ])}
              />
            </div>

            <div className="mt-4 space-y-2">
              {haldaRows
                .filter((r) => !r.processed)
                .slice(0, 10)
                .map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="text-sm text-slate-600">
                      <span className="font-medium text-slate-900">{row.trip_date}</span>
                      {" · "}
                      {row.driver_id ? driverMap[row.driver_id]?.full_name || "-" : "-"}
                      {" · "}
                      {row.vehicle_id ? vehicleMap[row.vehicle_id]?.name || "-" : "-"}
                      {" · "}
                      {money(row.amount)}
                    </div>

                    <ActionButton
                      disabled={saving}
                      onClick={() =>
                        runAction(
                          () => processHaldaRow(row.id),
                          "Halda-rad konverterad till resa."
                        )
                      }
                      text="Skapa resa från Halda"
                    />
                  </div>
                ))}
            </div>
          </Card>

          <Card title="Redigera resa">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Välj resa"
                value={editTripId}
                onChange={setEditTripId}
                options={[
                  { value: "", label: "Välj..." },
                  ...trips.slice(0, 100).map((t) => ({
                    value: t.id,
                    label: `${t.trip_date} · ${
                      driverMap[t.driver_id || ""]?.full_name || "-"
                    } · ${money(t.amount)}`,
                  })),
                ]}
              />
              <SelectField
                label="Bil"
                value={editTripVehicleId}
                onChange={setEditTripVehicleId}
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.name}${v.reg ? ` · ${v.reg}` : ""}`,
                }))}
              />
              <SelectField
                label="Förare"
                value={editTripDriverId}
                onChange={setEditTripDriverId}
                options={drivers.map((d) => ({ value: d.id, label: d.full_name }))}
              />
              <InputField
                label="Belopp"
                type="number"
                value={editTripAmount}
                onChange={setEditTripAmount}
              />
              <SelectField
                label="Källa"
                value={editTripSource}
                onChange={setEditTripSource}
                options={SOURCE_OPTIONS}
              />
              <InputField
                label="Datum"
                type="date"
                value={editTripDate}
                onChange={setEditTripDate}
              />
            </div>

            <div className="mt-4">
              <InputField label="Notering" value={editTripNote} onChange={setEditTripNote} />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton
                disabled={saving}
                onClick={() => runAction(updateTrip, "Resa uppdaterad.")}
                text={saving ? "Sparar..." : "Uppdatera resa"}
              />
              <DangerButton
                disabled={!editTripId || saving}
                onClick={() => {
                  const trip = trips.find((t) => t.id === editTripId);
                  if (!trip) return;
                  setConfirmDelete({
                    type: "trip",
                    id: trip.id,
                    label: `${trip.trip_date} · ${money(trip.amount)}`,
                  });
                }}
                text="Ta bort resa"
              />
            </div>
          </Card>

          <Card title="Registrera förskott">
            <div className="grid gap-4 md:grid-cols-4">
              <SelectField
                label="Förare"
                value={advanceDriverId}
                onChange={setAdvanceDriverId}
                options={drivers.map((d) => ({ value: d.id, label: d.full_name }))}
              />
              <InputField
                label="Belopp"
                type="number"
                value={advanceAmount}
                onChange={setAdvanceAmount}
              />
              <InputField
                label="Datum"
                type="date"
                value={advanceDate}
                onChange={setAdvanceDate}
              />
              <InputField label="Notering" value={advanceNote} onChange={setAdvanceNote} />
            </div>
            <ActionButton
              disabled={saving}
              onClick={() => runAction(addAdvance, "Förskott sparat.")}
              text={saving ? "Sparar..." : "Spara förskott"}
            />
          </Card>

          <Card title="Redigera förskott">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Välj förskott"
                value={editAdvanceId}
                onChange={setEditAdvanceId}
                options={[
                  { value: "", label: "Välj..." },
                  ...advances.slice(0, 100).map((a) => ({
                    value: a.id,
                    label: `${a.advance_date} · ${
                      driverMap[a.driver_id || ""]?.full_name || "-"
                    } · ${money(a.amount)}`,
                  })),
                ]}
              />
              <SelectField
                label="Förare"
                value={editAdvanceDriverId}
                onChange={setEditAdvanceDriverId}
                options={drivers.map((d) => ({ value: d.id, label: d.full_name }))}
              />
              <InputField
                label="Belopp"
                type="number"
                value={editAdvanceAmount}
                onChange={setEditAdvanceAmount}
              />
              <InputField
                label="Datum"
                type="date"
                value={editAdvanceDate}
                onChange={setEditAdvanceDate}
              />
            </div>

            <div className="mt-4">
              <InputField
                label="Notering"
                value={editAdvanceNote}
                onChange={setEditAdvanceNote}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton
                disabled={saving}
                onClick={() => runAction(updateAdvance, "Förskott uppdaterat.")}
                text={saving ? "Sparar..." : "Uppdatera förskott"}
              />
              <DangerButton
                disabled={!editAdvanceId || saving}
                onClick={() => {
                  const advance = advances.find((a) => a.id === editAdvanceId);
                  if (!advance) return;
                  setConfirmDelete({
                    type: "advance",
                    id: advance.id,
                    label: `${advance.advance_date} · ${money(advance.amount)}`,
                  });
                }}
                text="Ta bort förskott"
              />
            </div>
          </Card>

          <Card title="Registrera kostnad">
            <div className="grid gap-4 md:grid-cols-4">
              <SelectField
                label="Bil"
                value={costVehicleId}
                onChange={setCostVehicleId}
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.name}${v.reg ? ` · ${v.reg}` : ""}`,
                }))}
              />
              <InputField
                label="Belopp"
                type="number"
                value={costAmount}
                onChange={setCostAmount}
              />
              <SelectField
                label="Typ"
                value={costType}
                onChange={setCostType}
                options={COST_TYPE_OPTIONS}
              />
              <InputField label="Datum" type="date" value={costDate} onChange={setCostDate} />
            </div>
            <div className="mt-4">
              <InputField label="Notering" value={costNote} onChange={setCostNote} />
            </div>
            <ActionButton
              disabled={saving}
              onClick={() => runAction(addCost, "Kostnad sparad.")}
              text={saving ? "Sparar..." : "Spara kostnad"}
            />
          </Card>

          <Card title="Redigera kostnad">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Välj kostnad"
                value={editCostId}
                onChange={setEditCostId}
                options={[
                  { value: "", label: "Välj..." },
                  ...costs.slice(0, 100).map((c) => ({
                    value: c.id,
                    label: `${c.cost_date} · ${
                      vehicleMap[c.vehicle_id || ""]?.name || "-"
                    } · ${money(c.amount)}`,
                  })),
                ]}
              />
              <SelectField
                label="Bil"
                value={editCostVehicleId}
                onChange={setEditCostVehicleId}
                options={vehicles.map((v) => ({
                  value: v.id,
                  label: `${v.name}${v.reg ? ` · ${v.reg}` : ""}`,
                }))}
              />
              <InputField
                label="Belopp"
                type="number"
                value={editCostAmount}
                onChange={setEditCostAmount}
              />
              <SelectField
                label="Typ"
                value={editCostType}
                onChange={setEditCostType}
                options={COST_TYPE_OPTIONS}
              />
              <InputField
                label="Datum"
                type="date"
                value={editCostDate}
                onChange={setEditCostDate}
              />
            </div>

            <div className="mt-4">
              <InputField label="Notering" value={editCostNote} onChange={setEditCostNote} />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton
                disabled={saving}
                onClick={() => runAction(updateCost, "Kostnad uppdaterad.")}
                text={saving ? "Sparar..." : "Uppdatera kostnad"}
              />
              <DangerButton
                disabled={!editCostId || saving}
                onClick={() => {
                  const cost = costs.find((c) => c.id === editCostId);
                  if (!cost) return;
                  setConfirmDelete({
                    type: "cost",
                    id: cost.id,
                    label: `${cost.cost_date} · ${money(cost.amount)}`,
                  });
                }}
                text="Ta bort kostnad"
              />
            </div>
          </Card>

          <Card title="Förarprofil / bank / kontanthantering">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Förare"
                value={profileDriverId}
                onChange={setProfileDriverId}
                options={drivers.map((d) => ({ value: d.id, label: d.full_name }))}
              />
              <InputField
                label="Full adress"
                value={profileAddress}
                onChange={setProfileAddress}
              />
              <InputField
                label="Personnummer"
                value={profilePersonalNumber}
                onChange={setProfilePersonalNumber}
              />
              <InputField label="Banknamn" value={profileBankName} onChange={setProfileBankName} />
              <InputField
                label="Kontonummer"
                value={profileBankAccount}
                onChange={setProfileBankAccount}
              />
              <InputField
                label="Kontanthantering"
                type="number"
                value={profileCashHandled}
                onChange={setProfileCashHandled}
              />
            </div>

            <div className="mt-4">
              <TextAreaField
                label="Cash note"
                value={profileCashNote}
                onChange={setProfileCashNote}
              />
            </div>

            <ActionButton
              disabled={saving}
              onClick={() => runAction(saveDriverProfile, "Förarprofil sparad.")}
              text={saving ? "Sparar..." : "Spara profil"}
            />
          </Card>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print-card">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between no-print">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Lönespecifikation / Payroll</h2>
              <p className="text-sm text-slate-500">
                Välj förare och period. Skriv ut direkt från denna vy.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={printPayroll}
                className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                Skriv ut lönespec
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 no-print">
            <SelectField
              label="Förare"
              value={selectedPayrollDriverId}
              onChange={setSelectedPayrollDriverId}
              options={drivers.map((d) => ({ value: d.id, label: d.full_name }))}
            />
            <InputField label="Från" type="date" value={fromDate} onChange={setFromDate} />
            <InputField label="Till" type="date" value={toDate} onChange={setToDate} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4 no-print">
            <MiniStat title="Omsättning" value={money(payrollIncome)} />
            <MiniStat title={`Lön ${payrollSalaryPct}%`} value={money(payrollSalary)} />
            <MiniStat title="Förskott" value={money(payrollAdvanceTotal)} />
            <MiniStat title="Netto" value={money(payrollNet)} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 print-card">
            <div className="border-b border-slate-200 pb-4">
              <div className="text-xs uppercase tracking-[0.25em] text-blue-600">
                Lönespecifikation
              </div>
              <h3 className="mt-1 text-2xl font-bold text-slate-900">{COMPANY.name}</h3>
              <p className="text-sm text-slate-500">
                {COMPANY.legalName} · {COMPANY.city} · {COMPANY.website}
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <InfoRow label="Förare" value={selectedDriver?.full_name || "-"} />
              <InfoRow label="Telefon" value={selectedDriver?.phone || "-"} />
              <InfoRow label="Adress" value={selectedProfile?.full_address || "-"} />
              <InfoRow
                label="Personnummer"
                value={selectedProfile?.personal_number || "-"}
              />
              <InfoRow label="Bank" value={selectedProfile?.bank_name || "-"} />
              <InfoRow label="Kontonummer" value={selectedProfile?.bank_account || "-"} />
              <InfoRow label="Period" value={`${fromDate} → ${toDate}`} />
              <InfoRow label="Bilkostnader" value={money(payrollCostTotal)} />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Rad</th>
                    <th className="px-4 py-3">Belopp</th>
                  </tr>
                </thead>
                <tbody className="bg-white text-slate-700">
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Omsättning</td>
                    <td className="px-4 py-3">{money(payrollIncome)}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Lön {payrollSalaryPct}%</td>
                    <td className="px-4 py-3">{money(payrollSalary)}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">Förskott</td>
                    <td className="px-4 py-3">- {money(payrollAdvanceTotal)}</td>
                  </tr>
                  <tr className="border-t border-slate-200 font-semibold text-slate-900">
                    <td className="px-4 py-3">Att utbetala</td>
                    <td className="px-4 py-3">{money(payrollNet)}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      Kontanthantering (info, påverkar ej lön)
                    </td>
                    <td className="px-4 py-3">
                      {money(selectedProfile?.cash_handled || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              {selectedProfile?.cash_note || DEFAULT_CASH_NOTE}
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-3 no-print">
              <TableCard title="Resor i lönespec" rows={payrollTrips.length}>
                <SimpleTable
                  headers={["Datum", "Källa", "Belopp"]}
                  rows={payrollTrips.slice(0, 20).map((t) => [
                    t.trip_date,
                    t.source || "-",
                    money(t.amount),
                  ])}
                />
              </TableCard>

              <TableCard title="Förskott i lönespec" rows={payrollAdvances.length}>
                <SimpleTable
                  headers={["Datum", "Notering", "Belopp"]}
                  rows={payrollAdvances.slice(0, 20).map((a) => [
                    a.advance_date,
                    a.note || "-",
                    money(a.amount),
                  ])}
                />
              </TableCard>

              <TableCard title="Kostnader på förarens bilar" rows={payrollCosts.length}>
                <SimpleTable
                  headers={["Datum", "Typ", "Belopp"]}
                  rows={payrollCosts.slice(0, 20).map((c) => [
                    c.cost_date,
                    c.type || "-",
                    money(c.amount),
                  ])}
                />
              </TableCard>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-4 no-print">
          <TableCard title="Förare" rows={drivers.length}>
            <SimpleTable
              headers={["Namn", "Telefon", "Lön %"]}
              rows={drivers.slice(0, 10).map((d) => [
                d.full_name,
                d.phone || "-",
                String(d.salary_percent ?? DEFAULT_SALARY_PERCENT),
              ])}
            />
          </TableCard>

          <TableCard title="Bilar" rows={vehicles.length}>
            <SimpleTable
              headers={["Bil", "Reg.nr", "Status"]}
              rows={vehicles.slice(0, 10).map((v) => [v.name, v.reg || "-", v.status || "-"])}
            />
          </TableCard>

          <TableCard title="Senaste resor" rows={trips.length}>
            <SimpleTable
              headers={["Datum", "Förare", "Belopp"]}
              rows={trips.slice(0, 10).map((t) => [
                t.trip_date,
                t.driver_id ? driverMap[t.driver_id]?.full_name || "-" : "-",
                money(t.amount),
              ])}
            />
          </TableCard>

          <TableCard title="Senaste Halda" rows={haldaRows.length}>
            <SimpleTable
              headers={["Datum", "Förare", "Belopp", "Status"]}
              rows={haldaRows.slice(0, 10).map((r) => [
                r.trip_date,
                r.driver_id ? driverMap[r.driver_id]?.full_name || "-" : "-",
                money(r.amount),
                r.processed ? "Behandlad" : "Obehandlad",
              ])}
            />
          </TableCard>
        </section>
      </main>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">Bekräfta borttagning</h3>
            <p className="mt-3 text-sm text-slate-600">Du håller på att ta bort:</p>
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {confirmDelete.label}
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Denna åtgärd kan inte ångras.
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleConfirmedDelete}
                className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-500"
              >
                Ta bort
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function AlertBox({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-4 rounded-2xl px-4 py-3 text-sm",
        tone === "error"
          ? "border border-red-200 bg-red-50 text-red-700"
          : "border border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      {children}
    </div>
  );
}

function StatCard({
  title,
  value,
  subValue,
}: {
  title: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
      {subValue ? <div className="mt-1 text-sm text-blue-600">{subValue}</div> : null}
    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function TableCard({
  title,
  rows,
  children,
}: {
  title: string;
  rows: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
          {rows} rader
        </span>
      </div>
      {children}
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-600">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400"
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-2 text-sm text-slate-600">{label}</div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-900">
        {value}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string> | Array<{ value: string; label: string }>;
}) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );

  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400"
      >
        {normalized.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({
  onClick,
  text,
  disabled,
}: {
  onClick: () => void;
  text: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {text}
    </button>
  );
}

function DangerButton({
  onClick,
  text,
  disabled,
}: {
  onClick: () => void;
  text: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl bg-red-600 px-5 py-3 font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {text}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 print-card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-900">{value}</div>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white text-slate-700">
          {rows.length === 0 ? (
            <tr className="border-t border-slate-200">
              <td colSpan={headers.length} className="px-4 py-6 text-center text-slate-500">
                Inga data ännu.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-200">
                {row.map((cell, j) => (
                  <td key={`${i}-${j}`} className="px-4 py-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}