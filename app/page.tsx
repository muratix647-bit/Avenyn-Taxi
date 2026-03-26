"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ksmxrxqidnrvgubivhzy.supabase.co",
  "sb_publishable_ds6smOMma1d_yUvgBvpOXA_pKDQmtEg",
  {
    auth: { persistSession: false },
  }
);

const STATUS_OPTIONS = ["Aktiv", "På service", "Service bokad", "Uthyrd", "Offline"];
const SOURCE_OPTIONS = ["Avenyn Taxi", "Uber", "Bolt", "Kontant", "Swish", "Halda M2"];
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

const DEFAULT_SALARY_PERCENT = 33;
const DEFAULT_CASH_NOTE = "Kontanthantering påverkar ej lönen, endast informationsrad";

const COMPANY = {
  name: "Avenyn Taxi",
  legalName: "Citra Trans och Bilservice AB",
  orgnr: "556597-4796",
  city: "Göteborg",
  website: "avenyntaxi.se",
};

type Driver = {
  id: string;
  full_name: string;
  phone: string;
  salary_percent: number;
  active: boolean;
  created_at?: string;
};

type Vehicle = {
  id: string;
  name: string;
  reg: string;
  status: string;
  driver_id: string | null;
  created_at?: string;
};

type Trip = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  amount: number;
  source: string;
  trip_date: string;
  note: string;
  halda_row_id?: string | null;
  created_at?: string;
};

type Advance = {
  id: string;
  driver_id: string;
  amount: number;
  note: string;
  advance_date: string;
  created_at?: string;
};

type Cost = {
  id: string;
  vehicle_id: string;
  amount: number;
  type: string;
  note: string;
  cost_date: string;
  created_at?: string;
};

type DriverProfile = {
  id?: string;
  driver_id: string;
  full_address: string;
  personal_number: string;
  bank_name: string;
  bank_account: string;
  cash_handled: number;
  cash_note: string;
  created_at?: string;
  updated_at?: string;
};

type VehicleLocation = {
  id: string;
  vehicle_id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  address?: string | null;
  created_at?: string;
  updated_at?: string;
};

