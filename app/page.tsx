"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, Session, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

const COMPANY = {
  name: "Avenyn Taxi",
  legalName: "Citra Trans och Bilservice AB",
  city: "Göteborg",
  website: "avenyntaxi.se",
};

const BOOKING_STATUS_OPTIONS = ["Ny", "Tilldelad", "På väg", "Hämtad", "Klar", "Avbokad"];
const PAYMENT_METHOD_OPTIONS = ["Faktura", "Kort", "Kontant", "Swish", "Uber", "Bolt", "Avenyn Taxi"];
const VEHICLE_STATUS_OPTIONS = ["Aktiv", "På service", "Service bokad", "Uthyrd", "Offline"];
const ROLE_OPTIONS = ["driver", "admin"] as const;

type DriverRole = (typeof ROLE_OPTIONS)[number];

type Driver = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  auth_user_id: string | null;
  role: DriverRole | null;
  active: boolean | null;
  salary_percent?: number | null;
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

type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_time: string;
  price: number;
  payment_method: string;
  status: string;
  assigned_driver_id: string | null;
  vehicle_id: string | null;
  notes: string;
  created_by_auth_user_id: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
};

function money(value: number | string | null | undefined) {
  return `${Number(value || 0).toLocaleString("sv-SE")} kr`;
}

