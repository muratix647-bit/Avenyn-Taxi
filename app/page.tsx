"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

type Driver = {
  id: string;
  full_name: string;
  phone?: string | null;
  salary_percent?: number | null;
  auth_user_id?: string | null;
  created_at?: string | null;
};

type ProfileDbRole = "Admin" | "Partner" | "Ekonomi";

type Profile = {
  id: string;
  full_name?: string | null;
  role: ProfileDbRole;
  status?: string | null;
  created_at?: string | null;
  email?: string | null;
};

type Trip = {
  id: string;
  driver_id: string | null;
  amount: number;
  trip_date: string;
  source?: string | null;
  note?: string | null;
  created_at?: string | null;
};

function money(value: number) {
  return `${Number(value || 0).toLocaleString("sv-SE")} kr`;
}

function prettyDate(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("sv-SE");
}

function mapDbRoleToAppRole(dbRole?: string | null): "admin" | "driver" {
  if (dbRole === "Admin" || dbRole === "Ekonomi") return "admin";
  return "driver";
}

function mapAppRoleToDbRole(role: "admin" | "driver"): ProfileDbRole {
  return role === "admin" ? "Admin" : "Partner";
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "driver" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);

  const [newDriver, setNewDriver] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedLinkDriverId, setSelectedLinkDriverId] = useState("");

  const [tripAmount, setTripAmount] = useState("");
  const [tripDriver, setTripDriver] = useState("");
  const [tripSource, setTripSource] = useState("Avenyn Taxi");
  const [tripNote, setTripNote] = useState("");

  useEffect(() => {
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setRole(null);
        setDrivers([]);
        setProfiles([]);
        setTrips([]);
        setCurrentDriver(null);
        setLoading(false);
        return;
      }

      try {
        await loadEverything(nextUser.id);
      } catch (err: any) {
        setPageError(err?.message || "Kunde inte ladda användardata.");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function init() {
    try {
      setLoading(true);
      setPageError("");
      setSuccessMessage("");

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

      setUser(user ?? null);

      if (!user) {
        setLoading(false);
        return;
      }

      await loadEverything(user.id);
    } catch (err: any) {
      setPageError(err?.message || "Kunde inte starta sidan.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEverything(userId: string) {
    setPageError("");
    setSuccessMessage("");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, created_at, email")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      setRole(null);
      setDrivers([]);
      setProfiles([]);
      setTrips([]);
      setCurrentDriver(null);
      throw new Error(
        "Ingen profil hittades för den inloggade användaren. Lägg först in användaren i public.profiles."
      );
    }

    const appRole = mapDbRoleToAppRole(profile.role);
    setRole(appRole);

    if (appRole === "admin") {
      const [driversRes, profilesRes, tripsRes] = await Promise.all([
        supabase.from("drivers").select("*").order("full_name", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, full_name, role, status, created_at, email")
          .order("created_at", { ascending: true }),
        supabase.from("trips").select("*").order("trip_date", { ascending: false }),
      ]);

      if (driversRes.error) throw driversRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (tripsRes.error) throw tripsRes.error;

      const nextDrivers = (driversRes.data || []) as Driver[];
      const nextProfiles = (profilesRes.data || []) as Profile[];
      const nextTrips = (tripsRes.data || []) as Trip[];

      setDrivers(nextDrivers);
      setProfiles(nextProfiles);
      setTrips(nextTrips);
      setCurrentDriver(null);

      if (nextDrivers.length > 0 && !tripDriver) {
        setTripDriver(nextDrivers[0].id);
      }

      if (nextDrivers.length > 0 && !selectedLinkDriverId) {
        setSelectedLinkDriverId(nextDrivers[0].id);
      }

      if (nextProfiles.length > 0 && !selectedUser) {
        setSelectedUser(nextProfiles[0].id);
      }

      return;
    }

    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (driverError) throw driverError;

    const resolvedDriver = (driver as Driver | null) || null;
    setCurrentDriver(resolvedDriver);
    setDrivers(resolvedDriver ? [resolvedDriver] : []);
    setProfiles([]);
    setTripDriver(resolvedDriver?.id || "");

    if (!resolvedDriver) {
      setTrips([]);
      return;
    }

    const { data: ownTrips, error: ownTripsError } = await supabase
      .from("trips")
      .select("*")
      .eq("driver_id", resolvedDriver.id)
      .order("trip_date", { ascending: false });

    if (ownTripsError) throw ownTripsError;

    setTrips((ownTrips || []) as Trip[]);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setPageError("");
      setSuccessMessage("");

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      setSuccessMessage("Inloggning lyckades.");
    } catch (err: any) {
      setPageError(err?.message || "Inloggning misslyckades.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      setSaving(true);
      setPageError("");
      setSuccessMessage("");

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      setPageError(err?.message || "Kunde inte logga ut.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshData() {
    try {
      if (!user) return;
      setLoading(true);
      await loadEverything(user.id);
      setSuccessMessage("Data uppdaterad.");
    } catch (err: any) {
      setPageError(err?.message || "Kunde inte uppdatera data.");
    } finally {
      setLoading(false);
    }
  }

  async function createDriver() {
    if (!newDriver.trim()) {
      setPageError("Fyll i namn för ny förare.");
      return;
    }

    try {
      setSaving(true);
      setPageError("");
      setSuccessMessage("");

      const { error } = await supabase.from("drivers").insert({
        full_name: newDriver.trim(),
      });

      if (error) throw error;

      setNewDriver("");
      setSuccessMessage("Förare skapad.");

      if (user) {
        await loadEverything(user.id);
      }
    } catch (err: any) {
      setPageError(err?.message || "Kunde inte skapa förare.");
    } finally {
      setSaving(false);
    }
  }

  async function linkDriver() {
    if (!selectedUser || !selectedLinkDriverId) {
      setPageError("Välj både user och förare.");
      return;
    }

    try {
      setSaving(true);
      setPageError("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("drivers")
        .update({ auth_user_id: selectedUser })
        .eq("id", selectedLinkDriverId);

      if (error) throw error;

      setSuccessMessage("Förare kopplad till user.");

      if (user) {
        await loadEverything(user.id);
      }
    } catch (err: any) {
      setPageError(err?.message || "Kunde inte koppla förare.");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId: string, nextRole: "admin" | "driver") {
    try {
      setSaving(true);
      setPageError("");
      setSuccessMessage("");

      const dbRole = mapAppRoleToDbRole(nextRole);

      const { error } = await supabase
        .from("profiles")
        .update({ role: dbRole, status: "Aktiv" })
        .eq("id", userId);

      if (error) throw error;

      setSuccessMessage(`Roll uppdaterad till ${dbRole}.`);

      if (user) {
        await loadEverything(user.id);
      }
    } catch (err: any) {
      setPageError(err?.message || "Kunde inte ändra roll.");
    } finally {
      setSaving(false);
    }
  }

  async function createTrip() {
    if (!tripDriver) {
      setPageError("Välj förare.");
      return;
    }

    if (!tripAmount || Number(tripAmount) <= 0) {
      setPageError("Fyll i giltigt belopp.");
      return;
    }

    try {
      setSaving(true);
      setPageError("");
      setSuccessMessage("");

      const { error } = await supabase.from("trips").insert({
        driver_id: tripDriver,
        amount: Number(tripAmount),
        trip_date: new Date().toISOString(),
        source: tripSource || null,
        note: tripNote.trim() || null,
      });

      if (error) throw error;

      setTripAmount("");
      setTripSource("Avenyn Taxi");
      setTripNote("");
      setSuccessMessage("Körning skapad.");

      if (user) {
        await loadEverything(user.id);
      }
    } catch (err: any) {
      setPageError(err?.message || "Kunde inte skapa körning.");
    } finally {
      setSaving(false);
    }
  }

  const salaryCards = useMemo(() => {
    return drivers.map((driver) => {
      const driverTrips = trips.filter((t) => t.driver_id === driver.id);
      const total = driverTrips.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const salaryPercent = Number(driver.salary_percent ?? 33);
      const salary = Math.round((total * salaryPercent) / 100);

      return {
        driver,
        total,
        salary,
        salaryPercent,
        driverTrips,
      };
    });
  }, [drivers, trips]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-lg">Laddar Avenyn Taxi...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6">
            <div className="inline-flex rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1 text-sm text-blue-200">
              Avenyn Taxi • V4.2
            </div>
            <h1 className="mt-5 text-3xl font-bold">Logga in</h1>
            <p className="mt-2 text-sm text-slate-300">
              Logga in för att öppna adminpanel eller förarvy.
            </p>
          </div>

          {pageError && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {pageError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">E-post</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none focus:border-blue-400"
                placeholder="admin@avenyntaxi.se"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Lösenord</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 outline-none focus:border-blue-400"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-semibold transition hover:bg-blue-500 disabled:opacity-60"
            >
              {saving ? "Loggar in..." : "Logga in"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-white/10 bg-gradient-to-r from-blue-700/30 to-slate-900 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-blue-200">
                Avenyn Taxi
              </div>
              <h1 className="mt-2 text-3xl font-bold">Dashboard V4.2</h1>
              <p className="mt-2 text-slate-300">
                Inloggad som {user.email} • Roll: {role || "-"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={refreshData}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10"
              >
                Uppdatera
              </button>
              <button
                onClick={logout}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold hover:bg-red-500"
              >
                Logga ut
              </button>
            </div>
          </div>
        </header>

        {pageError && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {pageError}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            {successMessage}
          </div>
        )}

        {role === "admin" && (
          <section className="mb-8 grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg">
              <h2 className="mb-4 text-xl font-bold">Skapa förare</h2>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={newDriver}
                  onChange={(e) => setNewDriver(e.target.value)}
                  placeholder="Förarens namn"
                  className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400"
                />
                <button
                  onClick={createDriver}
                  disabled={saving}
                  className="rounded-2xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-60"
                >
                  Skapa
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg">
              <h2 className="mb-4 text-xl font-bold">Koppla förare till user</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={selectedLinkDriverId}
                  onChange={(e) => setSelectedLinkDriverId(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400"
                >
                  <option value="">Välj förare</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400"
                >
                  <option value="">Välj user</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.email || p.full_name || p.id}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={linkDriver}
                disabled={saving}
                className="mt-4 rounded-2xl bg-green-600 px-4 py-3 font-semibold hover:bg-green-500 disabled:opacity-60"
              >
                Koppla
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg xl:col-span-2">
              <h2 className="mb-4 text-xl font-bold">Sätt roller</h2>
              <div className="grid gap-3">
                {profiles.length === 0 ? (
                  <div className="text-slate-400">Inga profiler hittades.</div>
                ) : (
                  profiles.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="font-semibold">{p.email || p.full_name || p.id}</div>
                        <div className="text-sm text-slate-400">
                          Roll: {p.role} • Status: {p.status || "-"}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => changeRole(p.id, "admin")}
                          disabled={saving}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-60"
                        >
                          Admin
                        </button>
                        <button
                          onClick={() => changeRole(p.id, "driver")}
                          disabled={saving}
                          className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600 disabled:opacity-60"
                        >
                          Driver
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg xl:col-span-2">
              <h2 className="mb-4 text-xl font-bold">Skapa körning</h2>
              <div className="grid gap-3 md:grid-cols-4">
                <select
                  value={tripDriver}
                  onChange={(e) => setTripDriver(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400"
                >
                  <option value="">Välj förare</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Belopp"
                  value={tripAmount}
                  onChange={(e) => setTripAmount(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400"
                />

                <input
                  value={tripSource}
                  onChange={(e) => setTripSource(e.target.value)}
                  placeholder="Källa"
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400"
                />

                <input
                  value={tripNote}
                  onChange={(e) => setTripNote(e.target.value)}
                  placeholder="Anteckning"
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-blue-400"
                />
              </div>

              <button
                onClick={createTrip}
                disabled={saving}
                className="mt-4 rounded-2xl bg-green-600 px-4 py-3 font-semibold hover:bg-green-500 disabled:opacity-60"
              >
                Skapa körning
              </button>
            </div>
          </section>
        )}

        {role === "driver" && (
          <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg">
            <h2 className="text-xl font-bold">Min profil</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <div className="text-sm text-slate-400">Namn</div>
                <div className="mt-2 text-xl font-bold">{currentDriver?.full_name || "-"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <div className="text-sm text-slate-400">Telefon</div>
                <div className="mt-2 text-xl font-bold">{currentDriver?.phone || "-"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <div className="text-sm text-slate-400">Löneprocent</div>
                <div className="mt-2 text-xl font-bold">
                  {currentDriver?.salary_percent ?? 33}%
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg">
          <h2 className="mb-4 text-2xl font-bold">
            {role === "admin" ? "Lön och körningar per förare" : "Mina körningar"}
          </h2>

          {salaryCards.length === 0 ? (
            <div className="text-slate-400">Ingen data att visa ännu.</div>
          ) : (
            <div className="space-y-6">
              {salaryCards.map(({ driver, total, salary, salaryPercent, driverTrips }) => (
                <div
                  key={driver.id}
                  className="rounded-3xl border border-white/10 bg-slate-900/70 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-xl font-bold">{driver.full_name}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        User kopplad: {driver.auth_user_id || "Nej"}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-sm text-slate-400">Omsättning</div>
                        <div className="mt-2 text-2xl font-bold">{money(total)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-sm text-slate-400">Lön ({salaryPercent}%)</div>
                        <div className="mt-2 text-2xl font-bold">{money(salary)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {driverTrips.length === 0 ? (
                      <div className="text-slate-400">Inga körningar för denna förare.</div>
                    ) : (
                      driverTrips.map((t) => (
                        <div
                          key={t.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="font-semibold">{money(t.amount)}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {prettyDate(t.trip_date)}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            Källa: {t.source || "-"}
                          </div>
                          <div className="mt-1 text-sm text-slate-400">
                            Notering: {t.note || "-"}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}