"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  CarFront,
  UserRound,
  Wallet,
  BadgeDollarSign,
  TrendingUp,
  MapPinned,
  Trash2,
  Pencil,
  Plus,
  FileSpreadsheet,
  FileText,
  RefreshCcw,
  Receipt,
  Wrench,
  Upload,
  Search,
  Printer,
  LogOut,
  ShieldCheck,
  CalendarDays,
  Route,
} from "lucide-react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

const COMPANY = {
  name: "Avenyn Taxi",
  legalName: "Citra Trans och Bilservice AB",
  city: "Göteborg",
  website: "avenyntaxi.se",
  orgNumber: "559000-0000",
};

const STATUS_OPTIONS = ["Aktiv", "På service", "Service bokad", "Uthyrd", "Offline"] as const;
const SOURCE_OPTIONS = ["Avenyn Taxi", "Uber", "Bolt", "Kontant", "Swish", "Halda M2"] as const;
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
] as const;
const BOOKING_STATUS_OPTIONS = ["Ny", "Tilldelad", "På väg", "Hämtad", "Klar", "Avbokad"] as const;

const DEFAULT_SALARY_PERCENT = 33;
const DEFAULT_CASH_NOTE = "Kontanthantering påverkar ej lönen, endast informationsrad";

type AppRole = "admin" | "driver";
type ProfileDbRole = "Admin" | "Partner" | "Ekonomi";

type Driver = {
  id: string;
  full_name: string;
  phone: string | null;
  salary_percent: number | null;
  active: boolean | null;
  auth_user_id?: string | null;
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
  vehicle_id: string | null;
  driver_id: string | null;
  amount: number;
  source: string;
  trip_date: string;
  note: string | null;
  halda_row_id?: string | null;
  created_at?: string;
};

type Advance = {
  id: string;
  driver_id: string;
  amount: number;
  note: string | null;
  advance_date: string;
  created_at?: string;
};

type Cost = {
  id: string;
  vehicle_id: string | null;
  amount: number;
  type: string;
  note: string | null;
  cost_date: string;
  created_at?: string;
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
  meter_total?: number | null;
  cash_amount?: number | null;
  card_amount?: number | null;
  source: string;
  shift_code?: string | null;
  external_ref?: string | null;
  note?: string | null;
  processed: boolean | null;
  processed_trip_id?: string | null;
  created_at?: string;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  role: ProfileDbRole;
  status: string | null;
  created_at?: string | null;
  email: string | null;
};

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  pickup_address: string;
  dropoff_address: string | null;
  booking_time: string;
  status: string;
  driver_id: string | null;
  vehicle_id: string | null;
  note: string | null;
  price: number | null;
  created_at?: string;
};

function todayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function nowDateTimeLocalString() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function monthNameSv(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });
}

function money(n: number | string | null | undefined) {
  return `${Number(n || 0).toLocaleString("sv-SE")} kr`;
}

function prettyDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("sv-SE");
}

function prettyDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("sv-SE");
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

function mapUrl(lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return "";
  const delta = 0.02;
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function normalizeNumber(v: string | number | null | undefined) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  return Number(String(v).replace(/\s/g, "").replace(",", ".")) || 0;
}

function parseCSVLine(line: string) {
  const delimiter = line.includes(";") ? ";" : ",";
  return line.split(delimiter).map((x) => x.trim());
}

function classNames(...arr: Array<string | false | null | undefined>) {
  return arr.filter(Boolean).join(" ");
}

function mapDbRoleToAppRole(dbRole?: string | null): AppRole {
  if (dbRole === "Admin" || dbRole === "Ekonomi") return "admin";
  return "driver";
}

function mapAppRoleToDbRole(role: AppRole): ProfileDbRole {
  return role === "admin" ? "Admin" : "Partner";
}