type HaldaImportRow = {
  id: string;
  trip_date: string;
  driver_id: string | null;
  vehicle_id: string | null;
  amount: number;
  meter_total: number;
  cash_amount: number;
  card_amount: number;
  source: string;
  shift_code: string;
  external_ref: string;
  note: string;
  processed: boolean;
  processed_trip_id: string | null;
  created_at?: string;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function money(value: number) {
  return `${Number(value || 0).toLocaleString("sv-SE")} kr`;
}

function safeNumber(value: unknown) {
  return Number(value || 0);
}

function inRange(dateStr: string, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

function prettyDateTime(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("sv-SE");
}

function mapUrl(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) {
    return "https://www.openstreetmap.org/export/embed.html";
  }
  const bbox = `${lng - 0.02}%2C${lat - 0.02}%2C${lng + 0.02}%2C${lat + 0.02}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export default function Page() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [profiles, setProfiles] = useState<DriverProfile[]>([]);
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [haldaRows, setHaldaRows] = useState<HaldaImportRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayString());

  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverSalaryPercent, setDriverSalaryPercent] = useState(String(DEFAULT_SALARY_PERCENT));

  const [vehicleName, setVehicleName] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [vehicleDriverId, setVehicleDriverId] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState("Aktiv");

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
  const [profileAddress, setProfileAddress] = useState("");
  const [profilePersonalNumber, setProfilePersonalNumber] = useState("");
  const [profileBankName, setProfileBankName] = useState("");
  const [profileBankAccount, setProfileBankAccount] = useState("");
  const [profileCashHandled, setProfileCashHandled] = useState("0");
  const [profileCashNote, setProfileCashNote] = useState(DEFAULT_CASH_NOTE);

  const [selectedTrackerVehicleId, setSelectedTrackerVehicleId] = useState("");
  const [trackingActive, setTrackingActive] = useState(false);
  const [liveLat, setLiveLat] = useState<number | null>(null);
  const [liveLng, setLiveLng] = useState<number | null>(null);
  const [liveAccuracy, setLiveAccuracy] = useState<number | null>(null);
  const [liveSpeed, setLiveSpeed] = useState<number | null>(null);
  const [liveHeading, setLiveHeading] = useState<number | null>(null);

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

  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editDriverName, setEditDriverName] = useState("");
  const [editDriverPhone, setEditDriverPhone] = useState("");
  const [editDriverSalaryPercent, setEditDriverSalaryPercent] = useState(String(DEFAULT_SALARY_PERCENT));
  const [editDriverActive, setEditDriverActive] = useState(true);

  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editVehicleName, setEditVehicleName] = useState("");
  const [editVehicleReg, setEditVehicleReg] = useState("");
  const [editVehicleDriverId, setEditVehicleDriverId] = useState("");
  const [editVehicleStatus, setEditVehicleStatus] = useState("Aktiv");

  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editTripVehicleId, setEditTripVehicleId] = useState("");
  const [editTripDriverId, setEditTripDriverId] = useState("");
  const [editTripAmount, setEditTripAmount] = useState("");
  const [editTripSource, setEditTripSource] = useState("Avenyn Taxi");
  const [editTripDate, setEditTripDate] = useState(todayString());
  const [editTripNote, setEditTripNote] = useState("");

  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [editAdvanceDriverId, setEditAdvanceDriverId] = useState("");
  const [editAdvanceAmount, setEditAdvanceAmount] = useState("");
  const [editAdvanceDate, setEditAdvanceDate] = useState(todayString());
  const [editAdvanceNote, setEditAdvanceNote] = useState("");

  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editCostVehicleId, setEditCostVehicleId] = useState("");
  const [editCostAmount, setEditCostAmount] = useState("");
  const [editCostType, setEditCostType] = useState("Service");
  const [editCostDate, setEditCostDate] = useState(todayString());
  const [editCostNote, setEditCostNote] = useState("");

  const watchIdRef = useRef<number | null>(null);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [
        driversRes,
        vehiclesRes,
        tripsRes,
        advancesRes,
        costsRes,
        profilesRes,
        locationsRes,
        haldaRowsRes,
      ] = await Promise.all([
        supabase.from("drivers").select("*").order("full_name", { ascending: true }),
        supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
        supabase.from("trips").select("*").order("trip_date", { ascending: false }),
        supabase.from("advances").select("*").order("advance_date", { ascending: false }),
        supabase.from("costs").select("*").order("cost_date", { ascending: false }),
        supabase.from("driver_profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("vehicle_locations").select("*").order("updated_at", { ascending: false }),
        supabase.from("halda_import_rows").select("*").order("trip_date", { ascending: false }),
      ]);

      const errors = [
        driversRes.error?.message,
        vehiclesRes.error?.message,
        tripsRes.error?.message,
        advancesRes.error?.message,
        costsRes.error?.message,
        profilesRes.error?.message,
        locationsRes.error?.message,
        haldaRowsRes.error?.message,
      ].filter(Boolean);

      if (errors.length > 0) {
        setError(errors.join(" | "));
      }

      setDrivers(
        ((driversRes.data as Driver[]) || []).map((d) => ({
          ...d,
          salary_percent: safeNumber(d.salary_percent),
        }))
      );

      setVehicles((vehiclesRes.data as Vehicle[]) || []);

      setTrips(
        ((tripsRes.data as Trip[]) || []).map((t) => ({
          ...t,
          amount: safeNumber(t.amount),
        }))
      );

      setAdvances(
        ((advancesRes.data as Advance[]) || []).map((a) => ({
          ...a,
          amount: safeNumber(a.amount),
        }))
      );

      setCosts(
        ((costsRes.data as Cost[]) || []).map((c) => ({
          ...c,
          amount: safeNumber(c.amount),
        }))
      );

      setProfiles(
        ((profilesRes.data as DriverProfile[]) || []).map((p) => ({
          ...p,
          cash_handled: safeNumber(p.cash_handled),
        }))
      );

      setLocations(
        ((locationsRes.data as VehicleLocation[]) || []).map((l) => ({
          ...l,
          lat: safeNumber(l.lat),
          lng: safeNumber(l.lng),
          accuracy: l.accuracy == null ? null : safeNumber(l.accuracy),
          speed: l.speed == null ? null : safeNumber(l.speed),
          heading: l.heading == null ? null : safeNumber(l.heading),
        }))
      );

      setHaldaRows(
        ((haldaRowsRes.data as HaldaImportRow[]) || []).map((r) => ({
          ...r,
          amount: safeNumber(r.amount),
          meter_total: safeNumber(r.meter_total),
          cash_amount: safeNumber(r.cash_amount),
          card_amount: safeNumber(r.card_amount),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte läsa data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!advanceDriverId && drivers.length > 0) setAdvanceDriverId(drivers[0].id);
    if (!selectedPayrollDriverId && drivers.length > 0) setSelectedPayrollDriverId(drivers[0].id);
    if (!tripDriverId && drivers.length > 0) setTripDriverId(drivers[0].id);
    if (!vehicleDriverId && drivers.length > 0) setVehicleDriverId(drivers[0].id);
    if (!haldaDriverId && drivers.length > 0) setHaldaDriverId(drivers[0].id);
    if (!selectedTrackerVehicleId && vehicles.length > 0) setSelectedTrackerVehicleId(vehicles[0].id);
  }, [
    drivers,
    vehicles,
    advanceDriverId,
    selectedPayrollDriverId,
    tripDriverId,
    vehicleDriverId,
    haldaDriverId,
    selectedTrackerVehicleId,
  ]);

  const driverMap = useMemo(() => {
    const map: Record<string, Driver> = {};
    drivers.forEach((d) => {
      map[d.id] = d;
    });
    return map;
  }, [drivers]);

  const vehicleMap = useMemo(() => {
    const map: Record<string, Vehicle> = {};
    vehicles.forEach((v) => {
      map[v.id] = v;
    });
    return map;
  }, [vehicles]);

  const profileMap = useMemo(() => {
    const map: Record<string, DriverProfile> = {};
    profiles.forEach((p) => {
      map[p.driver_id] = p;
    });
    return map;
  }, [profiles]);

  const locationMap = useMemo(() => {
    const map: Record<string, VehicleLocation> = {};
    locations.forEach((l) => {
      if (!map[l.vehicle_id]) map[l.vehicle_id] = l;
    });
    return map;
  }, [locations]);

  const selectedDriverProfile = selectedPayrollDriverId ? profileMap[selectedPayrollDriverId] : undefined;
  const selectedTrackerLocation = selectedTrackerVehicleId ? locationMap[selectedTrackerVehicleId] : undefined;

  useEffect(() => {
    setProfileAddress(selectedDriverProfile?.full_address || "");
    setProfilePersonalNumber(selectedDriverProfile?.personal_number || "");
    setProfileBankName(selectedDriverProfile?.bank_name || "");
    setProfileBankAccount(selectedDriverProfile?.bank_account || "");
    setProfileCashHandled(String(selectedDriverProfile?.cash_handled ?? 0));
    setProfileCashNote(selectedDriverProfile?.cash_note || DEFAULT_CASH_NOTE);
  }, [selectedDriverProfile]);

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

  const totalIncome = periodTrips.reduce((sum, t) => sum + safeNumber(t.amount), 0);
  const totalCosts = periodCosts.reduce((sum, c) => sum + safeNumber(c.amount), 0);
  const totalAdvances = periodAdvances.reduce((sum, a) => sum + safeNumber(a.amount), 0);
  const estimatedSalaryBase = Math.round((totalIncome * DEFAULT_SALARY_PERCENT) / 100);
  const estimatedNetAfterAdvances = estimatedSalaryBase - totalAdvances;
  const companyResult = totalIncome - totalCosts - estimatedSalaryBase;
  const activeVehicles = vehicles.filter((v) => v.status === "Aktiv").length;
  const processedHaldaCount = haldaRows.filter((r) => r.processed).length;

  const selectedDriver = selectedPayrollDriverId ? driverMap[selectedPayrollDriverId] : undefined;

  const selectedDriverVehicleIds = vehicles
    .filter((v) => v.driver_id === selectedPayrollDriverId)
    .map((v) => v.id);

  const payrollTrips = periodTrips.filter(
    (t) => t.driver_id === selectedPayrollDriverId || selectedDriverVehicleIds.includes(t.vehicle_id)
  );

  const payrollAdvances = periodAdvances.filter((a) => a.driver_id === selectedPayrollDriverId);
  const payrollCosts = periodCosts.filter((c) => selectedDriverVehicleIds.includes(c.vehicle_id));

  const payrollIncome = payrollTrips.reduce((sum, t) => sum + safeNumber(t.amount), 0);
  const payrollAdvanceTotal = payrollAdvances.reduce((sum, a) => sum + safeNumber(a.amount), 0);
  const payrollCostTotal = payrollCosts.reduce((sum, c) => sum + safeNumber(c.amount), 0);
  const payrollSalaryPct = safeNumber(selectedDriver?.salary_percent ?? DEFAULT_SALARY_PERCENT);
  const payrollSalary = Math.round((payrollIncome * payrollSalaryPct) / 100);
  const payrollNet = payrollSalary - payrollAdvanceTotal;

  const topDriver = useMemo(() => {
    const rows = drivers.map((d) => {
      const income = periodTrips
        .filter((t) => t.driver_id === d.id)
        .reduce((sum, t) => sum + safeNumber(t.amount), 0);

      return { id: d.id, name: d.full_name, income };
    });

    rows.sort((a, b) => b.income - a.income);
    return rows[0];
  }, [drivers, periodTrips]);

  const driverSummary = useMemo(() => {
    return drivers.map((d) => {
      const income = periodTrips
        .filter((t) => t.driver_id === d.id)
        .reduce((sum, t) => sum + safeNumber(t.amount), 0);

      const advancesForDriver = periodAdvances
        .filter((a) => a.driver_id === d.id)
        .reduce((sum, a) => sum + safeNumber(a.amount), 0);

      const vehicleIds = vehicles.filter((v) => v.driver_id === d.id).map((v) => v.id);

      const costsForDriver = periodCosts
        .filter((c) => vehicleIds.includes(c.vehicle_id))
        .reduce((sum, c) => sum + safeNumber(c.amount), 0);

      const salary = Math.round((income * safeNumber(d.salary_percent)) / 100);

      return {
        driver: d,
        income,
        advances: advancesForDriver,
        costs: costsForDriver,
        salary,
        net: salary - advancesForDriver,
      };
    });
  }, [drivers, vehicles, periodTrips, periodAdvances, periodCosts]);

  async function runAction(action: () => Promise<void>, successText: string) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await action();
      setSuccess(successText);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setSaving(false);
    }
  }

  async function addDriver() {
    if (!driverName.trim()) {
      setError("Fyll i förarens namn.");
      return;
    }

    await runAction(async () => {
      const insertRes = await supabase
        .from("drivers")
        .insert({
          full_name: driverName.trim(),
          phone: driverPhone.trim(),
          salary_percent: Number(driverSalaryPercent || DEFAULT_SALARY_PERCENT),
          active: true,
        })
        .select("*")
        .single();

      if (insertRes.error) throw new Error(insertRes.error.message);

      const created = insertRes.data as Driver;

      const profileRes = await supabase.from("driver_profiles").insert({
        driver_id: created.id,
        cash_note: DEFAULT_CASH_NOTE,
      });

      if (profileRes.error) throw new Error(profileRes.error.message);

      setDriverName("");
      setDriverPhone("");
      setDriverSalaryPercent(String(DEFAULT_SALARY_PERCENT));
    }, "Förare sparad.");
  }

  async function addVehicle() {
    if (!vehicleName.trim() || !vehicleReg.trim()) {
      setError("Fyll i bilnamn och regnr.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("vehicles").insert({
        name: vehicleName.trim(),
        reg: vehicleReg.trim().toUpperCase(),
        driver_id: vehicleDriverId || null,
        status: vehicleStatus,
      });

      if (error) throw new Error(error.message);

      setVehicleName("");
      setVehicleReg("");
      setVehicleStatus("Aktiv");
    }, "Bil sparad.");
  }

  async function addTrip() {
    if (!tripVehicleId || !tripAmount) {
      setError("Välj bil och fyll i belopp.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("trips").insert({
        vehicle_id: tripVehicleId,
        driver_id: tripDriverId || null,
        amount: Number(tripAmount),
        source: tripSource,
        trip_date: tripDate,
        note: tripNote,
      });

      if (error) throw new Error(error.message);

      setTripAmount("");
      setTripSource("Avenyn Taxi");
      setTripDate(todayString());
      setTripNote("");
    }, "Intäkt sparad.");
  }

  async function addAdvance() {
    if (!advanceDriverId || !advanceAmount) {
      setError("Välj förare och fyll i belopp.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("advances").insert({
        driver_id: advanceDriverId,
        amount: Number(advanceAmount),
        note: advanceNote,
        advance_date: advanceDate,
      });

      if (error) throw new Error(error.message);

      setAdvanceAmount("");
      setAdvanceDate(todayString());
      setAdvanceNote("");
    }, "Förskott sparat.");
  }

  async function addCost() {
    if (!costVehicleId || !costAmount) {
      setError("Välj bil och fyll i belopp.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("costs").insert({
        vehicle_id: costVehicleId,
        amount: Number(costAmount),
        type: costType,
        note: costNote,
        cost_date: costDate,
      });

      if (error) throw new Error(error.message);

      setCostAmount("");
      setCostType("Service");
      setCostDate(todayString());
      setCostNote("");
    }, "Kostnad sparad.");
  }

  async function saveDriverProfile() {
    if (!selectedPayrollDriverId) {
      setError("Välj förare först.");
      return;
    }

    await runAction(async () => {
      const existing = profileMap[selectedPayrollDriverId];

      if (existing?.id) {
        const { error } = await supabase
          .from("driver_profiles")
          .update({
            full_address: profileAddress,
            personal_number: profilePersonalNumber,
            bank_name: profileBankName,
            bank_account: profileBankAccount,
            cash_handled: Number(profileCashHandled || 0),
            cash_note: profileCashNote || DEFAULT_CASH_NOTE,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("driver_profiles").insert({
          driver_id: selectedPayrollDriverId,
          full_address: profileAddress,
          personal_number: profilePersonalNumber,
          bank_name: profileBankName,
          bank_account: profileBankAccount,
          cash_handled: Number(profileCashHandled || 0),
          cash_note: profileCashNote || DEFAULT_CASH_NOTE,
        });

        if (error) throw new Error(error.message);
      }
    }, "Föraruppgifter sparade.");
  }

  async function addHaldaRow() {
    if (!haldaAmount) {
      setError("Fyll i belopp för Halda-raden.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("halda_import_rows").insert({
        trip_date: haldaTripDate,
        driver_id: haldaDriverId || null,
        vehicle_id: haldaVehicleId || null,
        amount: Number(haldaAmount || 0),
        meter_total: Number(haldaMeterTotal || 0),
        cash_amount: Number(haldaCashAmount || 0),
        card_amount: Number(haldaCardAmount || 0),
        source: "Halda M2",
        shift_code: haldaShiftCode,
        external_ref: haldaExternalRef,
        note: haldaNote,
      });

      if (error) throw new Error(error.message);

      setHaldaTripDate(todayString());
      setHaldaDriverId(drivers[0]?.id || "");
      setHaldaVehicleId("");
      setHaldaAmount("");
      setHaldaMeterTotal("");
      setHaldaCashAmount("");
      setHaldaCardAmount("");
      setHaldaShiftCode("");
      setHaldaExternalRef("");
      setHaldaNote("");
    }, "Halda-rad sparad.");
  }

  async function convertHaldaRowToTrip(row: HaldaImportRow) {
    if (row.processed) {
      setError("Denna Halda-rad är redan behandlad.");
      return;
    }

    if (!row.vehicle_id || !row.amount) {
      setError("Halda-raden måste ha bil och belopp.");
      return;
    }

    await runAction(async () => {
      const tripRes = await supabase
        .from("trips")
        .insert({
          vehicle_id: row.vehicle_id,
          driver_id: row.driver_id,
          amount: row.amount,
          source: "Halda M2",
          trip_date: row.trip_date,
          note: row.note || `Halda ref: ${row.external_ref || "-"}`,
          halda_row_id: row.id,
        })
        .select("*")
        .single();

      if (tripRes.error) throw new Error(tripRes.error.message);

      const { error } = await supabase
        .from("halda_import_rows")
        .update({
          processed: true,
          processed_trip_id: (tripRes.data as Trip).id,
        })
        .eq("id", row.id);

      if (error) throw new Error(error.message);
    }, "Halda-rad omvandlad till intäkt.");
  }

  async function deleteHaldaRow(id: string) {
    await runAction(async () => {
      const { error } = await supabase.from("halda_import_rows").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }, "Halda-rad borttagen.");
  }

  function startEditDriver(d: Driver) {
    setEditingDriverId(d.id);
    setEditDriverName(d.full_name);
    setEditDriverPhone(d.phone || "");
    setEditDriverSalaryPercent(String(d.salary_percent));
    setEditDriverActive(d.active);
  }

  function cancelEditDriver() {
    setEditingDriverId(null);
    setEditDriverName("");
    setEditDriverPhone("");
    setEditDriverSalaryPercent(String(DEFAULT_SALARY_PERCENT));
    setEditDriverActive(true);
  }

  async function saveDriverEdit(id: string) {
    await runAction(async () => {
      const { error } = await supabase
        .from("drivers")
        .update({
          full_name: editDriverName,
          phone: editDriverPhone,
          salary_percent: Number(editDriverSalaryPercent || DEFAULT_SALARY_PERCENT),
          active: editDriverActive,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      cancelEditDriver();
    }, "Förare uppdaterad.");
  }

  async function deleteDriver(id: string) {
    if (!confirm("Ta bort förare?")) return;

    await runAction(async () => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }, "Förare borttagen.");
  }

  function startEditVehicle(v: Vehicle) {
    setEditingVehicleId(v.id);
    setEditVehicleName(v.name);
    setEditVehicleReg(v.reg);
    setEditVehicleDriverId(v.driver_id || "");
    setEditVehicleStatus(v.status);
  }

  function cancelEditVehicle() {
    setEditingVehicleId(null);
    setEditVehicleName("");
    setEditVehicleReg("");
    setEditVehicleDriverId("");
    setEditVehicleStatus("Aktiv");
  }

  async function saveVehicleEdit(id: string) {
    await runAction(async () => {
      const { error } = await supabase
        .from("vehicles")
        .update({
          name: editVehicleName,
          reg: editVehicleReg.toUpperCase(),
          driver_id: editVehicleDriverId || null,
          status: editVehicleStatus,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      cancelEditVehicle();
    }, "Bil uppdaterad.");
  }

  async function deleteVehicle(id: string) {
    if (!confirm("Ta bort bilen?")) return;

    await runAction(async () => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }, "Bil borttagen.");
  }

  function startEditTrip(t: Trip) {
    setEditingTripId(t.id);
    setEditTripVehicleId(t.vehicle_id);
    setEditTripDriverId(t.driver_id || "");
    setEditTripAmount(String(t.amount));
    setEditTripSource(t.source);
    setEditTripDate(t.trip_date);
    setEditTripNote(t.note || "");
  }

  function cancelEditTrip() {
    setEditingTripId(null);
    setEditTripVehicleId("");
    setEditTripDriverId("");
    setEditTripAmount("");
    setEditTripSource("Avenyn Taxi");
    setEditTripDate(todayString());
    setEditTripNote("");
  }

  async function saveTripEdit(id: string) {
    await runAction(async () => {
      const { error } = await supabase
        .from("trips")
        .update({
          vehicle_id: editTripVehicleId,
          driver_id: editTripDriverId || null,
          amount: Number(editTripAmount || 0),
          source: editTripSource,
          trip_date: editTripDate,
          note: editTripNote,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      cancelEditTrip();
    }, "Intäkt uppdaterad.");
  }

  async function deleteTrip(id: string) {
    await runAction(async () => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }, "Intäkt borttagen.");
  }

  function startEditAdvance(a: Advance) {
    setEditingAdvanceId(a.id);
    setEditAdvanceDriverId(a.driver_id);
    setEditAdvanceAmount(String(a.amount));
    setEditAdvanceDate(a.advance_date);
    setEditAdvanceNote(a.note || "");
  }

  function cancelEditAdvance() {
    setEditingAdvanceId(null);
    setEditAdvanceDriverId("");
    setEditAdvanceAmount("");
    setEditAdvanceDate(todayString());
    setEditAdvanceNote("");
  }

  async function saveAdvanceEdit(id: string) {
    await runAction(async () => {
      const { error } = await supabase
        .from("advances")
        .update({
          driver_id: editAdvanceDriverId,
          amount: Number(editAdvanceAmount || 0),
          note: editAdvanceNote,
          advance_date: editAdvanceDate,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      cancelEditAdvance();
    }, "Förskott uppdaterat.");
  }

  async function deleteAdvance(id: string) {
    await runAction(async () => {
      const { error } = await supabase.from("advances").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }, "Förskott borttaget.");
  }

  function startEditCost(c: Cost) {
    setEditingCostId(c.id);
    setEditCostVehicleId(c.vehicle_id);
    setEditCostAmount(String(c.amount));
    setEditCostType(c.type);
    setEditCostDate(c.cost_date);
    setEditCostNote(c.note || "");
  }

  function cancelEditCost() {
    setEditingCostId(null);
    setEditCostVehicleId("");
    setEditCostAmount("");
    setEditCostType("Service");
    setEditCostDate(todayString());
    setEditCostNote("");
  }

  async function saveCostEdit(id: string) {
    await runAction(async () => {
      const { error } = await supabase
        .from("costs")
        .update({
          vehicle_id: editCostVehicleId,
          amount: Number(editCostAmount || 0),
          type: editCostType,
          note: editCostNote,
          cost_date: editCostDate,
        })
        .eq("id", id);

      if (error) throw new Error(error.message);
      cancelEditCost();
    }, "Kostnad uppdaterad.");
  }

  async function deleteCost(id: string) {
    await runAction(async () => {
      const { error } = await supabase.from("costs").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }, "Kostnad borttagen.");
  }

  function startTracking() {
    if (!navigator.geolocation) {
      setError("Din enhet stödjer inte GPS.");
      return;
    }

    setError("");
    setSuccess("");

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveLat(pos.coords.latitude);
        setLiveLng(pos.coords.longitude);
        setLiveAccuracy(pos.coords.accuracy);
        setLiveSpeed(pos.coords.speed);
        setLiveHeading(pos.coords.heading);
        setTrackingActive(true);
      },
      (err) => {
        setTrackingActive(false);
        setError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    watchIdRef.current = id;
  }

  function stopTracking() {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setTrackingActive(false);
  }

  async function saveCurrentLocation() {
    if (!selectedTrackerVehicleId) {
      setError("Välj bil för GPS först.");
      return;
    }

    if (liveLat == null || liveLng == null) {
      setError("Ingen GPS-position hittades.");
      return;
    }

    await runAction(async () => {
      const existing = locationMap[selectedTrackerVehicleId];

      const payload = {
        vehicle_id: selectedTrackerVehicleId,
        lat: liveLat,
        lng: liveLng,
        accuracy: liveAccuracy,
        speed: liveSpeed,
        heading: liveHeading,
        updated_at: new Date().toISOString(),
      };

      const result = existing
        ? await supabase.from("vehicle_locations").update(payload).eq("id", existing.id)
        : await supabase.from("vehicle_locations").insert(payload);

      if (result.error) throw new Error(result.error.message);
    }, "GPS-position sparad.");
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f7f4",
        padding: 18,
        fontFamily: "Arial, sans-serif",
        color: "#111827",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        .container { max-width: 1300px; margin: 0 auto; }
        .topbar { background: #fff; border: 1px solid #ece7da; border-radius: 16px; padding: 16px 18px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .top-title { font-size: 28px; font-weight: 900; margin: 0; color: #111827; }
        .top-sub { margin: 6px 0 0; color: #6b7280; font-size: 14px; font-weight: 600; }
        .stats-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
        .stat { background: #fff; border: 1px solid #ece7da; border-radius: 14px; padding: 14px; }
        .stat-label { font-size: 12px; color: #6b7280; font-weight: 700; margin-bottom: 8px; }
        .stat-value { font-size: 26px; font-weight: 900; line-height: 1.1; }
        .stat-sub { margin-top: 6px; color: #6b7280; font-size: 12px; font-weight: 600; }
        .card { background: #fff; border: 1px solid #ece7da; border-radius: 16px; padding: 16px; margin-bottom: 14px; }
        .card-title { margin: 0 0 12px; font-size: 20px; font-weight: 900; color: #111827; }
        .card-subtitle { margin: -4px 0 12px; font-size: 13px; color: #6b7280; }
        .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .label { display: block; font-size: 12px; color: #6b7280; font-weight: 800; margin-bottom: 6px; }
        .input, .select { width: 100%; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; padding: 13px 14px; font-size: 15px; font-weight: 700; color: #111827; outline: none; }
        .input:focus, .select:focus { border-color: #f2b233; box-shadow: 0 0 0 3px rgba(242, 178, 51, 0.15); }
        .money-input { font-size: 19px; font-weight: 900; }
        .btn { border: 0; border-radius: 10px; padding: 11px 16px; font-size: 14px; font-weight: 800; cursor: pointer; }
        .btn-yellow { background: #e9b13b; color: #fff; }
        .btn-yellow:hover { background: #dca22d; }
        .btn-red { background: #d65c4f; color: #fff; }
        .btn-red:hover { background: #c84b3e; }
        .btn-gray { background: #ece7da; color: #111827; }
        .btn-dark { background: #111827; color: #fff; }
        .row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .alert-error, .alert-success { padding: 12px 14px; border-radius: 12px; margin-bottom: 12px; font-weight: 700; }
        .alert-error { background: #fff1f1; color: #a52b2b; border: 1px solid #efc8c8; }
        .alert-success { background: #eefbf1; color: #1f7a3d; border: 1px solid #bde3c8; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { text-align: left; padding: 12px 8px; border-bottom: 1px solid #f0ece2; vertical-align: top; }
        th { color: #6b7280; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        .gps-box { border: 1px solid #f0ece2; border-radius: 14px; padding: 14px; background: #fcfbf8; }
        .gps-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .gps-stat { background: #fff; border: 1px solid #f0ece2; border-radius: 10px; padding: 10px 12px; font-size: 13px; font-weight: 700; color: #374151; }
        .map-frame { width: 100%; height: 360px; border: 1px solid #f0ece2; border-radius: 14px; }
        .payroll-box { background: #fff; border: 1px solid #ece7da; border-radius: 16px; padding: 18px; }
        .payroll-head { display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; border-bottom: 1px solid #d9d4c7; padding-bottom: 12px; margin-bottom: 14px; }
        .payroll-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; padding: 8px 0; border-bottom: 1px dashed #ece7da; }
        .payroll-grid { display: grid; grid-template-columns: 100px 1fr 110px 1fr; gap: 8px; font-size: 13px; padding: 6px 0; border-bottom: 1px dashed #ece7da; }
        @media (max-width: 1100px) {
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
          .gps-grid { grid-template-columns: 1fr; }
        }
        @media print {
          body * { visibility: hidden; }
          .payroll-box, .payroll-box * { visibility: visible; }
          .payroll-box { position: absolute; top: 0; left: 0; width: 100%; border: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="container">
        <div className="topbar">
          <h1 className="top-title">{COMPANY.name}</h1>
          <p className="top-sub">Halda M2 Ready • Förare, bilar, intäkter, GPS och lönespecifikation</p>
        </div>

        {error ? <div className="alert-error">{error}</div> : null}
        {success ? <div className="alert-success">{success}</div> : null}

        <div className="stats-grid">
          <div className="stat">
            <div className="stat-label">Förare</div>
            <div className="stat-value">{drivers.length}</div>
            <div className="stat-sub">Aktiva i systemet</div>
          </div>
          <div className="stat">
            <div className="stat-label">Bilar</div>
            <div className="stat-value">{vehicles.length}</div>
            <div className="stat-sub">{activeVehicles} aktiva</div>
          </div>
          <div className="stat">
            <div className="stat-label">Periodens intäkt</div>
            <div className="stat-value">{money(totalIncome)}</div>
            <div className="stat-sub">{topDriver?.name || "-"} bäst just nu</div>
          </div>
          <div className="stat">
            <div className="stat-label">Kostnader</div>
            <div className="stat-value">{money(totalCosts)}</div>
            <div className="stat-sub">Period</div>
          </div>
          <div className="stat">
            <div className="stat-label">Förskott</div>
            <div className="stat-value">{money(totalAdvances)}</div>
            <div className="stat-sub">Period</div>
          </div>
          <div className="stat">
            <div className="stat-label">Halda-rader</div>
            <div className="stat-value">{haldaRows.length}</div>
            <div className="stat-sub">{processedHaldaCount} behandlade</div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Periodfilter</h2>
          <div className="grid-4">
            <div>
              <label className="label">Från</label>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Till</label>
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button
                className="btn btn-gray"
                onClick={() => {
                  setFromDate(firstDayOfMonth());
                  setToDate(todayString());
                }}
              >
                Denna månad
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button className="btn btn-gray" onClick={loadAll} disabled={loading || saving}>
                Uppdatera
              </button>
            </div>
          </div>
        </div>

        <div className="grid-3">
          <div className="card">
            <h2 className="card-title">Lägg till förare</h2>
            <div>
              <label className="label">Namn</label>
              <input className="input" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="label">Telefon</label>
              <input className="input" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="label">Löneprocent</label>
              <input
                className="input"
                type="number"
                value={driverSalaryPercent}
                onChange={(e) => setDriverSalaryPercent(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-yellow" onClick={addDriver} disabled={saving}>
                Lägg till förare
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Lägg till bil</h2>
            <div>
              <label className="label">Bilnamn</label>
              <input className="input" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="label">Regnr</label>
              <input className="input" value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} />
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="label">Förare</label>
              <select className="select" value={vehicleDriverId} onChange={(e) => setVehicleDriverId(e.target.value)}>
                <option value="">Ingen</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="label">Status</label>
              <select className="select" value={vehicleStatus} onChange={(e) => setVehicleStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-yellow" onClick={addVehicle} disabled={saving}>
                Lägg till bil
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Lägg till intäkt</h2>
            <div>
              <label className="label">Bil</label>
              <select className="select" value={tripVehicleId} onChange={(e) => setTripVehicleId(e.target.value)}>
                <option value="">Välj bil</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.reg})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="label">Förare</label>
              <select className="select" value={tripDriverId} onChange={(e) => setTripDriverId(e.target.value)}>
                <option value="">Ingen</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Belopp</label>
                <input
                  className="input money-input"
                  type="number"
                  value={tripAmount}
                  onChange={(e) => setTripAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Källa</label>
                <select className="select" value={tripSource} onChange={(e) => setTripSource(e.target.value)}>
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Datum</label>
                <input className="input" type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Notering</label>
                <input className="input" value={tripNote} onChange={(e) => setTripNote(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-yellow" onClick={addTrip} disabled={saving}>
                Lägg till intäkt
              </button>
            </div>
          </div>
        </div>

        <div className="grid-3">
          <div className="card">
            <h2 className="card-title">Lägg till förskott</h2>
            <div>
              <label className="label">Förare</label>
              <select className="select" value={advanceDriverId} onChange={(e) => setAdvanceDriverId(e.target.value)}>
                <option value="">Välj förare</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Belopp</label>
                <input
                  className="input money-input"
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Datum</label>
                <input
                  className="input"
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label className="label">Notering</label>
              <input className="input" value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)} />
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-yellow" onClick={addAdvance} disabled={saving}>
                Lägg till förskott
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Lägg till kostnad</h2>
            <div>
              <label className="label">Bil</label>
              <select className="select" value={costVehicleId} onChange={(e) => setCostVehicleId(e.target.value)}>
                <option value="">Välj bil</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.reg})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Belopp</label>
                <input
                  className="input money-input"
                  type="number"
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Kategori</label>
                <select className="select" value={costType} onChange={(e) => setCostType(e.target.value)}>
                  {COST_TYPE_OPTIONS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Datum</label>
                <input className="input" type="date" value={costDate} onChange={(e) => setCostDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Notering</label>
                <input className="input" value={costNote} onChange={(e) => setCostNote(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-yellow" onClick={addCost} disabled={saving}>
                Lägg till kostnad
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">GPS + karta</h2>
            <div className="gps-box">
              <label className="label">Bil</label>
              <select
                className="select"
                value={selectedTrackerVehicleId}
                onChange={(e) => setSelectedTrackerVehicleId(e.target.value)}
              >
                <option value="">Välj bil</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.reg})
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button className="btn btn-yellow" onClick={startTracking} disabled={saving || trackingActive}>
                  Starta GPS
                </button>
                <button className="btn btn-gray" onClick={stopTracking} disabled={saving || !trackingActive}>
                  Stoppa GPS
                </button>
                <button className="btn btn-dark" onClick={saveCurrentLocation} disabled={saving}>
                  Spara position
                </button>
              </div>

              <div className="gps-grid">
                <div className="gps-stat">Status: {trackingActive ? "GPS aktiv" : "GPS stoppad"}</div>
                <div className="gps-stat">Senast: {prettyDateTime(selectedTrackerLocation?.updated_at)}</div>
                <div className="gps-stat">Lat: {liveLat ?? selectedTrackerLocation?.lat ?? "-"}</div>
                <div className="gps-stat">Lng: {liveLng ?? selectedTrackerLocation?.lng ?? "-"}</div>
                <div className="gps-stat">Precision: {liveAccuracy ?? selectedTrackerLocation?.accuracy ?? "-"}</div>
                <div className="gps-stat">Hastighet: {liveSpeed ?? selectedTrackerLocation?.speed ?? "-"}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <iframe
                title="Karta"
                className="map-frame"
                src={mapUrl(liveLat ?? selectedTrackerLocation?.lat, liveLng ?? selectedTrackerLocation?.lng)}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Halda M2 Ready</h2>
          <p className="card-subtitle">Lägg in Halda-rader manuellt nu. Sen kan vi bygga vidare till importflöde.</p>

          <div className="grid-4">
            <div>
              <label className="label">Datum</label>
              <input className="input" type="date" value={haldaTripDate} onChange={(e) => setHaldaTripDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Förare</label>
              <select className="select" value={haldaDriverId} onChange={(e) => setHaldaDriverId(e.target.value)}>
                <option value="">Ingen</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Bil</label>
              <select className="select" value={haldaVehicleId} onChange={(e) => setHaldaVehicleId(e.target.value)}>
                <option value="">Ingen</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.reg})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Belopp</label>
              <input className="input money-input" type="number" value={haldaAmount} onChange={(e) => setHaldaAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Taxameter totalt</label>
              <input className="input" type="number" value={haldaMeterTotal} onChange={(e) => setHaldaMeterTotal(e.target.value)} />
            </div>
            <div>
              <label className="label">Kontant</label>
              <input className="input" type="number" value={haldaCashAmount} onChange={(e) => setHaldaCashAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Kort</label>
              <input className="input" type="number" value={haldaCardAmount} onChange={(e) => setHaldaCardAmount(e.target.value)} />
            </div>
            <div>
              <label className="label">Skiftkod</label>
              <input className="input" value={haldaShiftCode} onChange={(e) => setHaldaShiftCode(e.target.value)} />
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 10 }}>
            <div>
              <label className="label">Extern referens</label>
              <input className="input" value={haldaExternalRef} onChange={(e) => setHaldaExternalRef(e.target.value)} />
            </div>
            <div>
              <label className="label">Notering</label>
              <input className="input" value={haldaNote} onChange={(e) => setHaldaNote(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="btn btn-yellow" onClick={addHaldaRow} disabled={saving}>
              Spara Halda-rad
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Förare</th>
                  <th>Bil</th>
                  <th>Belopp</th>
                  <th>Skift</th>
                  <th>Ref</th>
                  <th>Status</th>
                  <th>Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {haldaRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.trip_date}</td>
                    <td>{row.driver_id ? driverMap[row.driver_id]?.full_name || "-" : "-"}</td>
                    <td>
                      {row.vehicle_id
                        ? `${vehicleMap[row.vehicle_id]?.name || "-"} (${vehicleMap[row.vehicle_id]?.reg || "-"})`
                        : "-"}
                    </td>
                    <td>{money(row.amount)}</td>
                    <td>{row.shift_code || "-"}</td>
                    <td>{row.external_ref || "-"}</td>
                    <td>{row.processed ? "Behandlad" : "Ej behandlad"}</td>
                    <td>
                      <div className="row-actions">
                        {!row.processed ? (
                          <button className="btn btn-yellow" onClick={() => convertHaldaRowToTrip(row)}>
                            Skapa intäkt
                          </button>
                        ) : null}
                        <button className="btn btn-red" onClick={() => deleteHaldaRow(row.id)}>
                          Ta bort
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {haldaRows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Inga Halda-rader ännu.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Förare</h2>
          <table>
            <thead>
              <tr>
                <th>Namn</th>
                <th>Telefon</th>
                <th>Löneprocent</th>
                <th>Aktiv</th>
                <th>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => {
                const isEditing = editingDriverId === d.id;

                return (
                  <tr key={d.id}>
                    <td>
                      {isEditing ? (
                        <input className="input" value={editDriverName} onChange={(e) => setEditDriverName(e.target.value)} />
                      ) : (
                        d.full_name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="input" value={editDriverPhone} onChange={(e) => setEditDriverPhone(e.target.value)} />
                      ) : (
                        d.phone || "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="input"
                          type="number"
                          value={editDriverSalaryPercent}
                          onChange={(e) => setEditDriverSalaryPercent(e.target.value)}
                        />
                      ) : (
                        `${d.salary_percent}%`
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="select"
                          value={editDriverActive ? "1" : "0"}
                          onChange={(e) => setEditDriverActive(e.target.value === "1")}
                        >
                          <option value="1">Ja</option>
                          <option value="0">Nej</option>
                        </select>
                      ) : d.active ? (
                        "Ja"
                      ) : (
                        "Nej"
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {isEditing ? (
                          <>
                            <button className="btn btn-yellow" onClick={() => saveDriverEdit(d.id)}>
                              Spara
                            </button>
                            <button className="btn btn-gray" onClick={cancelEditDriver}>
                              Avbryt
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-yellow" onClick={() => startEditDriver(d)}>
                              Redigera
                            </button>
                            <button className="btn btn-red" onClick={() => deleteDriver(d.id)}>
                              Ta bort
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="card-title">Bilar</h2>
          <table>
            <thead>
              <tr>
                <th>Bil</th>
                <th>Regnr</th>
                <th>Förare</th>
                <th>Status</th>
                <th>Senaste GPS</th>
                <th>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const isEditing = editingVehicleId === v.id;
                const loc = locationMap[v.id];

                return (
                  <tr key={v.id}>
                    <td>
                      {isEditing ? (
                        <input className="input" value={editVehicleName} onChange={(e) => setEditVehicleName(e.target.value)} />
                      ) : (
                        v.name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input className="input" value={editVehicleReg} onChange={(e) => setEditVehicleReg(e.target.value)} />
                      ) : (
                        v.reg
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="select"
                          value={editVehicleDriverId}
                          onChange={(e) => setEditVehicleDriverId(e.target.value)}
                        >
                          <option value="">Ingen</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.full_name}
                            </option>
                          ))}
                        </select>
                      ) : v.driver_id ? (
                        driverMap[v.driver_id]?.full_name || "-"
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select className="select" value={editVehicleStatus} onChange={(e) => setEditVehicleStatus(e.target.value)}>
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        v.status
                      )}
                    </td>
                    <td>{loc ? `${loc.lat}, ${loc.lng}` : "-"}</td>
                    <td>
                      <div className="row-actions">
                        {isEditing ? (
                          <>
                            <button className="btn btn-yellow" onClick={() => saveVehicleEdit(v.id)}>
                              Spara
                            </button>
                            <button className="btn btn-gray" onClick={cancelEditVehicle}>
                              Avbryt
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-yellow" onClick={() => startEditVehicle(v)}>
                              Redigera
                            </button>
                            <button className="btn btn-red" onClick={() => deleteVehicle(v.id)}>
                              Ta bort
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid-2">
          <div className="card">
            <h2 className="card-title">Intäkter</h2>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Bil</th>
                  <th>Förare</th>
                  <th>Källa</th>
                  <th>Belopp</th>
                  <th>Notering</th>
                  <th>Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {periodTrips.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {editingTripId === t.id ? (
                        <input className="input" type="date" value={editTripDate} onChange={(e) => setEditTripDate(e.target.value)} />
                      ) : (
                        t.trip_date
                      )}
                    </td>
                    <td>
                      {editingTripId === t.id ? (
                        <select className="select" value={editTripVehicleId} onChange={(e) => setEditTripVehicleId(e.target.value)}>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.reg})
                            </option>
                          ))}
                        </select>
                      ) : (
                        `${vehicleMap[t.vehicle_id]?.name || "-"} (${vehicleMap[t.vehicle_id]?.reg || "-"})`
                      )}
                    </td>
                    <td>
                      {editingTripId === t.id ? (
                        <select className="select" value={editTripDriverId} onChange={(e) => setEditTripDriverId(e.target.value)}>
                          <option value="">Ingen</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.full_name}
                            </option>
                          ))}
                        </select>
                      ) : t.driver_id ? (
                        driverMap[t.driver_id]?.full_name || "-"
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {editingTripId === t.id ? (
                        <select className="select" value={editTripSource} onChange={(e) => setEditTripSource(e.target.value)}>
                          {SOURCE_OPTIONS.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        t.source
                      )}
                    </td>
                    <td>
                      {editingTripId === t.id ? (
                        <input
                          className="input money-input"
                          type="number"
                          value={editTripAmount}
                          onChange={(e) => setEditTripAmount(e.target.value)}
                        />
                      ) : (
                        money(t.amount)
                      )}
                    </td>
                    <td>
                      {editingTripId === t.id ? (
                        <input className="input" value={editTripNote} onChange={(e) => setEditTripNote(e.target.value)} />
                      ) : (
                        t.note || "-"
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {editingTripId === t.id ? (
                          <>
                            <button className="btn btn-yellow" onClick={() => saveTripEdit(t.id)}>
                              Spara
                            </button>
                            <button className="btn btn-gray" onClick={cancelEditTrip}>
                              Avbryt
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-yellow" onClick={() => startEditTrip(t)}>
                              Redigera
                            </button>
                            <button className="btn btn-red" onClick={() => deleteTrip(t.id)}>
                              Ta bort
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {periodTrips.length === 0 ? (
                  <tr>
                    <td colSpan={7}>Inga intäkter i vald period.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 className="card-title">Kostnader</h2>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Bil</th>
                  <th>Typ</th>
                  <th>Belopp</th>
                  <th>Notering</th>
                  <th>Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {periodCosts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {editingCostId === c.id ? (
                        <input className="input" type="date" value={editCostDate} onChange={(e) => setEditCostDate(e.target.value)} />
                      ) : (
                        c.cost_date
                      )}
                    </td>
                    <td>
                      {editingCostId === c.id ? (
                        <select className="select" value={editCostVehicleId} onChange={(e) => setEditCostVehicleId(e.target.value)}>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.reg})
                            </option>
                          ))}
                        </select>
                      ) : (
                        `${vehicleMap[c.vehicle_id]?.name || "-"} (${vehicleMap[c.vehicle_id]?.reg || "-"})`
                      )}
                    </td>
                    <td>
                      {editingCostId === c.id ? (
                        <select className="select" value={editCostType} onChange={(e) => setEditCostType(e.target.value)}>
                          {COST_TYPE_OPTIONS.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      ) : (
                        c.type
                      )}
                    </td>
                    <td>
                      {editingCostId === c.id ? (
                        <input
                          className="input money-input"
                          type="number"
                          value={editCostAmount}
                          onChange={(e) => setEditCostAmount(e.target.value)}
                        />
                      ) : (
                        money(c.amount)
                      )}
                    </td>
                    <td>
                      {editingCostId === c.id ? (
                        <input className="input" value={editCostNote} onChange={(e) => setEditCostNote(e.target.value)} />
                      ) : (
                        c.note || "-"
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {editingCostId === c.id ? (
                          <>
                            <button className="btn btn-yellow" onClick={() => saveCostEdit(c.id)}>
                              Spara
                            </button>
                            <button className="btn btn-gray" onClick={cancelEditCost}>
                              Avbryt
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-yellow" onClick={() => startEditCost(c)}>
                              Redigera
                            </button>
                            <button className="btn btn-red" onClick={() => deleteCost(c.id)}>
                              Ta bort
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {periodCosts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Inga kostnader i vald period.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Förskott</h2>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Förare</th>
                <th>Belopp</th>
                <th>Notering</th>
                <th>Åtgärder</th>
              </tr>
            </thead>
            <tbody>
              {periodAdvances.map((a) => (
                <tr key={a.id}>
                  <td>
                    {editingAdvanceId === a.id ? (
                      <input className="input" type="date" value={editAdvanceDate} onChange={(e) => setEditAdvanceDate(e.target.value)} />
                    ) : (
                      a.advance_date
                    )}
                  </td>
                  <td>
                    {editingAdvanceId === a.id ? (
                      <select className="select" value={editAdvanceDriverId} onChange={(e) => setEditAdvanceDriverId(e.target.value)}>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      driverMap[a.driver_id]?.full_name || "-"
                    )}
                  </td>
                  <td>
                    {editingAdvanceId === a.id ? (
                      <input
                        className="input money-input"
                        type="number"
                        value={editAdvanceAmount}
                        onChange={(e) => setEditAdvanceAmount(e.target.value)}
                      />
                    ) : (
                      money(a.amount)
                    )}
                  </td>
                  <td>
                    {editingAdvanceId === a.id ? (
                      <input className="input" value={editAdvanceNote} onChange={(e) => setEditAdvanceNote(e.target.value)} />
                    ) : (
                      a.note || "-"
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      {editingAdvanceId === a.id ? (
                        <>
                          <button className="btn btn-yellow" onClick={() => saveAdvanceEdit(a.id)}>
                            Spara
                          </button>
                          <button className="btn btn-gray" onClick={cancelEditAdvance}>
                            Avbryt
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-yellow" onClick={() => startEditAdvance(a)}>
                            Redigera
                          </button>
                          <button className="btn btn-red" onClick={() => deleteAdvance(a.id)}>
                            Ta bort
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {periodAdvances.length === 0 ? (
                <tr>
                  <td colSpan={5}>Inga förskott i vald period.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="card-title">Förares sammanställning</h2>
          <table>
            <thead>
              <tr>
                <th>Förare</th>
                <th>Intäkt</th>
                <th>Kostnader</th>
                <th>Lön</th>
                <th>Förskott</th>
                <th>Nettolön</th>
              </tr>
            </thead>
            <tbody>
              {driverSummary.map((row) => (
                <tr key={row.driver.id}>
                  <td>{row.driver.full_name}</td>
                  <td>{money(row.income)}</td>
                  <td>{money(row.costs)}</td>
                  <td>
                    {money(row.salary)} ({row.driver.salary_percent}%)
                  </td>
                  <td>{money(row.advances)}</td>
                  <td>{money(row.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="card-title">Förare uppgifter för lönespec</h2>

          <div className="grid-3">
            <div>
              <label className="label">Förare</label>
              <select
                className="select"
                value={selectedPayrollDriverId}
                onChange={(e) => setSelectedPayrollDriverId(e.target.value)}
              >
                <option value="">Välj förare</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Full adress</label>
              <input className="input" value={profileAddress} onChange={(e) => setProfileAddress(e.target.value)} />
            </div>
            <div>
              <label className="label">Personnummer</label>
              <input
                className="input"
                value={profilePersonalNumber}
                onChange={(e) => setProfilePersonalNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Bank</label>
              <input className="input" value={profileBankName} onChange={(e) => setProfileBankName(e.target.value)} />
            </div>
            <div>
              <label className="label">Kontonummer</label>
              <input
                className="input"
                value={profileBankAccount}
                onChange={(e) => setProfileBankAccount(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Kontanter period</label>
              <input
                className="input money-input"
                value={profileCashHandled}
                onChange={(e) => setProfileCashHandled(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">Info om kontanter</label>
              <input className="input" value={profileCashNote} onChange={(e) => setProfileCashNote(e.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 14 }} className="no-print">
            <button className="btn btn-yellow" onClick={saveDriverProfile} disabled={saving}>
              Spara föraruppgifter
            </button>
          </div>

          <div className="payroll-box" style={{ marginTop: 16 }}>
            <div className="payroll-head">
              <div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{COMPANY.name}</div>
                <div>{COMPANY.legalName}</div>
                <div>Org.nr: {COMPANY.orgnr}</div>
                <div>{COMPANY.city}</div>
                <div>{COMPANY.website}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>Lönespecifikation</div>
                <div>
                  Period: {fromDate} - {toDate}
                </div>
                <div>Förare: {selectedDriver?.full_name || "-"}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="payroll-row">
                <div>Namn</div>
                <div>{selectedDriver?.full_name || "-"}</div>
              </div>
              <div className="payroll-row">
                <div>Adress</div>
                <div>{profileAddress || "-"}</div>
              </div>
              <div className="payroll-row">
                <div>Personnummer</div>
                <div>{profilePersonalNumber || "-"}</div>
              </div>
              <div className="payroll-row">
                <div>Bank</div>
                <div>{profileBankName || "-"}</div>
              </div>
              <div className="payroll-row">
                <div>Kontonummer</div>
                <div>{profileBankAccount || "-"}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="payroll-row">
                <div>Intäkt under period</div>
                <div>{money(payrollIncome)}</div>
              </div>
              <div className="payroll-row">
                <div>Lön {payrollSalaryPct}%</div>
                <div>{money(payrollSalary)}</div>
              </div>
              <div className="payroll-row">
                <div>Förskott</div>
                <div>- {money(payrollAdvanceTotal)}</div>
              </div>
              <div className="payroll-row">
                <div>Nettolön</div>
                <div>
                  <strong>{money(payrollNet)}</strong>
                </div>
              </div>
              <div className="payroll-row">
                <div>Bilkostnader under period</div>
                <div>{money(payrollCostTotal)}</div>
              </div>
              <div className="payroll-row">
                <div>Kontanter period</div>
                <div>{profileCashHandled || "-"}</div>
              </div>
              <div className="payroll-row">
                <div>Info</div>
                <div>{profileCashNote || DEFAULT_CASH_NOTE}</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="payroll-grid" style={{ fontWeight: 800 }}>
                <div>Datum</div>
                <div>Bil / Källa</div>
                <div>Belopp</div>
                <div>Notering</div>
              </div>
              {payrollTrips.map((t) => (
                <div className="payroll-grid" key={t.id}>
                  <div>{t.trip_date}</div>
                  <div>
                    {vehicleMap[t.vehicle_id]?.name || "-"} ({vehicleMap[t.vehicle_id]?.reg || "-"}) - {t.source}
                  </div>
                  <div>{money(t.amount)}</div>
                  <div>{t.note || "-"}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="payroll-grid" style={{ fontWeight: 800 }}>
                <div>Datum</div>
                <div>Förare</div>
                <div>Belopp</div>
                <div>Notering</div>
              </div>
              {payrollAdvances.map((a) => (
                <div className="payroll-grid" key={a.id}>
                  <div>{a.advance_date}</div>
                  <div>{driverMap[a.driver_id]?.full_name || "-"}</div>
                  <div>{money(a.amount)}</div>
                  <div>{a.note || "-"}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }} className="no-print">
              <button className="btn btn-yellow" onClick={() => window.print()}>
                Skriv ut lönespec
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Översikt</h2>
          <div className="grid-4">
            <div className="stat">
              <div className="stat-label">Beräknad lönebas</div>
              <div className="stat-value">{money(estimatedSalaryBase)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Efter förskott</div>
              <div className="stat-value">{money(estimatedNetAfterAdvances)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Bolagets resultat</div>
              <div className="stat-value">{money(companyResult)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Laddning</div>
              <div className="stat-value">{loading ? "Ja" : "Nej"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}