function safeNumber(value: unknown) {
  return Number(value || 0);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(value: string) {
  if (!value) return new Date().toISOString();
  return new Date(value).toISOString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("sv-SE");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("sv-SE");
}

function isSameDay(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isFutureOrToday(value?: string | null) {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return d.getTime() >= start;
}

function mapLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function telLink(phone: string) {
  return `tel:${phone}`;
}

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Auth form
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  // Add driver
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverRole, setDriverRole] = useState<DriverRole>("driver");

  // Add vehicle
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [vehicleDriverId, setVehicleDriverId] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState("Aktiv");

  // Add booking
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [pickupTime, setPickupTime] = useState(toDateTimeLocal(new Date().toISOString()));
  const [price, setPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Avenyn Taxi");
  const [assignedDriverId, setAssignedDriverId] = useState("");
  const [assignedVehicleId, setAssignedVehicleId] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");

  // Filters
  const [bookingStatusFilter, setBookingStatusFilter] = useState("Alla");

  // Quick edit states
  const [bookingStatusMap, setBookingStatusMap] = useState<Record<string, string>>({});
  const [bookingDriverMap, setBookingDriverMap] = useState<Record<string, string>>({});
  const [bookingVehicleMap, setBookingVehicleMap] = useState<Record<string, string>>({});

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

  const isAdmin = currentDriver?.role === "admin";

  async function linkUserToDriver(authUser: User) {
    if (!authUser.email) return;

    const existingByAuth = await supabase
      .from("drivers")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (existingByAuth.data) return;

    const byEmail = await supabase
      .from("drivers")
      .select("*")
      .ilike("email", authUser.email)
      .maybeSingle();

    if (byEmail.data?.id) {
      await supabase
        .from("drivers")
        .update({ auth_user_id: authUser.id })
        .eq("id", byEmail.data.id);
    }
  }

  async function fetchCurrentDriver(authUser: User) {
    const byAuth = await supabase
      .from("drivers")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (byAuth.error) throw new Error(byAuth.error.message);
    if (byAuth.data) return byAuth.data as Driver;

    if (authUser.email) {
      const byEmail = await supabase
        .from("drivers")
        .select("*")
        .ilike("email", authUser.email)
        .maybeSingle();

      if (byEmail.error) throw new Error(byEmail.error.message);
      if (byEmail.data) return byEmail.data as Driver;
    }

    return null;
  }

  async function loadAppData(driver: Driver | null) {
    if (!driver) {
      setDrivers([]);
      setVehicles([]);
      setBookings([]);
      return;
    }

    const driversRes = await supabase.from("drivers").select("*").order("full_name", { ascending: true });
    const vehiclesRes = await supabase.from("vehicles").select("*").order("created_at", { ascending: false });

    const bookingsRes = driver.role === "admin"
      ? await supabase.from("bookings").select("*").order("pickup_time", { ascending: true })
      : await supabase
          .from("bookings")
          .select("*")
          .eq("assigned_driver_id", driver.id)
          .order("pickup_time", { ascending: true });

    const errors = [driversRes.error?.message, vehiclesRes.error?.message, bookingsRes.error?.message].filter(Boolean);
    if (errors.length > 0) {
      throw new Error(errors.join(" | "));
    }

    setDrivers((driversRes.data as Driver[]) || []);
    setVehicles((vehiclesRes.data as Vehicle[]) || []);
    setBookings(
      ((bookingsRes.data as Booking[]) || []).map((b) => ({
        ...b,
        price: safeNumber(b.price),
      }))
    );
  }

  async function bootstrap(authUser: User | null) {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!authUser) {
        setCurrentDriver(null);
        setDrivers([]);
        setVehicles([]);
        setBookings([]);
        return;
      }

      await linkUserToDriver(authUser);
      const me = await fetchCurrentDriver(authUser);
      setCurrentDriver(me);

      if (!me) {
        setDrivers([]);
        setVehicles([]);
        setBookings([]);
        setError("Inget förarkonto är kopplat till denna inloggning ännu. Lägg in samma e-post på föraren i tabellen drivers.");
        return;
      }

      await loadAppData(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda appen.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(data.session);
      setUser(data.session?.user ?? null);
      await bootstrap(data.session?.user ?? null);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      await bootstrap(nextSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const statusMap: Record<string, string> = {};
    const driverMapLocal: Record<string, string> = {};
    const vehicleMapLocal: Record<string, string> = {};

    bookings.forEach((b) => {
      statusMap[b.id] = b.status || "Ny";
      driverMapLocal[b.id] = b.assigned_driver_id || "";
      vehicleMapLocal[b.id] = b.vehicle_id || "";
    });

    setBookingStatusMap(statusMap);
    setBookingDriverMap(driverMapLocal);
    setBookingVehicleMap(vehicleMapLocal);
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const rows = [...bookings];
    if (bookingStatusFilter !== "Alla") {
      return rows.filter((b) => b.status === bookingStatusFilter);
    }
    return rows;
  }, [bookings, bookingStatusFilter]);

  const todayBookings = useMemo(() => bookings.filter((b) => isSameDay(b.pickup_time)), [bookings]);
  const upcomingBookings = useMemo(
    () => bookings.filter((b) => isFutureOrToday(b.pickup_time) && b.status !== "Klar" && b.status !== "Avbokad"),
    [bookings]
  );
  const completedBookings = useMemo(() => bookings.filter((b) => b.status === "Klar"), [bookings]);
  const totalBookingValue = useMemo(
    () => bookings.reduce((sum, b) => sum + safeNumber(b.price), 0),
    [bookings]
  );

  async function runAction(action: () => Promise<void>, successText: string) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await action();
      setSuccess(successText);
      await bootstrap(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel.");
    } finally {
      setSaving(false);
    }
  }

  async function signIn() {
    if (!authEmail || !authPassword) {
      setError("Fyll i e-post och lösenord.");
      return;
    }

    setAuthLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) throw new Error(error.message);
      setSuccess("Inloggad.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte logga in.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signUp() {
    if (!authEmail || !authPassword) {
      setError("Fyll i e-post och lösenord.");
      return;
    }

    setAuthLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) throw new Error(error.message);
      setSuccess("Konto skapat. Om e-posten matchar en förare kopplas kontot automatiskt vid inloggning.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa konto.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setCurrentDriver(null);
    setDrivers([]);
    setVehicles([]);
    setBookings([]);
    setSuccess("Utloggad.");
  }

  async function addDriver() {
    if (!driverName.trim()) {
      setError("Fyll i förarens namn.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("drivers").insert({
        full_name: driverName.trim(),
        phone: driverPhone.trim(),
        email: driverEmail.trim() || null,
        role: driverRole,
        active: true,
        salary_percent: 33,
      });

      if (error) throw new Error(error.message);

      setDriverName("");
      setDriverPhone("");
      setDriverEmail("");
      setDriverRole("driver");
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
      setVehicleDriverId("");
      setVehicleStatus("Aktiv");
    }, "Bil sparad.");
  }

  async function addBooking() {
    if (!customerName.trim() || !pickupAddress.trim() || !dropoffAddress.trim() || !pickupTime) {
      setError("Fyll i kund, hämtadress, lämningsadress och tid.");
      return;
    }

    await runAction(async () => {
      const { error } = await supabase.from("bookings").insert({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        pickup_address: pickupAddress.trim(),
        dropoff_address: dropoffAddress.trim(),
        pickup_time: fromDateTimeLocal(pickupTime),
        price: Number(price || 0),
        payment_method: paymentMethod,
        status: assignedDriverId ? "Tilldelad" : "Ny",
        assigned_driver_id: assignedDriverId || null,
        vehicle_id: assignedVehicleId || null,
        notes: bookingNotes.trim(),
        created_by_auth_user_id: user?.id || null,
      });

      if (error) throw new Error(error.message);

      setCustomerName("");
      setCustomerPhone("");
      setPickupAddress("");
      setDropoffAddress("");
      setPickupTime(toDateTimeLocal(new Date().toISOString()));
      setPrice("");
      setPaymentMethod("Avenyn Taxi");
      setAssignedDriverId("");
      setAssignedVehicleId("");
      setBookingNotes("");
    }, "Bokning skapad.");
  }

  async function saveQuickBooking(id: string) {
    const nextStatus = bookingStatusMap[id] || "Ny";
    const nextDriver = bookingDriverMap[id] || null;
    const nextVehicle = bookingVehicleMap[id] || null;

    await runAction(async () => {
      const payload: Partial<Booking> & { completed_at?: string | null } = {
        status: nextStatus,
        assigned_driver_id: nextDriver,
        vehicle_id: nextVehicle,
      };

      if (nextStatus === "Klar") {
        payload.completed_at = new Date().toISOString();
      } else {
        payload.completed_at = null;
      }

      const { error } = await supabase.from("bookings").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    }, "Bokning uppdaterad.");
  }

  async function updateMyBookingStatus(id: string, status: string) {
    await runAction(async () => {
      const payload: Partial<Booking> & { completed_at?: string | null } = {
        status,
      };

      if (status === "Klar") {
        payload.completed_at = new Date().toISOString();
      }

      const { error } = await supabase.from("bookings").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
    }, "Status uppdaterad.");
  }

  async function deleteBooking(id: string) {
    if (!confirm("Ta bort bokningen?")) return;

    await runAction(async () => {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }, "Bokning borttagen.");
  }

  const activeDrivers = drivers.filter((d) => d.active !== false);
  const adminCards = [
    { label: "Förare", value: drivers.length, sub: `${activeDrivers.length} aktiva` },
    { label: "Bilar", value: vehicles.length, sub: "I systemet" },
    { label: "Bokningar idag", value: todayBookings.length, sub: "Dagens körningar" },
    { label: "Kommande", value: upcomingBookings.length, sub: "Ej avslutade" },
    { label: "Klara", value: completedBookings.length, sub: "Historik" },
    { label: "Bokningsvärde", value: money(totalBookingValue), sub: "Totalt" },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif" }}>
        <div style={{ fontWeight: 800, fontSize: 20 }}>Laddar Avenyn Taxi...</div>
      </div>
    );
  }

  if (!session || !user) {
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
          .wrap { max-width: 520px; margin: 0 auto; padding-top: 60px; }
          .card { background: #fff; border: 1px solid #ece7da; border-radius: 18px; padding: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
          .title { font-size: 28px; font-weight: 900; margin: 0 0 6px; }
          .sub { color: #6b7280; margin: 0 0 18px; font-size: 14px; font-weight: 600; }
          .label { display: block; margin-bottom: 6px; font-size: 12px; color: #6b7280; font-weight: 800; }
          .input { width: 100%; border: 1px solid #e5e7eb; border-radius: 12px; padding: 13px 14px; font-size: 15px; font-weight: 700; }
          .btn { border: 0; border-radius: 10px; padding: 12px 14px; font-size: 14px; font-weight: 800; cursor: pointer; }
          .btn-yellow { background: #e9b13b; color: #fff; }
          .btn-gray { background: #ece7da; color: #111827; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .alert-error, .alert-success { padding: 12px 14px; border-radius: 12px; margin-bottom: 12px; font-weight: 700; }
          .alert-error { background: #fff1f1; color: #a52b2b; border: 1px solid #efc8c8; }
          .alert-success { background: #eefbf1; color: #1f7a3d; border: 1px solid #bde3c8; }
        `}</style>

        <div className="wrap">
          <div className="card">
            <h1 className="title">{COMPANY.name}</h1>
            <p className="sub">Login för förare och admin • Bokningssystem Version 1</p>

            {error ? <div className="alert-error">{error}</div> : null}
            {success ? <div className="alert-success">{success}</div> : null}

            <div>
              <label className="label">E-post</label>
              <input
                className="input"
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="forare@avenyntaxi.se"
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <label className="label">Lösenord</label>
              <input
                className="input"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Minst 6 tecken"
              />
            </div>

            <div className="grid" style={{ marginTop: 16 }}>
              <button className="btn btn-yellow" onClick={signIn} disabled={authLoading}>
                Logga in
              </button>
              <button className="btn btn-gray" onClick={signUp} disabled={authLoading}>
                Skapa konto
              </button>
            </div>

            <div style={{ marginTop: 16, fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              Admin: skapa först en rad i <strong>drivers</strong> med rätt e-post och <strong>role = admin</strong>.
              <br />
              Förare: använd samma e-post i Auth och i tabellen <strong>drivers</strong>.
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        .container { max-width: 1380px; margin: 0 auto; }
        .topbar { background: #fff; border: 1px solid #ece7da; border-radius: 16px; padding: 16px 18px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03); display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .top-title { font-size: 28px; font-weight: 900; margin: 0; color: #111827; }
        .top-sub { margin: 6px 0 0; color: #6b7280; font-size: 14px; font-weight: 600; }
        .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 7px 10px; font-size: 12px; font-weight: 800; background: #f4efe4; color: #111827; }
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
        .input, .select, .textarea { width: 100%; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; padding: 13px 14px; font-size: 15px; font-weight: 700; color: #111827; outline: none; }
        .textarea { min-height: 88px; resize: vertical; font-family: Arial, sans-serif; }
        .input:focus, .select:focus, .textarea:focus { border-color: #f2b233; box-shadow: 0 0 0 3px rgba(242, 178, 51, 0.15); }
        .btn { border: 0; border-radius: 10px; padding: 11px 16px; font-size: 14px; font-weight: 800; cursor: pointer; }
        .btn-yellow { background: #e9b13b; color: #fff; }
        .btn-yellow:hover { background: #dca22d; }
        .btn-red { background: #d65c4f; color: #fff; }
        .btn-red:hover { background: #c84b3e; }
        .btn-gray { background: #ece7da; color: #111827; }
        .btn-dark { background: #111827; color: #fff; }
        .btn-green { background: #1f7a3d; color: #fff; }
        .btn-blue { background: #2563eb; color: #fff; }
        .row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .alert-error, .alert-success { padding: 12px 14px; border-radius: 12px; margin-bottom: 12px; font-weight: 700; }
        .alert-error { background: #fff1f1; color: #a52b2b; border: 1px solid #efc8c8; }
        .alert-success { background: #eefbf1; color: #1f7a3d; border: 1px solid #bde3c8; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { text-align: left; padding: 12px 8px; border-bottom: 1px solid #f0ece2; vertical-align: top; }
        th { color: #6b7280; font-size: 12px; font-weight: 800; text-transform: uppercase; }
        .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 9px; font-size: 12px; font-weight: 800; background: #f7f3ea; color: #111827; }
        .trip-card { border: 1px solid #efe7d8; border-radius: 14px; padding: 14px; background: #fffdfa; margin-bottom: 12px; }
        .trip-head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .trip-title { font-size: 18px; font-weight: 900; margin: 0; }
        .trip-meta { font-size: 13px; color: #6b7280; font-weight: 700; }
        .trip-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
        .trip-box { background: #fff; border: 1px solid #f0ece2; border-radius: 12px; padding: 10px 12px; }
        .trip-box-label { font-size: 11px; color: #6b7280; font-weight: 800; margin-bottom: 4px; text-transform: uppercase; }
        .trip-box-value { font-size: 14px; font-weight: 800; color: #111827; }
        .links a { color: #2563eb; text-decoration: none; font-weight: 800; }
        @media (max-width: 1100px) {
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .grid-2, .grid-3, .grid-4, .trip-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="container">
        <div className="topbar">
          <div>
            <h1 className="top-title">{COMPANY.name}</h1>
            <p className="top-sub">
              Bokningssystem Version 1 • {isAdmin ? "Adminpanel" : "Förarvy"} • {currentDriver?.full_name || user.email}
            </p>
          </div>

          <div className="row-actions">
            <span className="badge">{isAdmin ? "Admin" : "Förare"}</span>
            <span className="badge">{user.email}</span>
            <button className="btn btn-gray" onClick={() => bootstrap(user)} disabled={saving}>
              Uppdatera
            </button>
            <button className="btn btn-dark" onClick={signOut}>
              Logga ut
            </button>
          </div>
        </div>

        {error ? <div className="alert-error">{error}</div> : null}
        {success ? <div className="alert-success">{success}</div> : null}

        {isAdmin ? (
          <>
            <div className="stats-grid">
              {adminCards.map((card) => (
                <div className="stat" key={card.label}>
                  <div className="stat-label">{card.label}</div>
                  <div className="stat-value">{card.value}</div>
                  <div className="stat-sub">{card.sub}</div>
                </div>
              ))}
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
                  <label className="label">E-post</label>
                  <input className="input" type="email" value={driverEmail} onChange={(e) => setDriverEmail(e.target.value)} />
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="label">Roll</label>
                  <select className="select" value={driverRole} onChange={(e) => setDriverRole(e.target.value as DriverRole)}>
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-yellow" onClick={addDriver} disabled={saving}>
                    Spara förare
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
                    {VEHICLE_STATUS_OPTIONS.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-yellow" onClick={addVehicle} disabled={saving}>
                    Spara bil
                  </button>
                </div>
              </div>

              <div className="card">
                <h2 className="card-title">Skapa bokning</h2>

                <div>
                  <label className="label">Kundnamn</label>
                  <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="label">Telefon</label>
                  <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="label">Hämtadress</label>
                  <input className="input" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="label">Lämningsadress</label>
                  <input className="input" value={dropoffAddress} onChange={(e) => setDropoffAddress(e.target.value)} />
                </div>

                <div className="grid-2" style={{ marginTop: 10 }}>
                  <div>
                    <label className="label">Tid</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Pris</label>
                    <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                  </div>
                </div>

                <div className="grid-2" style={{ marginTop: 10 }}>
                  <div>
                    <label className="label">Betalsätt</label>
                    <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      {PAYMENT_METHOD_OPTIONS.map((method) => (
                        <option key={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Förare</label>
                    <select className="select" value={assignedDriverId} onChange={(e) => setAssignedDriverId(e.target.value)}>
                      <option value="">Ingen ännu</option>
                      {drivers
                        .filter((d) => d.role !== "admin")
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.full_name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="label">Bil</label>
                  <select className="select" value={assignedVehicleId} onChange={(e) => setAssignedVehicleId(e.target.value)}>
                    <option value="">Ingen ännu</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.reg})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 10 }}>
                  <label className="label">Notering</label>
                  <textarea className="textarea" value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} />
                </div>

                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-yellow" onClick={addBooking} disabled={saving}>
                    Skapa bokning
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 className="card-title">Alla bokningar</h2>
                  <p className="card-subtitle">Skapa, tilldela, uppdatera status och ta bort bokningar.</p>
                </div>

                <div style={{ minWidth: 240 }}>
                  <label className="label">Filter status</label>
                  <select
                    className="select"
                    value={bookingStatusFilter}
                    onChange={(e) => setBookingStatusFilter(e.target.value)}
                  >
                    <option value="Alla">Alla</option>
                    {BOOKING_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Tid</th>
                    <th>Kund</th>
                    <th>Från / Till</th>
                    <th>Förare</th>
                    <th>Bil</th>
                    <th>Status</th>
                    <th>Pris</th>
                    <th>Åtgärder</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div>{formatDateTime(b.pickup_time)}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>Skapad: {formatDateTime(b.created_at)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800 }}>{b.customer_name}</div>
                        <div style={{ color: "#6b7280" }}>{b.customer_phone || "-"}</div>
                      </td>
                      <td>
                        <div>
                          <strong>Från:</strong> {b.pickup_address}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <strong>Till:</strong> {b.dropoff_address}
                        </div>
                        {b.notes ? (
                          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 12 }}>{b.notes}</div>
                        ) : null}
                      </td>
                      <td>
                        <select
                          className="select"
                          value={bookingDriverMap[b.id] || ""}
                          onChange={(e) =>
                            setBookingDriverMap((prev) => ({ ...prev, [b.id]: e.target.value }))
                          }
                        >
                          <option value="">Ingen</option>
                          {drivers
                            .filter((d) => d.role !== "admin")
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.full_name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={bookingVehicleMap[b.id] || ""}
                          onChange={(e) =>
                            setBookingVehicleMap((prev) => ({ ...prev, [b.id]: e.target.value }))
                          }
                        >
                          <option value="">Ingen</option>
                          {vehicles.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.reg})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="select"
                          value={bookingStatusMap[b.id] || "Ny"}
                          onChange={(e) =>
                            setBookingStatusMap((prev) => ({ ...prev, [b.id]: e.target.value }))
                          }
                        >
                          {BOOKING_STATUS_OPTIONS.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800 }}>{money(b.price)}</div>
                        <div style={{ color: "#6b7280", fontSize: 12 }}>{b.payment_method || "-"}</div>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button className="btn btn-yellow" onClick={() => saveQuickBooking(b.id)} disabled={saving}>
                            Spara
                          </button>
                          <button className="btn btn-red" onClick={() => deleteBooking(b.id)} disabled={saving}>
                            Ta bort
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8}>Inga bokningar hittades.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="grid-2">
              <div className="card">
                <h2 className="card-title">Förare</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Namn</th>
                      <th>E-post</th>
                      <th>Telefon</th>
                      <th>Roll</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id}>
                        <td>{d.full_name}</td>
                        <td>{d.email || "-"}</td>
                        <td>{d.phone || "-"}</td>
                        <td>{d.role || "driver"}</td>
                      </tr>
                    ))}
                    {drivers.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Inga förare ännu.</td>
                      </tr>
                    ) : null}
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
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((v) => (
                      <tr key={v.id}>
                        <td>{v.name}</td>
                        <td>{v.reg}</td>
                        <td>{v.driver_id ? driverMap[v.driver_id]?.full_name || "-" : "-"}</td>
                        <td>{v.status}</td>
                      </tr>
                    ))}
                    {vehicles.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Inga bilar ännu.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat">
                <div className="stat-label">Mitt namn</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{currentDriver?.full_name || "-"}</div>
                <div className="stat-sub">{currentDriver?.phone || user.email}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Mina idag</div>
                <div className="stat-value">{todayBookings.length}</div>
                <div className="stat-sub">Bokningar idag</div>
              </div>
              <div className="stat">
                <div className="stat-label">Kommande</div>
                <div className="stat-value">{upcomingBookings.length}</div>
                <div className="stat-sub">Ej avslutade</div>
              </div>
              <div className="stat">
                <div className="stat-label">Klara</div>
                <div className="stat-value">{completedBookings.length}</div>
                <div className="stat-sub">Genomförda</div>
              </div>
              <div className="stat">
                <div className="stat-label">Värde</div>
                <div className="stat-value">{money(totalBookingValue)}</div>
                <div className="stat-sub">Mina bokningar</div>
              </div>
              <div className="stat">
                <div className="stat-label">Roll</div>
                <div className="stat-value" style={{ fontSize: 22 }}>Förare</div>
                <div className="stat-sub">Egen vy</div>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">Mina körningar</h2>
              <p className="card-subtitle">Här ser du dina tilldelade körningar och kan uppdatera status.</p>

              {bookings.map((b) => (
                <div className="trip-card" key={b.id}>
                  <div className="trip-head">
                    <div>
                      <div className="trip-title">{b.customer_name}</div>
                      <div className="trip-meta">
                        {formatDateTime(b.pickup_time)} • {money(b.price)} • {b.payment_method || "-"}
                      </div>
                    </div>

                    <div className="pill">{b.status}</div>
                  </div>

                  <div className="trip-grid">
                    <div className="trip-box">
                      <div className="trip-box-label">Hämtadress</div>
                      <div className="trip-box-value">{b.pickup_address}</div>
                      <div className="links" style={{ marginTop: 8 }}>
                        <a href={mapLink(b.pickup_address)} target="_blank" rel="noreferrer">
                          Öppna karta
                        </a>
                      </div>
                    </div>

                    <div className="trip-box">
                      <div className="trip-box-label">Lämningsadress</div>
                      <div className="trip-box-value">{b.dropoff_address}</div>
                      <div className="links" style={{ marginTop: 8 }}>
                        <a href={mapLink(b.dropoff_address)} target="_blank" rel="noreferrer">
                          Öppna karta
                        </a>
                      </div>
                    </div>

                    <div className="trip-box">
                      <div className="trip-box-label">Kund</div>
                      <div className="trip-box-value">{b.customer_name}</div>
                      <div className="links" style={{ marginTop: 8 }}>
                        {b.customer_phone ? (
                          <a href={telLink(b.customer_phone)}>{b.customer_phone}</a>
                        ) : (
                          "-"
                        )}
                      </div>
                    </div>

                    <div className="trip-box">
                      <div className="trip-box-label">Bil</div>
                      <div className="trip-box-value">
                        {b.vehicle_id ? `${vehicleMap[b.vehicle_id]?.name || "-"} (${vehicleMap[b.vehicle_id]?.reg || "-"})` : "-"}
                      </div>
                    </div>
                  </div>

                  {b.notes ? (
                    <div style={{ marginTop: 12, color: "#6b7280", fontWeight: 700 }}>
                      Notering: {b.notes}
                    </div>
                  ) : null}

                  <div className="row-actions" style={{ marginTop: 12 }}>
                    <button className="btn btn-blue" onClick={() => updateMyBookingStatus(b.id, "På väg")} disabled={saving}>
                      På väg
                    </button>
                    <button className="btn btn-yellow" onClick={() => updateMyBookingStatus(b.id, "Hämtad")} disabled={saving}>
                      Hämtad
                    </button>
                    <button className="btn btn-green" onClick={() => updateMyBookingStatus(b.id, "Klar")} disabled={saving}>
                      Klar
                    </button>
                  </div>
                </div>
              ))}

              {bookings.length === 0 ? <div>Du har inga bokningar ännu.</div> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}