export default function Page() {
  const printRef = useRef<HTMLDivElement | null>(null);

  const [bootLoading, setBootLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profileRecord, setProfileRecord] = useState<ProfileRecord | null>(null);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [driverProfiles, setDriverProfiles] = useState<DriverProfile[]>([]);
  const [locations, setLocations] = useState<VehicleLocation[]>([]);
  const [haldaRows, setHaldaRows] = useState<HaldaImportRow[]>([]);
  const [allProfiles, setAllProfiles] = useState<ProfileRecord[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(todayString());

  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverSalaryPercent, setDriverSalaryPercent] = useState<number>(DEFAULT_SALARY_PERCENT);

  const [vehicleName, setVehicleName] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState<string>("Aktiv");
  const [vehicleDriverId, setVehicleDriverId] = useState<string>("");

  const [tripVehicleId, setTripVehicleId] = useState<string>("");
  const [tripDriverId, setTripDriverId] = useState<string>("");
  const [tripAmount, setTripAmount] = useState<number>(0);
  const [tripSource, setTripSource] = useState<string>("Avenyn Taxi");
  const [tripDate, setTripDate] = useState<string>(todayString());
  const [tripNote, setTripNote] = useState<string>("");

  const [advanceDriverId, setAdvanceDriverId] = useState<string>("");
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceDate, setAdvanceDate] = useState<string>(todayString());
  const [advanceNote, setAdvanceNote] = useState<string>("");

  const [costVehicleId, setCostVehicleId] = useState<string>("");
  const [costAmount, setCostAmount] = useState<number>(0);
  const [costType, setCostType] = useState<string>("Service");
  const [costDate, setCostDate] = useState<string>(todayString());
  const [costNote, setCostNote] = useState<string>("");

  const [selectedPayrollDriverId, setSelectedPayrollDriverId] = useState<string>("");
  const [selectedTrackerVehicleId, setSelectedTrackerVehicleId] = useState<string>("");

  const [profileForm, setProfileForm] = useState<DriverProfile>({
    driver_id: "",
    full_address: "",
    personal_number: "",
    bank_name: "",
    bank_account: "",
    cash_handled: 0,
    cash_note: DEFAULT_CASH_NOTE,
  });

  const [haldaPaste, setHaldaPaste] = useState("");
  const [haldaDriverId, setHaldaDriverId] = useState<string>("");
  const [haldaVehicleId, setHaldaVehicleId] = useState<string>("");
  const [haldaDefaultSource, setHaldaDefaultSource] = useState<string>("Halda M2");
  const [searchText, setSearchText] = useState("");

  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState("");
  const [selectedLinkDriverId, setSelectedLinkDriverId] = useState("");

  const [bookingCustomerName, setBookingCustomerName] = useState("");
  const [bookingCustomerPhone, setBookingCustomerPhone] = useState("");
  const [bookingPickupAddress, setBookingPickupAddress] = useState("");
  const [bookingDropoffAddress, setBookingDropoffAddress] = useState("");
  const [bookingDateTime, setBookingDateTime] = useState(nowDateTimeLocalString());
  const [bookingStatus, setBookingStatus] = useState<string>("Ny");
  const [bookingDriverId, setBookingDriverId] = useState<string>("");
  const [bookingVehicleId, setBookingVehicleId] = useState<string>("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingPrice, setBookingPrice] = useState<number>(0);

  useEffect(() => {
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setRole(null);
        setProfileRecord(null);
        setCurrentDriver(null);
        resetAllData();
        setLoading(false);
        setBootLoading(false);
        return;
      }

      try {
        await loadAll(nextUser);
      } catch (e: any) {
        setError(e?.message || "Kunde inte ladda användardata.");
      } finally {
        setBootLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function resetAllData() {
    setDrivers([]);
    setVehicles([]);
    setTrips([]);
    setAdvances([]);
    setCosts([]);
    setDriverProfiles([]);
    setLocations([]);
    setHaldaRows([]);
    setAllProfiles([]);
    setBookings([]);
  }

  async function init() {
    try {
      setBootLoading(true);
      setError("");
      setSuccess("");

      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      setUser(authUser ?? null);

      if (authUser) {
        await loadAll(authUser);
      }
    } catch (e: any) {
      setError(e?.message || "Kunde inte starta appen.");
    } finally {
      setBootLoading(false);
    }
  }

  async function loadAll(currentUser?: User | null) {
    const activeUser = currentUser || user;
    if (!activeUser) {
      setLoading(false);
      return;
    }

    setError("");
    setLoading(true);

    const profileRes = await supabase
      .from("profiles")
      .select("id, full_name, role, status, created_at, email")
      .eq("id", activeUser.id)
      .maybeSingle();

    if (profileRes.error) {
      setLoading(false);
      throw profileRes.error;
    }

    if (!profileRes.data) {
      setLoading(false);
      throw new Error("Ingen profil hittades för den inloggade användaren i public.profiles.");
    }

    const currentProfile = profileRes.data as ProfileRecord;
    const appRole = mapDbRoleToAppRole(currentProfile.role);

    setProfileRecord(currentProfile);
    setRole(appRole);

    if (appRole === "admin") {
      const [
        driversRes,
        vehiclesRes,
        tripsRes,
        advancesRes,
        costsRes,
        profilesRes,
        locationsRes,
        haldaRes,
        allProfilesRes,
        bookingsRes,
      ] = await Promise.all([
        supabase.from("drivers").select("*").order("full_name", { ascending: true }),
        supabase.from("vehicles").select("*").order("created_at", { ascending: false }),
        supabase.from("trips").select("*").order("trip_date", { ascending: false }),
        supabase.from("advances").select("*").order("advance_date", { ascending: false }),
        supabase.from("costs").select("*").order("cost_date", { ascending: false }),
        supabase.from("driver_profiles").select("*").order("created_at", { ascending: true }),
        supabase.from("vehicle_locations").select("*").order("updated_at", { ascending: false }),
        supabase.from("halda_import_rows").select("*").order("trip_date", { ascending: false }),
        supabase.from("profiles").select("id, full_name, role, status, created_at, email").order("created_at", { ascending: true }),
        supabase.from("bookings").select("*").order("booking_time", { ascending: false }),
      ]);

      const allErrors = [
        driversRes.error,
        vehiclesRes.error,
        tripsRes.error,
        advancesRes.error,
        costsRes.error,
        profilesRes.error,
        locationsRes.error,
        haldaRes.error,
        allProfilesRes.error,
        bookingsRes.error,
      ].filter(Boolean);

      if (allErrors.length) {
        setLoading(false);
        throw new Error(allErrors.map((e: any) => e?.message).join(" | "));
      }

      const d = (driversRes.data || []) as Driver[];
      const v = (vehiclesRes.data || []) as Vehicle[];
      const dp = (profilesRes.data || []) as DriverProfile[];
      const authProfiles = (allProfilesRes.data || []) as ProfileRecord[];

      setCurrentDriver(null);
      setDrivers(d);
      setVehicles(v);
      setTrips((tripsRes.data || []) as Trip[]);
      setAdvances((advancesRes.data || []) as Advance[]);
      setCosts((costsRes.data || []) as Cost[]);
      setDriverProfiles(dp);
      setLocations((locationsRes.data || []) as VehicleLocation[]);
      setHaldaRows((haldaRes.data || []) as HaldaImportRow[]);
      setAllProfiles(authProfiles);
      setBookings((bookingsRes.data || []) as Booking[]);

      if (!advanceDriverId && d[0]?.id) setAdvanceDriverId(d[0].id);
      if (!selectedPayrollDriverId && d[0]?.id) setSelectedPayrollDriverId(d[0].id);
      if (!tripDriverId && d[0]?.id) setTripDriverId(d[0].id);
      if (!vehicleDriverId && d[0]?.id) setVehicleDriverId(d[0].id);
      if (!haldaDriverId && d[0]?.id) setHaldaDriverId(d[0].id);
      if (!profileForm.driver_id && d[0]?.id) setProfileForm((prev) => ({ ...prev, driver_id: d[0].id }));
      if (!selectedLinkDriverId && d[0]?.id) setSelectedLinkDriverId(d[0].id);
      if (!bookingDriverId && d[0]?.id) setBookingDriverId(d[0].id);

      if (!tripVehicleId && v[0]?.id) setTripVehicleId(v[0].id);
      if (!costVehicleId && v[0]?.id) setCostVehicleId(v[0].id);
      if (!selectedTrackerVehicleId && v[0]?.id) setSelectedTrackerVehicleId(v[0].id);
      if (!haldaVehicleId && v[0]?.id) setHaldaVehicleId(v[0].id);
      if (!bookingVehicleId && v[0]?.id) setBookingVehicleId(v[0].id);

      if (!selectedUser && authProfiles[0]?.id) setSelectedUser(authProfiles[0].id);
    } else {
      const driverRes = await supabase
        .from("drivers")
        .select("*")
        .eq("auth_user_id", activeUser.id)
        .maybeSingle();

      if (driverRes.error) {
        setLoading(false);
        throw driverRes.error;
      }

      const resolvedDriver = (driverRes.data || null) as Driver | null;
      setCurrentDriver(resolvedDriver);

      if (!resolvedDriver) {
        resetAllData();
        setLoading(false);
        return;
      }

      const [
        vehiclesRes,
        tripsRes,
        advancesRes,
        driverProfilesRes,
        locationsRes,
        bookingsRes,
      ] = await Promise.all([
        supabase.from("vehicles").select("*").eq("driver_id", resolvedDriver.id).order("created_at", { ascending: false }),
        supabase.from("trips").select("*").eq("driver_id", resolvedDriver.id).order("trip_date", { ascending: false }),
        supabase.from("advances").select("*").eq("driver_id", resolvedDriver.id).order("advance_date", { ascending: false }),
        supabase.from("driver_profiles").select("*").eq("driver_id", resolvedDriver.id).order("created_at", { ascending: true }),
        supabase.from("vehicle_locations").select("*").order("updated_at", { ascending: false }),
        supabase
          .from("bookings")
          .select("*")
          .or(`driver_id.eq.${resolvedDriver.id},vehicle_id.in.(${resolvedDriver.id})`)
          .order("booking_time", { ascending: false }),
      ]);

      const allErrors = [
        vehiclesRes.error,
        tripsRes.error,
        advancesRes.error,
        driverProfilesRes.error,
        locationsRes.error,
        bookingsRes.error,
      ].filter(Boolean);

      if (allErrors.length) {
        setLoading(false);
        throw new Error(allErrors.map((e: any) => e?.message).join(" | "));
      }

      const v = (vehiclesRes.data || []) as Vehicle[];
      const vehicleIds = v.map((x) => x.id);

      const filteredBookings = ((bookingsRes.data || []) as Booking[]).filter(
        (b) => b.driver_id === resolvedDriver.id || (!!b.vehicle_id && vehicleIds.includes(b.vehicle_id))
      );

      setDrivers([resolvedDriver]);
      setVehicles(v);
      setTrips((tripsRes.data || []) as Trip[]);
      setAdvances((advancesRes.data || []) as Advance[]);
      setCosts([]);
      setDriverProfiles((driverProfilesRes.data || []) as DriverProfile[]);
      setLocations((locationsRes.data || []) as VehicleLocation[]);
      setHaldaRows([]);
      setAllProfiles([]);
      setBookings(filteredBookings);

      setAdvanceDriverId(resolvedDriver.id);
      setSelectedPayrollDriverId(resolvedDriver.id);
      setTripDriverId(resolvedDriver.id);
      setVehicleDriverId(resolvedDriver.id);
      setBookingDriverId(resolvedDriver.id);
      setProfileForm((prev) => ({ ...prev, driver_id: resolvedDriver.id }));

      if (v[0]?.id) {
        setTripVehicleId((prev) => prev || v[0].id);
        setSelectedTrackerVehicleId((prev) => prev || v[0].id);
        setBookingVehicleId((prev) => prev || v[0].id);
      }
    }

    setLoading(false);
  }

  const driverMap = useMemo(() => Object.fromEntries(drivers.map((d) => [d.id, d])), [drivers]);
  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);
  const profileMap = useMemo(
    () => Object.fromEntries(driverProfiles.map((p) => [p.driver_id, p])),
    [driverProfiles]
  );

  const locationMap = useMemo(() => {
    const out: Record<string, VehicleLocation> = {};
    for (const loc of locations) {
      if (!out[loc.vehicle_id]) out[loc.vehicle_id] = loc;
    }
    return out;
  }, [locations]);

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

  const periodBookings = useMemo(() => {
    return bookings.filter((b) => {
      const date = String(b.booking_time || "").slice(0, 10);
      return date >= fromDate && date <= toDate;
    });
  }, [bookings, fromDate, toDate]);

  const totalIncome = periodTrips.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalCosts = periodCosts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalAdvances = periodAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);

  const estimatedSalaryBase = Math.round((totalIncome * DEFAULT_SALARY_PERCENT) / 100);
  const estimatedNetAfterAdvances = estimatedSalaryBase - totalAdvances;
  const companyResult = totalIncome - totalCosts - estimatedSalaryBase;

  const activeVehicles = vehicles.filter((v) => v.status === "Aktiv").length;
  const processedHaldaCount = haldaRows.filter((r) => r.processed).length;

  const leaderboard = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const trip of periodTrips) {
      const driverId =
        trip.driver_id ||
        (trip.vehicle_id && vehicleMap[trip.vehicle_id]?.driver_id) ||
        "";
      if (!driverId) continue;
      acc[driverId] = (acc[driverId] || 0) + Number(trip.amount || 0);
    }
    return Object.entries(acc)
      .map(([driverId, amount]) => ({
        driverId,
        amount,
        name: driverMap[driverId]?.full_name || "Okänd förare",
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTrips, vehicleMap, driverMap]);

  const topDriver = leaderboard[0];

  const selectedDriver = drivers.find((d) => d.id === selectedPayrollDriverId) || null;
  const selectedProfile = selectedDriver ? profileMap[selectedDriver.id] : null;

  const selectedDriverVehicleIds = useMemo(() => {
    if (!selectedDriver) return [];
    return vehicles.filter((v) => v.driver_id === selectedDriver.id).map((v) => v.id);
  }, [vehicles, selectedDriver]);

  const payrollTrips = useMemo(() => {
    if (!selectedDriver) return [];
    return trips.filter((t) => {
      if (!inRange(t.trip_date, fromDate, toDate)) return false;
      return t.driver_id === selectedDriver.id || (!!t.vehicle_id && selectedDriverVehicleIds.includes(t.vehicle_id));
    });
  }, [trips, selectedDriver, selectedDriverVehicleIds, fromDate, toDate]);

  const payrollAdvances = useMemo(() => {
    if (!selectedDriver) return [];
    return advances.filter(
      (a) => a.driver_id === selectedDriver.id && inRange(a.advance_date, fromDate, toDate)
    );
  }, [advances, selectedDriver, fromDate, toDate]);

  const payrollCosts = useMemo(() => {
    if (!selectedDriver) return [];
    return costs.filter(
      (c) => !!c.vehicle_id && selectedDriverVehicleIds.includes(c.vehicle_id) && inRange(c.cost_date, fromDate, toDate)
    );
  }, [costs, selectedDriverVehicleIds, selectedDriver, fromDate, toDate]);

  const payrollIncome = payrollTrips.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const payrollAdvanceTotal = payrollAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const payrollCostTotal = payrollCosts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const payrollSalaryPct = Number(selectedDriver?.salary_percent || DEFAULT_SALARY_PERCENT);
  const payrollSalary = Math.round((payrollIncome * payrollSalaryPct) / 100);
  const payrollNet = payrollSalary - payrollAdvanceTotal;

  const selectedTrackerLocation = selectedTrackerVehicleId
    ? locationMap[selectedTrackerVehicleId]
    : null;

  const filteredTrips = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return periodTrips;
    return periodTrips.filter((t) => {
      const driverName = t.driver_id ? driverMap[t.driver_id]?.full_name || "" : "";
      const vehicleName = t.vehicle_id
        ? `${vehicleMap[t.vehicle_id]?.name || ""} ${vehicleMap[t.vehicle_id]?.reg || ""}`
        : "";
      return (
        driverName.toLowerCase().includes(q) ||
        vehicleName.toLowerCase().includes(q) ||
        String(t.source || "").toLowerCase().includes(q) ||
        String(t.note || "").toLowerCase().includes(q)
      );
    });
  }, [periodTrips, searchText, driverMap, vehicleMap]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (error) throw error;

      setLoginPassword("");
      setSuccess("Inloggning lyckades.");
    } catch (e: any) {
      setError(e?.message || "Inloggning misslyckades.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (e: any) {
      setError(e?.message || "Kunde inte logga ut.");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(fn: () => Promise<void>) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await fn();
      await loadAll(user);
    } catch (e: any) {
      setError(e?.message || "Något gick fel.");
    } finally {
      setSaving(false);
    }
  }

  async function addDriver() {
    if (role !== "admin") return;

    if (!driverName.trim()) {
      setError("Fyll i förarens namn.");
      return;
    }

    await runAction(async () => {
      if (editingDriverId) {
        const { error } = await supabase
          .from("drivers")
          .update({
            full_name: driverName.trim(),
            phone: driverPhone.trim() || null,
            salary_percent: normalizeNumber(driverSalaryPercent),
          })
          .eq("id", editingDriverId);
        if (error) throw error;
        setEditingDriverId(null);
        setSuccess("Förare uppdaterad.");
      } else {
        const { data, error } = await supabase
          .from("drivers")
          .insert({
            full_name: driverName.trim(),
            phone: driverPhone.trim() || null,
            salary_percent: normalizeNumber(driverSalaryPercent),
            active: true,
          })
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Kunde inte skapa förare.");

        const { error: profileError } = await supabase.from("driver_profiles").insert({
          driver_id: data.id,
          full_address: "",
          personal_number: "",
          bank_name: "",
          bank_account: "",
          cash_handled: 0,
          cash_note: DEFAULT_CASH_NOTE,
        });

        if (profileError) throw profileError;
        setSuccess("Förare skapad.");
      }

      setDriverName("");
      setDriverPhone("");
      setDriverSalaryPercent(DEFAULT_SALARY_PERCENT);
    });
  }

  async function addVehicle() {
    if (role !== "admin") return;

    if (!vehicleName.trim() || !vehicleReg.trim()) {
      setError("Fyll i bilnamn och registreringsnummer.");
      return;
    }

    await runAction(async () => {
      if (editingVehicleId) {
        const { error } = await supabase
          .from("vehicles")
          .update({
            name: vehicleName.trim(),
            reg: vehicleReg.trim().toUpperCase(),
            status: vehicleStatus,
            driver_id: vehicleDriverId || null,
          })
          .eq("id", editingVehicleId);
        if (error) throw error;
        setEditingVehicleId(null);
        setSuccess("Bil uppdaterad.");
      } else {
        const { error } = await supabase.from("vehicles").insert({
          name: vehicleName.trim(),
          reg: vehicleReg.trim().toUpperCase(),
          status: vehicleStatus,
          driver_id: vehicleDriverId || null,
        });
        if (error) throw error;
        setSuccess("Bil skapad.");
      }

      setVehicleName("");
      setVehicleReg("");
      setVehicleStatus("Aktiv");
    });
  }

  async function addTrip() {
    if (!tripAmount) {
      setError("Fyll i belopp.");
      return;
    }

    await runAction(async () => {
      const resolvedDriverId =
        tripDriverId ||
        (tripVehicleId ? vehicleMap[tripVehicleId]?.driver_id || null : drivers[0]?.id || null);

      const { error } = await supabase.from("trips").insert({
        vehicle_id: tripVehicleId || null,
        driver_id: resolvedDriverId,
        amount: normalizeNumber(tripAmount),
        source: tripSource,
        trip_date: tripDate,
        note: tripNote || null,
      });

      if (error) throw error;

      setTripAmount(0);
      setTripNote("");
      setTripSource("Avenyn Taxi");
      setTripDate(todayString());
      setSuccess("Resa skapad.");
    });
  }

  async function addAdvance() {
    if (role !== "admin") return;

    if (!advanceDriverId || !advanceAmount) {
      setError("Välj förare och fyll i förskottsbelopp.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("advances").insert({
        driver_id: advanceDriverId,
        amount: normalizeNumber(advanceAmount),
        note: advanceNote || null,
        advance_date: advanceDate,
      });
      if (error) throw error;

      setAdvanceAmount(0);
      setAdvanceNote("");
      setAdvanceDate(todayString());
      setSuccess("Förskott registrerat.");
    });
  }

  async function addCost() {
    if (role !== "admin") return;

    if (!costVehicleId || !costAmount) {
      setError("Välj bil och fyll i kostnadsbelopp.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("costs").insert({
        vehicle_id: costVehicleId,
        amount: normalizeNumber(costAmount),
        type: costType,
        note: costNote || null,
        cost_date: costDate,
      });
      if (error) throw error;

      setCostAmount(0);
      setCostType("Service");
      setCostNote("");
      setCostDate(todayString());
      setSuccess("Kostnad registrerad.");
    });
  }

  function loadProfileToForm(driverId: string) {
    const p = profileMap[driverId];
    setProfileForm({
      driver_id: driverId,
      full_address: p?.full_address || "",
      personal_number: p?.personal_number || "",
      bank_name: p?.bank_name || "",
      bank_account: p?.bank_account || "",
      cash_handled: p?.cash_handled || 0,
      cash_note: p?.cash_note || DEFAULT_CASH_NOTE,
      id: p?.id,
    });
  }

  async function saveProfile() {
    if (role !== "admin") return;

    if (!profileForm.driver_id) {
      setError("Välj förare för profil.");
      return;
    }

    await runAction(async () => {
      const existing = profileMap[profileForm.driver_id];

      if (existing?.id) {
        const { error } = await supabase
          .from("driver_profiles")
          .update({
            full_address: profileForm.full_address || null,
            personal_number: profileForm.personal_number || null,
            bank_name: profileForm.bank_name || null,
            bank_account: profileForm.bank_account || null,
            cash_handled: normalizeNumber(profileForm.cash_handled),
            cash_note: profileForm.cash_note || DEFAULT_CASH_NOTE,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("driver_profiles").insert({
          driver_id: profileForm.driver_id,
          full_address: profileForm.full_address || null,
          personal_number: profileForm.personal_number || null,
          bank_name: profileForm.bank_name || null,
          bank_account: profileForm.bank_account || null,
          cash_handled: normalizeNumber(profileForm.cash_handled),
          cash_note: profileForm.cash_note || DEFAULT_CASH_NOTE,
        });

        if (error) throw error;
      }
      setSuccess("Förarprofil sparad.");
    });
  }

  async function safeDelete(table: string, id: string, label: string) {
    if (role !== "admin") return;

    const ok = window.confirm(`Är du säker att du vill ta bort ${label}?`);
    if (!ok) return;

    await runAction(async () => {
      if (table === "drivers") {
        const hasTrips = trips.some((t) => t.driver_id === id);
        const hasAdvances = advances.some((a) => a.driver_id === id);
        const hasVehicles = vehicles.some((v) => v.driver_id === id);
        const hasBookings = bookings.some((b) => b.driver_id === id);

        if (hasTrips || hasAdvances || hasVehicles || hasBookings) {
          throw new Error("Föraren kan inte tas bort eftersom den är kopplad till resor, bokningar, förskott eller bilar.");
        }

        const profile = profileMap[id];
        if (profile?.id) {
          const { error: pErr } = await supabase.from("driver_profiles").delete().eq("id", profile.id);
          if (pErr) throw pErr;
        }
      }

      if (table === "vehicles") {
        const hasTrips = trips.some((t) => t.vehicle_id === id);
        const hasCosts = costs.some((c) => c.vehicle_id === id);
        const hasBookings = bookings.some((b) => b.vehicle_id === id);

        if (hasTrips || hasCosts || hasBookings) {
          throw new Error("Bilen kan inte tas bort eftersom den är kopplad till resor, bokningar eller kostnader.");
        }
      }

      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;

      setSuccess(`${label} borttagen.`);
    });
  }

  function editDriver(d: Driver) {
    setEditingDriverId(d.id);
    setDriverName(d.full_name || "");
    setDriverPhone(d.phone || "");
    setDriverSalaryPercent(Number(d.salary_percent || DEFAULT_SALARY_PERCENT));
  }

  function editVehicle(v: Vehicle) {
    setEditingVehicleId(v.id);
    setVehicleName(v.name || "");
    setVehicleReg(v.reg || "");
    setVehicleStatus(v.status || "Aktiv");
    setVehicleDriverId(v.driver_id || "");
  }

  function loadBookingToForm(b: Booking) {
    setEditingBookingId(b.id);
    setBookingCustomerName(b.customer_name || "");
    setBookingCustomerPhone(b.customer_phone || "");
    setBookingPickupAddress(b.pickup_address || "");
    setBookingDropoffAddress(b.dropoff_address || "");
    setBookingDateTime(
      b.booking_time
        ? new Date(b.booking_time).toISOString().slice(0, 16)
        : nowDateTimeLocalString()
    );
    setBookingStatus(b.status || "Ny");
    setBookingDriverId(b.driver_id || "");
    setBookingVehicleId(b.vehicle_id || "");
    setBookingNote(b.note || "");
    setBookingPrice(Number(b.price || 0));
  }

  function resetBookingForm() {
    setEditingBookingId(null);
    setBookingCustomerName("");
    setBookingCustomerPhone("");
    setBookingPickupAddress("");
    setBookingDropoffAddress("");
    setBookingDateTime(nowDateTimeLocalString());
    setBookingStatus("Ny");
    setBookingDriverId(role === "driver" ? currentDriver?.id || "" : "");
    setBookingVehicleId("");
    setBookingNote("");
    setBookingPrice(0);
  }

  async function saveBooking() {
    if (!bookingCustomerName.trim() || !bookingPickupAddress.trim()) {
      setError("Fyll i kundnamn och hämtningsadress.");
      return;
    }

    await runAction(async () => {
      const payload = {
        customer_name: bookingCustomerName.trim(),
        customer_phone: bookingCustomerPhone.trim() || null,
        pickup_address: bookingPickupAddress.trim(),
        dropoff_address: bookingDropoffAddress.trim() || null,
        booking_time: new Date(bookingDateTime).toISOString(),
        status: bookingStatus,
        driver_id: bookingDriverId || null,
        vehicle_id: bookingVehicleId || null,
        note: bookingNote.trim() || null,
        price: bookingPrice ? normalizeNumber(bookingPrice) : null,
      };

      if (editingBookingId) {
        const { error } = await supabase.from("bookings").update(payload).eq("id", editingBookingId);
        if (error) throw error;
        setSuccess("Bokning uppdaterad.");
      } else {
        const { error } = await supabase.from("bookings").insert(payload);
        if (error) throw error;
        setSuccess("Bokning skapad.");
      }

      resetBookingForm();
    });
  }

  async function changeBookingStatus(id: string, nextStatus: string) {
    await runAction(async () => {
      const { error } = await supabase.from("bookings").update({ status: nextStatus }).eq("id", id);
      if (error) throw error;
      setSuccess(`Bokning uppdaterad till ${nextStatus}.`);
    });
  }

  async function saveCurrentVehicleLocation() {
    if (!selectedTrackerVehicleId) {
      setError("Välj ett fordon för platsuppdatering.");
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation stöds inte i den här webbläsaren.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const payload = {
            vehicle_id: selectedTrackerVehicleId,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
            updated_at: new Date().toISOString(),
          };

          const existing = locationMap[selectedTrackerVehicleId];
          if (existing?.id) {
            const { error } = await supabase
              .from("vehicle_locations")
              .update(payload)
              .eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("vehicle_locations").insert(payload);
            if (error) throw error;
          }

          await loadAll(user);
          setSuccess("Position sparad.");
        } catch (e: any) {
          setError(e?.message || "Kunde inte spara plats.");
        } finally {
          setSaving(false);
        }
      },
      (err) => {
        setError(err.message || "Kunde inte hämta position.");
        setSaving(false);
      },
      { enableHighAccuracy: true }
    );
  }

  function parseHaldaTextRows() {
    const lines = haldaPaste
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed = lines.map((line, idx) => {
      const cols = parseCSVLine(line);
      const date = cols[0] || todayString();
      const amount = normalizeNumber(cols[1] || 0);
      const meterTotal = normalizeNumber(cols[2] || 0);
      const cashAmount = normalizeNumber(cols[3] || 0);
      const cardAmount = normalizeNumber(cols[4] || 0);
      const shiftCode = cols[5] || null;
      const externalRef = cols[6] || `HALDA-${Date.now()}-${idx}`;
      const note = cols[7] || "Importerad från Halda";

      return {
        trip_date: date,
        driver_id: haldaDriverId || null,
        vehicle_id: haldaVehicleId || null,
        amount,
        meter_total: meterTotal,
        cash_amount: cashAmount,
        card_amount: cardAmount,
        source: haldaDefaultSource,
        shift_code: shiftCode,
        external_ref: externalRef,
        note,
        processed: false,
      };
    });

    return parsed.filter((r) => r.amount > 0);
  }

  async function importHaldaRows() {
    if (role !== "admin") return;

    const rows = parseHaldaTextRows();
    if (!rows.length) {
      setError("Ingen giltig Halda-data hittades. Format: datum;belopp;meter;kontant;kort;shift;ref;notering");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("halda_import_rows").insert(rows);
      if (error) throw error;
      setHaldaPaste("");
      setSuccess("Halda-rader importerade.");
    });
  }

  async function processUnprocessedHalda() {
    if (role !== "admin") return;

    const unprocessed = haldaRows.filter((r) => !r.processed);
    if (!unprocessed.length) {
      setError("Det finns inga obearbetade Halda-rader.");
      return;
    }

    await runAction(async () => {
      for (const row of unprocessed) {
        const matchedTrip = trips.find(
          (t) =>
            !t.halda_row_id &&
            t.trip_date === row.trip_date &&
            Number(t.amount) === Number(row.amount) &&
            (t.driver_id === row.driver_id || t.vehicle_id === row.vehicle_id)
        );

        if (matchedTrip) {
          const { error: updateTripErr } = await supabase
            .from("trips")
            .update({ halda_row_id: row.id })
            .eq("id", matchedTrip.id);
          if (updateTripErr) throw updateTripErr;

          const { error: updateRowErr } = await supabase
            .from("halda_import_rows")
            .update({ processed: true, processed_trip_id: matchedTrip.id })
            .eq("id", row.id);
          if (updateRowErr) throw updateRowErr;
        } else {
          const { data: newTrip, error: insertTripErr } = await supabase
            .from("trips")
            .insert({
              vehicle_id: row.vehicle_id,
              driver_id: row.driver_id || (row.vehicle_id ? vehicleMap[row.vehicle_id]?.driver_id || null : null),
              amount: row.amount,
              source: row.source || "Halda M2",
              trip_date: row.trip_date,
              note: row.note || `Halda ref: ${row.external_ref || "-"}`,
              halda_row_id: row.id,
            })
            .select()
            .maybeSingle();

          if (insertTripErr) throw insertTripErr;
          if (!newTrip) throw new Error("Kunde inte skapa resa från Halda.");

          const { error: updateRowErr } = await supabase
            .from("halda_import_rows")
            .update({ processed: true, processed_trip_id: newTrip.id })
            .eq("id", row.id);
          if (updateRowErr) throw updateRowErr;
        }
      }

      setSuccess("Halda-rader processade.");
    });
  }

  async function linkDriverToUser() {
    if (role !== "admin") return;

    if (!selectedLinkDriverId || !selectedUser) {
      setError("Välj både förare och användare.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase
        .from("drivers")
        .update({ auth_user_id: selectedUser })
        .eq("id", selectedLinkDriverId);

      if (error) throw error;
      setSuccess("Förare kopplad till användare.");
    });
  }

  async function changeRole(userId: string, nextRole: AppRole) {
    if (role !== "admin") return;

    await runAction(async () => {
      const dbRole = mapAppRoleToDbRole(nextRole);
      const { error } = await supabase
        .from("profiles")
        .update({ role: dbRole, status: "Aktiv" })
        .eq("id", userId);

      if (error) throw error;
      setSuccess(`Roll ändrad till ${dbRole}.`);
    });
  }

  function exportPayrollExcel() {
    if (!selectedDriver) return;

    const wb = XLSX.utils.book_new();

    const summary = [
      ["Bolag", COMPANY.legalName],
      ["Varumärke", COMPANY.name],
      ["Förare", selectedDriver.full_name],
      ["Period", `${fromDate} - ${toDate}`],
      ["Löneprocent", `${payrollSalaryPct}%`],
      ["Omsättning", payrollIncome],
      ["Lön", payrollSalary],
      ["Förskott", payrollAdvanceTotal],
      ["Kostnader kopplade bil", payrollCostTotal],
      ["Netto", payrollNet],
      ["Kontanthantering", normalizeNumber(selectedProfile?.cash_handled || 0)],
    ];

    const tripsSheet = payrollTrips.map((t) => ({
      Datum: t.trip_date,
      Källa: t.source,
      Belopp: Number(t.amount),
      Bil: t.vehicle_id ? `${vehicleMap[t.vehicle_id]?.name || ""} ${vehicleMap[t.vehicle_id]?.reg || ""}` : "",
      Notering: t.note || "",
    }));

    const advancesSheet = payrollAdvances.map((a) => ({
      Datum: a.advance_date,
      Belopp: Number(a.amount),
      Notering: a.note || "",
    }));

    const costsSheet = payrollCosts.map((c) => ({
      Datum: c.cost_date,
      Typ: c.type,
      Belopp: Number(c.amount),
      Bil: c.vehicle_id ? `${vehicleMap[c.vehicle_id]?.name || ""} ${vehicleMap[c.vehicle_id]?.reg || ""}` : "",
      Notering: c.note || "",
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Sammanfattning");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tripsSheet), "Resor");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(advancesSheet), "Förskott");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costsSheet), "Kostnader");

    XLSX.writeFile(wb, `lonespec-${selectedDriver.full_name}-${fromDate}-${toDate}.xlsx`);
  }

  function exportPayrollPDF() {
    if (!selectedDriver) return;

    const doc = new jsPDF();
    const cashHandled = normalizeNumber(selectedProfile?.cash_handled || 0);

    doc.setFontSize(18);
    doc.text(COMPANY.name, 14, 16);

    doc.setFontSize(10);
    doc.text(COMPANY.legalName, 14, 23);
    doc.text(`Ort: ${COMPANY.city}`, 14, 28);
    doc.text(`Webb: ${COMPANY.website}`, 14, 33);
    doc.text(`Org.nr: ${COMPANY.orgNumber}`, 14, 38);

    doc.setFontSize(15);
    doc.text("Lönespecifikation", 145, 16);

    doc.setFontSize(10);
    doc.text(`Period: ${fromDate} - ${toDate}`, 145, 23);
    doc.text(`Månad: ${monthNameSv(toDate)}`, 145, 28);

    autoTable(doc, {
      startY: 46,
      theme: "grid",
      head: [["Fält", "Värde"]],
      body: [
        ["Förare", selectedDriver.full_name],
        ["Telefon", selectedDriver.phone || "-"],
        ["Adress", selectedProfile?.full_address || "-"],
        ["Personnummer", selectedProfile?.personal_number || "-"],
        ["Bank", selectedProfile?.bank_name || "-"],
        ["Kontonummer", selectedProfile?.bank_account || "-"],
        ["Löneprocent", `${payrollSalaryPct}%`],
      ],
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Beskrivning", "Belopp"]],
      body: [
        ["Omsättning", money(payrollIncome)],
        [`Lön (${payrollSalaryPct}%)`, money(payrollSalary)],
        ["Förskott", money(payrollAdvanceTotal)],
        ["Kostnader kopplade bil", money(payrollCostTotal)],
        ["Netto att utbetala", money(payrollNet)],
        ["Kontanthantering (info)", money(cashHandled)],
      ],
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      theme: "striped",
      head: [["Datum", "Källa", "Bil", "Belopp", "Notering"]],
      body: payrollTrips.map((t) => [
        t.trip_date,
        t.source,
        t.vehicle_id ? `${vehicleMap[t.vehicle_id]?.name || ""} ${vehicleMap[t.vehicle_id]?.reg || ""}` : "-",
        money(t.amount),
        t.note || "",
      ]),
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      theme: "striped",
      head: [["Förskott datum", "Belopp", "Notering"]],
      body: payrollAdvances.length
        ? payrollAdvances.map((a) => [a.advance_date, money(a.amount), a.note || ""])
        : [["-", money(0), "-"]],
    });

    doc.setFontSize(9);
    doc.text(
      selectedProfile?.cash_note || DEFAULT_CASH_NOTE,
      14,
      Math.min((doc as any).lastAutoTable.finalY + 12, 285)
    );

    doc.save(`lonespec-${selectedDriver.full_name}-${fromDate}-${toDate}.pdf`);
  }

  function printPayroll() {
    window.print();
  }

  if (bootLoading) {
    return <div className="min-h-screen bg-slate-50 p-8 text-slate-700">Startar Avenyn Taxi...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 md:px-6">
          <div className="grid w-full gap-10 lg:grid-cols-2">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit items-center rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700">
                Avenyn Taxi • Version 5
              </div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900">
                Komplett taxi-system med booking, lön och roller
              </h1>
              <p className="mt-4 max-w-xl text-lg text-slate-600">
                En komplett ljus dashboard för admin och förare med bookings, resor, kostnader, Halda-import, lönespecifikation, PDF, Excel och spårning.
              </p>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Logga in</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Admin ser allt. Förare ser endast sitt.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">E-post</label>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className={inputClass}
                      placeholder="admin@avenyntaxi.se"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Lösenord</label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className={inputClass}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <button type="submit" disabled={saving} className={primaryButtonClass + " w-full"}>
                    {saving ? "Loggar in..." : "Logga in"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-8 text-slate-700">Laddar dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-6 rounded-3xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Avenyn Taxi – Version 5</h1>
              <p className="mt-2 text-sm text-blue-50">
                Inloggad som {user.email} • Roll: {role} • Profilroll: {profileRecord?.role || "-"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => loadAll(user)} className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25">
                <RefreshCcw size={16} />
                Uppdatera
              </button>
              {role === "admin" && (
                <button
                  onClick={processUnprocessedHalda}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <Upload size={16} />
                  Auto-processa Halda
                </button>
              )}
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/30 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900/40"
              >
                <LogOut size={16} />
                Logga ut
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard icon={<BadgeDollarSign size={18} />} title="Omsättning" value={money(totalIncome)} />
          <StatCard icon={<Wrench size={18} />} title="Kostnader" value={money(totalCosts)} />
          <StatCard icon={<Wallet size={18} />} title="Förskott" value={money(totalAdvances)} />
          <StatCard icon={<TrendingUp size={18} />} title="Estimerad lön" value={money(estimatedSalaryBase)} />
          <StatCard icon={<Receipt size={18} />} title="Netto efter förskott" value={money(estimatedNetAfterAdvances)} />
          <StatCard icon={<CarFront size={18} />} title="Aktiva bilar" value={String(activeVehicles)} />
          <StatCard icon={<CalendarDays size={18} />} title="Bokningar" value={String(periodBookings.length)} />
        </div>

        <div className="mb-6 grid gap-6 xl:grid-cols-3">
          <Panel title="Period" icon={<Search size={18} />}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Från">
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Till">
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm">
              <div>Bolagsresultat: <strong>{money(companyResult)}</strong></div>
              <div>Bearbetade Halda-rader: <strong>{processedHaldaCount}</strong></div>
              <div>Toppförare: <strong>{topDriver ? `${topDriver.name} (${money(topDriver.amount)})` : "-"}</strong></div>
            </div>
          </Panel>

          {role === "admin" ? (
            <>
              <Panel title="Lägg till / redigera förare" icon={<UserRound size={18} />}>
                <div className="grid gap-3">
                  <Field label="Fullständigt namn">
                    <input value={driverName} onChange={(e) => setDriverName(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Telefon">
                    <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Löneprocent">
                    <input
                      type="number"
                      value={driverSalaryPercent}
                      onChange={(e) => setDriverSalaryPercent(Number(e.target.value))}
                      className={inputClass}
                    />
                  </Field>
                  <button onClick={addDriver} disabled={saving} className={primaryButtonClass}>
                    <Plus size={16} />
                    {editingDriverId ? "Spara förare" : "Lägg till förare"}
                  </button>
                </div>
              </Panel>

              <Panel title="Lägg till / redigera bil" icon={<CarFront size={18} />}>
                <div className="grid gap-3">
                  <Field label="Bilnamn">
                    <input value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Registreringsnummer">
                    <input value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Status">
                    <select value={vehicleStatus} onChange={(e) => setVehicleStatus(e.target.value)} className={inputClass}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ansvarig förare">
                    <select value={vehicleDriverId} onChange={(e) => setVehicleDriverId(e.target.value)} className={inputClass}>
                      <option value="">Ingen</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button onClick={addVehicle} disabled={saving} className={primaryButtonClass}>
                    <Plus size={16} />
                    {editingVehicleId ? "Spara bil" : "Lägg till bil"}
                  </button>
                </div>
              </Panel>
            </>
          ) : (
            <Panel title="Min profil" icon={<ShieldCheck size={18} />}>
              <div className="grid gap-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Namn</div>
                  <div className="mt-1 font-semibold">{currentDriver?.full_name || "-"}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Telefon</div>
                  <div className="mt-1 font-semibold">{currentDriver?.phone || "-"}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Löneprocent</div>
                  <div className="mt-1 font-semibold">{currentDriver?.salary_percent ?? DEFAULT_SALARY_PERCENT}%</div>
                </div>
              </div>
            </Panel>
          )}
        </div>

        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Panel title={editingBookingId ? "Redigera bokning" : "Ny bokning"} icon={<CalendarDays size={18} />}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Kundnamn">
                <input value={bookingCustomerName} onChange={(e) => setBookingCustomerName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Telefon">
                <input value={bookingCustomerPhone} onChange={(e) => setBookingCustomerPhone(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Hämta adress">
                <input value={bookingPickupAddress} onChange={(e) => setBookingPickupAddress(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Lämna adress">
                <input value={bookingDropoffAddress} onChange={(e) => setBookingDropoffAddress(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Tid">
                <input type="datetime-local" value={bookingDateTime} onChange={(e) => setBookingDateTime(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Status">
                <select value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)} className={inputClass}>
                  {BOOKING_STATUS_OPTIONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Förare">
                <select
                  value={bookingDriverId}
                  onChange={(e) => setBookingDriverId(e.target.value)}
                  className={inputClass}
                  disabled={role === "driver"}
                >
                  <option value="">Ingen</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bil">
                <select
                  value={bookingVehicleId}
                  onChange={(e) => setBookingVehicleId(e.target.value)}
                  className={inputClass}
                  disabled={role === "driver"}
                >
                  <option value="">Ingen</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} – {v.reg}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pris">
                <input type="number" value={bookingPrice} onChange={(e) => setBookingPrice(Number(e.target.value))} className={inputClass} />
              </Field>
              <Field label="Notering">
                <input value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} className={inputClass} />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={saveBooking} disabled={saving} className={primaryButtonClass}>
                <Plus size={16} />
                {editingBookingId ? "Spara bokning" : "Skapa bokning"}
              </button>
              <button onClick={resetBookingForm} disabled={saving} className={secondaryButtonClass}>
                Återställ
              </button>
            </div>
          </Panel>

          <Panel title="Bokningar i vald period" icon={<Route size={18} />}>
            <div className="space-y-3 max-h-[520px] overflow-auto">
              {periodBookings.length ? (
                periodBookings.map((b) => (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold">{b.customer_name}</div>
                        <div className="text-sm text-slate-500">{b.customer_phone || "-"}</div>
                        <div className="mt-1 text-sm">{b.pickup_address}</div>
                        <div className="text-sm text-slate-500">→ {b.dropoff_address || "-"}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          {prettyDateTime(b.booking_time)} • {b.driver_id ? driverMap[b.driver_id]?.full_name || "-" : "Ingen förare"} • {b.vehicle_id ? `${vehicleMap[b.vehicle_id]?.name || ""} ${vehicleMap[b.vehicle_id]?.reg || ""}` : "Ingen bil"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Pris: {money(b.price || 0)} • Notering: {b.note || "-"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span
                          className={classNames(
                            "rounded-full px-3 py-1 text-xs font-semibold text-center",
                            b.status === "Klar" && "bg-emerald-100 text-emerald-700",
                            b.status === "På väg" && "bg-blue-100 text-blue-700",
                            b.status === "Hämtad" && "bg-cyan-100 text-cyan-700",
                            b.status === "Tilldelad" && "bg-violet-100 text-violet-700",
                            b.status === "Avbokad" && "bg-red-100 text-red-700",
                            b.status === "Ny" && "bg-amber-100 text-amber-700"
                          )}
                        >
                          {b.status}
                        </span>

                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => loadBookingToForm(b)} className={iconBtnClass}>
                            <Pencil size={15} />
                          </button>
                          {role === "admin" && (
                            <button onClick={() => safeDelete("bookings", b.id, `bokning "${b.customer_name}"`)} className={dangerIconBtnClass}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {BOOKING_STATUS_OPTIONS.map((status) => (
                            <button
                              key={status}
                              onClick={() => changeBookingStatus(b.id, status)}
                              className={classNames(
                                "rounded-xl border px-2 py-1 text-xs font-medium",
                                b.status === status
                                  ? "border-blue-500 bg-blue-50 text-blue-700"
                                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  Inga bokningar i vald period.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="mb-6 grid gap-6 xl:grid-cols-3">
          <Panel title="Ny resa" icon={<BadgeDollarSign size={18} />}>
            <div className="grid gap-3">
              <Field label="Bil">
                <select value={tripVehicleId} onChange={(e) => setTripVehicleId(e.target.value)} className={inputClass}>
                  <option value="">Välj bil</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} – {v.reg}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Förare">
                <select value={tripDriverId} onChange={(e) => setTripDriverId(e.target.value)} className={inputClass}>
                  <option value="">Auto via bil</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Belopp">
                <input type="number" value={tripAmount} onChange={(e) => setTripAmount(Number(e.target.value))} className={inputClass} />
              </Field>
              <Field label="Källa">
                <select value={tripSource} onChange={(e) => setTripSource(e.target.value)} className={inputClass}>
                  {SOURCE_OPTIONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Datum">
                <input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Notering">
                <input value={tripNote} onChange={(e) => setTripNote(e.target.value)} className={inputClass} />
              </Field>
              <button onClick={addTrip} disabled={saving} className={primaryButtonClass}>
                <Plus size={16} />
                Lägg till resa
              </button>
            </div>
          </Panel>

          {role === "admin" ? (
            <>
              <Panel title="Förskott" icon={<Wallet size={18} />}>
                <div className="grid gap-3">
                  <Field label="Förare">
                    <select value={advanceDriverId} onChange={(e) => setAdvanceDriverId(e.target.value)} className={inputClass}>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Belopp">
                    <input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(Number(e.target.value))} className={inputClass} />
                  </Field>
                  <Field label="Datum">
                    <input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Notering">
                    <input value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)} className={inputClass} />
                  </Field>
                  <button onClick={addAdvance} disabled={saving} className={primaryButtonClass}>
                    <Plus size={16} />
                    Lägg till förskott
                  </button>
                </div>
              </Panel>

              <Panel title="Kostnad" icon={<Wrench size={18} />}>
                <div className="grid gap-3">
                  <Field label="Bil">
                    <select value={costVehicleId} onChange={(e) => setCostVehicleId(e.target.value)} className={inputClass}>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} – {v.reg}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Belopp">
                    <input type="number" value={costAmount} onChange={(e) => setCostAmount(Number(e.target.value))} className={inputClass} />
                  </Field>
                  <Field label="Typ">
                    <select value={costType} onChange={(e) => setCostType(e.target.value)} className={inputClass}>
                      {COST_TYPE_OPTIONS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Datum">
                    <input type="date" value={costDate} onChange={(e) => setCostDate(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Notering">
                    <input value={costNote} onChange={(e) => setCostNote(e.target.value)} className={inputClass} />
                  </Field>
                  <button onClick={addCost} disabled={saving} className={primaryButtonClass}>
                    <Plus size={16} />
                    Lägg till kostnad
                  </button>
                </div>
              </Panel>
            </>
          ) : (
            <Panel title="Mina förskott" icon={<Wallet size={18} />}>
              <div className="space-y-3">
                {periodAdvances.length ? (
                  periodAdvances.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="font-semibold">{money(a.amount)}</div>
                      <div className="text-sm text-slate-500">{a.advance_date}</div>
                      <div className="text-sm text-slate-500">{a.note || "-"}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    Inga förskott i vald period.
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        {role === "admin" && (
          <>
            <div className="mb-6 grid gap-6 xl:grid-cols-2">
              <Panel title="Förarprofil / lönedata" icon={<Receipt size={18} />}>
                <div className="grid gap-3">
                  <Field label="Förare">
                    <select value={profileForm.driver_id} onChange={(e) => loadProfileToForm(e.target.value)} className={inputClass}>
                      <option value="">Välj förare</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Full adress">
                      <input value={profileForm.full_address || ""} onChange={(e) => setProfileForm((p) => ({ ...p, full_address: e.target.value }))} className={inputClass} />
                    </Field>
                    <Field label="Personnummer">
                      <input value={profileForm.personal_number || ""} onChange={(e) => setProfileForm((p) => ({ ...p, personal_number: e.target.value }))} className={inputClass} />
                    </Field>
                    <Field label="Banknamn">
                      <input value={profileForm.bank_name || ""} onChange={(e) => setProfileForm((p) => ({ ...p, bank_name: e.target.value }))} className={inputClass} />
                    </Field>
                    <Field label="Kontonummer">
                      <input value={profileForm.bank_account || ""} onChange={(e) => setProfileForm((p) => ({ ...p, bank_account: e.target.value }))} className={inputClass} />
                    </Field>
                    <Field label="Kontanthantering">
                      <input type="number" value={Number(profileForm.cash_handled || 0)} onChange={(e) => setProfileForm((p) => ({ ...p, cash_handled: Number(e.target.value) }))} className={inputClass} />
                    </Field>
                    <Field label="Notering kontanthantering">
                      <input value={profileForm.cash_note || ""} onChange={(e) => setProfileForm((p) => ({ ...p, cash_note: e.target.value }))} className={inputClass} />
                    </Field>
                  </div>

                  <button onClick={saveProfile} disabled={saving} className={primaryButtonClass}>
                    <Plus size={16} />
                    Spara profil
                  </button>
                </div>
              </Panel>

              <Panel title="Halda import ULTRA" icon={<Upload size={18} />}>
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Förare">
                      <select value={haldaDriverId} onChange={(e) => setHaldaDriverId(e.target.value)} className={inputClass}>
                        <option value="">Ingen</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Bil">
                      <select value={haldaVehicleId} onChange={(e) => setHaldaVehicleId(e.target.value)} className={inputClass}>
                        <option value="">Ingen</option>
                        {vehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} – {v.reg}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Default källa">
                      <select value={haldaDefaultSource} onChange={(e) => setHaldaDefaultSource(e.target.value)} className={inputClass}>
                        {SOURCE_OPTIONS.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Klistra in Halda-data (datum;belopp;meter;kontant;kort;shift;ref;notering)">
                    <textarea value={haldaPaste} onChange={(e) => setHaldaPaste(e.target.value)} rows={7} className={inputClass} />
                  </Field>

                  <div className="flex flex-wrap gap-3">
                    <button onClick={importHaldaRows} disabled={saving} className={primaryButtonClass}>
                      <Upload size={16} />
                      Importera rader
                    </button>
                    <button onClick={processUnprocessedHalda} disabled={saving} className={secondaryButtonClass}>
                      <RefreshCcw size={16} />
                      Auto-match / skapa resor
                    </button>
                  </div>
                </div>
              </Panel>
            </div>

            <div className="mb-6 grid gap-6 xl:grid-cols-3">
              <Panel title="Koppla förare till användare" icon={<ShieldCheck size={18} />}>
                <div className="grid gap-3">
                  <Field label="Förare">
                    <select value={selectedLinkDriverId} onChange={(e) => setSelectedLinkDriverId(e.target.value)} className={inputClass}>
                      <option value="">Välj förare</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Användare">
                    <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className={inputClass}>
                      <option value="">Välj användare</option>
                      {allProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.email || p.full_name || p.id}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <button onClick={linkDriverToUser} disabled={saving} className={primaryButtonClass}>
                    <ShieldCheck size={16} />
                    Koppla
                  </button>
                </div>
              </Panel>

              <Panel title="Användarroller" icon={<UserRound size={18} />}>
                <div className="space-y-3">
                  {allProfiles.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="font-semibold">{p.email || p.full_name || p.id}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        Roll: {p.role} • Status: {p.status || "-"}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => changeRole(p.id, "admin")} className={primaryButtonClass}>
                          Admin
                        </button>
                        <button onClick={() => changeRole(p.id, "driver")} className={secondaryButtonClass}>
                          Driver
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Fordonsposition" icon={<MapPinned size={18} />}>
                <div className="grid gap-3">
                  <Field label="Välj fordon">
                    <select value={selectedTrackerVehicleId} onChange={(e) => setSelectedTrackerVehicleId(e.target.value)} className={inputClass}>
                      <option value="">Välj bil</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} – {v.reg}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <button onClick={saveCurrentVehicleLocation} className={secondaryButtonClass}>
                    <MapPinned size={16} />
                    Spara nuvarande position
                  </button>

                  <div className="rounded-2xl bg-slate-50 p-3 text-sm">
                    <div>Senast uppdaterad: <strong>{prettyDateTime(selectedTrackerLocation?.updated_at)}</strong></div>
                    <div>Lat/Lng: <strong>{selectedTrackerLocation ? `${selectedTrackerLocation.lat}, ${selectedTrackerLocation.lng}` : "-"}</strong></div>
                    <div>Adress: <strong>{selectedTrackerLocation?.address || "-"}</strong></div>
                  </div>

                  {selectedTrackerLocation && (
                    <iframe
                      title="vehicle-map"
                      src={mapUrl(selectedTrackerLocation.lat, selectedTrackerLocation.lng)}
                      className="h-72 w-full rounded-2xl border border-slate-200"
                    />
                  )}
                </div>
              </Panel>
            </div>
          </>
        )}

        <div className="mb-6 grid gap-6 xl:grid-cols-2">
          <Panel title="Resor i vald period" icon={<BadgeDollarSign size={18} />}>
            <div className="mb-3">
              <input
                placeholder="Sök förare, bil, källa eller notering..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="max-h-[450px] overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-700">
                  <tr>
                    <Th>Datum</Th>
                    <Th>Förare</Th>
                    <Th>Bil</Th>
                    <Th>Källa</Th>
                    <Th>Belopp</Th>
                    <Th>Notering</Th>
                    {role === "admin" && <Th>Ta bort</Th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100 bg-white">
                      <Td>{t.trip_date}</Td>
                      <Td>{t.driver_id ? driverMap[t.driver_id]?.full_name || "-" : "-"}</Td>
                      <Td>{t.vehicle_id ? `${vehicleMap[t.vehicle_id]?.name || ""} ${vehicleMap[t.vehicle_id]?.reg || ""}` : "-"}</Td>
                      <Td>{t.source}</Td>
                      <Td>{money(t.amount)}</Td>
                      <Td>{t.note || "-"}</Td>
                      {role === "admin" && (
                        <Td>
                          <button onClick={() => safeDelete("trips", t.id, "resan")} className={dangerIconBtnClass}>
                            <Trash2 size={15} />
                          </button>
                        </Td>
                      )}
                    </tr>
                  ))}
                  {!filteredTrips.length && (
                    <tr>
                      <Td colSpan={role === "admin" ? 7 : 6}>Inga resor för vald period.</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          {role === "admin" ? (
            <Panel title="Halda-rader" icon={<Upload size={18} />}>
              <div className="max-h-[450px] overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700">
                    <tr>
                      <Th>Datum</Th>
                      <Th>Förare</Th>
                      <Th>Bil</Th>
                      <Th>Belopp</Th>
                      <Th>Kontant</Th>
                      <Th>Kort</Th>
                      <Th>Status</Th>
                      <Th>Ref</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {haldaRows.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 bg-white">
                        <Td>{r.trip_date}</Td>
                        <Td>{r.driver_id ? driverMap[r.driver_id]?.full_name || "-" : "-"}</Td>
                        <Td>{r.vehicle_id ? `${vehicleMap[r.vehicle_id]?.name || ""} ${vehicleMap[r.vehicle_id]?.reg || ""}` : "-"}</Td>
                        <Td>{money(r.amount)}</Td>
                        <Td>{money(r.cash_amount)}</Td>
                        <Td>{money(r.card_amount)}</Td>
                        <Td>
                          <span className={classNames(
                            "rounded-full px-2 py-1 text-xs font-medium",
                            r.processed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {r.processed ? "Processad" : "Obearbetad"}
                          </span>
                        </Td>
                        <Td>{r.external_ref || "-"}</Td>
                      </tr>
                    ))}
                    {!haldaRows.length && (
                      <tr>
                        <Td colSpan={8}>Inga Halda-rader ännu.</Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : (
            <Panel title="Mina fordon" icon={<CarFront size={18} />}>
              <div className="space-y-3">
                {vehicles.length ? (
                  vehicles.map((v) => (
                    <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="font-semibold">{v.name}</div>
                      <div className="text-sm text-slate-500">{v.reg}</div>
                      <div className="mt-1 text-xs text-slate-500">{v.status}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    Inga fordon kopplade.
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>

        {role === "admin" && (
          <div className="mb-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Förare" icon={<UserRound size={18} />}>
              <div className="space-y-3">
                {drivers.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{d.full_name}</div>
                        <div className="text-sm text-slate-500">{d.phone || "-"}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Lön: {Number(d.salary_percent || DEFAULT_SALARY_PERCENT)}%
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          User: {d.auth_user_id || "Inte kopplad"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editDriver(d)} className={iconBtnClass}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => safeDelete("drivers", d.id, `föraren "${d.full_name}"`)} className={dangerIconBtnClass}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Bilar" icon={<CarFront size={18} />}>
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{v.name}</div>
                        <div className="text-sm text-slate-500">{v.reg}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {v.status} • {v.driver_id ? driverMap[v.driver_id]?.full_name || "-" : "Ingen förare"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editVehicle(v)} className={iconBtnClass}>
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => safeDelete("vehicles", v.id, `bilen "${v.name}"`)} className={dangerIconBtnClass}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        <Panel title="Lönespecifikation ULTRA" icon={<FileText size={18} />}>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <Field label="Välj förare">
              <select value={selectedPayrollDriverId} onChange={(e) => setSelectedPayrollDriverId(e.target.value)} className={inputClass}>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-3 flex flex-wrap items-end gap-3">
              <button onClick={exportPayrollPDF} className={primaryButtonClass}>
                <FileText size={16} />
                Exportera PDF
              </button>
              <button onClick={exportPayrollExcel} className={secondaryButtonClass}>
                <FileSpreadsheet size={16} />
                Exportera Excel
              </button>
              <button onClick={printPayroll} className={secondaryButtonClass}>
                <Printer size={16} />
                Skriv ut
              </button>
            </div>
          </div>

          <div id="print-area" ref={printRef} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">{COMPANY.name}</h2>
                <div className="mt-2 text-sm text-slate-600">{COMPANY.legalName}</div>
                <div className="text-sm text-slate-600">{COMPANY.city}</div>
                <div className="text-sm text-slate-600">{COMPANY.website}</div>
              </div>
              <div className="text-left md:text-right">
                <h3 className="text-xl font-bold">Lönespecifikation</h3>
                <div className="mt-2 text-sm text-slate-600">Period: {fromDate} – {toDate}</div>
                <div className="text-sm text-slate-600">Månad: {monthNameSv(toDate)}</div>
              </div>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 text-sm font-semibold text-slate-700">Förare</div>
                <div className="text-sm">Namn: {selectedDriver?.full_name || "-"}</div>
                <div className="text-sm">Telefon: {selectedDriver?.phone || "-"}</div>
                <div className="text-sm">Adress: {selectedProfile?.full_address || "-"}</div>
                <div className="text-sm">Personnummer: {selectedProfile?.personal_number || "-"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 text-sm font-semibold text-slate-700">Bankuppgifter</div>
                <div className="text-sm">Bank: {selectedProfile?.bank_name || "-"}</div>
                <div className="text-sm">Kontonummer: {selectedProfile?.bank_account || "-"}</div>
                <div className="text-sm">Löneprocent: {payrollSalaryPct}%</div>
              </div>
            </div>

            <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <Th>Beskrivning</Th>
                    <Th>Belopp</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <Td>Omsättning</Td>
                    <Td>{money(payrollIncome)}</Td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <Td>Lön ({payrollSalaryPct}%)</Td>
                    <Td>{money(payrollSalary)}</Td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <Td>Förskott</Td>
                    <Td>{money(payrollAdvanceTotal)}</Td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <Td>Kostnader kopplade bil</Td>
                    <Td>{money(payrollCostTotal)}</Td>
                  </tr>
                  <tr className="border-t border-slate-100 bg-blue-50 font-semibold">
                    <Td>Netto att utbetala</Td>
                    <Td>{money(payrollNet)}</Td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <Td>Kontanthantering (info)</Td>
                    <Td>{money(selectedProfile?.cash_handled || 0)}</Td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mb-6">
              <div className="mb-2 text-sm font-semibold text-slate-700">Resor i perioden</div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <Th>Datum</Th>
                      <Th>Källa</Th>
                      <Th>Bil</Th>
                      <Th>Belopp</Th>
                      <Th>Notering</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollTrips.map((t) => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <Td>{t.trip_date}</Td>
                        <Td>{t.source}</Td>
                        <Td>{t.vehicle_id ? `${vehicleMap[t.vehicle_id]?.name || ""} ${vehicleMap[t.vehicle_id]?.reg || ""}` : "-"}</Td>
                        <Td>{money(t.amount)}</Td>
                        <Td>{t.note || "-"}</Td>
                      </tr>
                    ))}
                    {!payrollTrips.length && (
                      <tr className="border-t border-slate-100">
                        <Td colSpan={5}>Inga resor i vald period.</Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-2 text-sm font-semibold text-slate-700">Förskott</div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <Th>Datum</Th>
                      <Th>Belopp</Th>
                      <Th>Notering</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollAdvances.map((a) => (
                      <tr key={a.id} className="border-t border-slate-100">
                        <Td>{a.advance_date}</Td>
                        <Td>{money(a.amount)}</Td>
                        <Td>{a.note || "-"}</Td>
                      </tr>
                    ))}
                    {!payrollAdvances.length && (
                      <tr className="border-t border-slate-100">
                        <Td colSpan={3}>Inga förskott i vald period.</Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              {selectedProfile?.cash_note || DEFAULT_CASH_NOTE}
            </div>
          </div>
        </Panel>

        {saving && (
          <div className="fixed bottom-4 right-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
            Sparar...
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-xl bg-blue-100 p-2 text-blue-700">{icon}</div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
      {children}
    </label>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-blue-700">
        <div className="rounded-xl bg-blue-100 p-2">{icon}</div>
        <div className="text-sm font-medium text-slate-600">{title}</div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold">{children}</th>;
}

function Td({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className="px-3 py-2 align-top">
      {children}
    </td>
  );
}

const inputClass =
  "w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

const iconBtnClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

const dangerIconBtnClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100";