"use client";

import { useEffect, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Driver = {
  id: string;
  full_name: string;
  auth_user_id: string | null;
};

type Profile = {
  id: string;
  email: string;
  role: string; // ← viktigt: DB använder Admin / Partner / Ekonomi
};

type Trip = {
  id: string;
  driver_id: string;
  amount: number;
  trip_date: string;
};

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "driver" | null>(null);
  const [loading, setLoading] = useState(true);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);

  const [newDriver, setNewDriver] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  const [tripAmount, setTripAmount] = useState("");
  const [tripDriver, setTripDriver] = useState("");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data } = await supabase.auth.getUser();
    const u = data.user;

    if (!u) {
      setLoading(false);
      return;
    }

    setUser(u);

    // 🔥 FIX: använd maybeSingle istället för single
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();

    // 🔥 FIX: mappa DB → app
    const dbRole = profile?.role;

    if (dbRole === "Admin") setRole("admin");
    else setRole("driver");

    await loadData(u.id, dbRole);

    setLoading(false);
  }

  async function loadData(userId: string, dbRole: string | null) {
    if (dbRole === "Admin") {
      const { data: drivers } = await supabase.from("drivers").select("*");
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: trips } = await supabase.from("trips").select("*");

      setDrivers(drivers || []);
      setProfiles(profiles || []);
      setTrips(trips || []);
    } else {
      // 🔥 FIX: kanske ingen driver kopplad → maybeSingle
      const { data: driver } = await supabase
        .from("drivers")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (!driver) return;

      const { data: trips } = await supabase
        .from("trips")
        .select("*")
        .eq("driver_id", driver.id);

      setTrips(trips || []);
    }
  }

  async function createDriver() {
    if (!newDriver) return;

    await supabase.from("drivers").insert({
      full_name: newDriver,
    });

    setNewDriver("");
    location.reload();
  }

  async function linkDriver(driverId: string) {
    if (!selectedUser) return;

    await supabase
      .from("drivers")
      .update({ auth_user_id: selectedUser })
      .eq("id", driverId);

    location.reload();
  }

  async function changeRole(userId: string, newRole: string) {
    const dbRole = newRole === "admin" ? "Admin" : "Partner";

    await supabase
      .from("profiles")
      .update({ role: dbRole })
      .eq("id", userId);

    location.reload();
  }

  async function createTrip() {
    if (!tripDriver || !tripAmount) return;

    await supabase.from("trips").insert({
      driver_id: tripDriver,
      amount: Number(tripAmount),
      trip_date: new Date().toISOString(),
    });

    setTripAmount("");
    location.reload();
  }

  async function logout() {
    await supabase.auth.signOut();
    location.reload();
  }

  function calcSalary(driverId: string) {
    const driverTrips = trips.filter((t) => t.driver_id === driverId);
    const total = driverTrips.reduce((sum, t) => sum + t.amount, 0);
    return Math.round(total * 0.33);
  }

  if (loading) return <div className="p-10">Laddar...</div>;
  if (!user) return <div className="p-10">Inte inloggad</div>;

  return (
    <div className="p-10 space-y-10">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Avenyn Taxi V4.2</h1>
          <p>{user.email}</p>
          <p>Roll: {role}</p>
        </div>

        <button
          onClick={logout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Logga ut
        </button>
      </div>

      {role === "admin" && (
        <>
          {/* CREATE DRIVER */}
          <div className="border p-4 rounded">
            <h2 className="font-bold mb-2">Skapa förare</h2>
            <input
              value={newDriver}
              onChange={(e) => setNewDriver(e.target.value)}
              placeholder="Namn"
              className="border p-2 mr-2"
            />
            <button
              onClick={createDriver}
              className="bg-blue-500 text-white px-3 py-2"
            >
              Skapa
            </button>
          </div>

          {/* LINK DRIVER */}
          <div className="border p-4 rounded">
            <h2 className="font-bold mb-2">Koppla förare → user</h2>

            <select onChange={(e) => setSelectedUser(e.target.value)}>
              <option>Välj user</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.email}
                </option>
              ))}
            </select>

            {drivers.map((d) => (
              <div key={d.id} className="mt-2">
                {d.full_name}
                <button
                  onClick={() => linkDriver(d.id)}
                  className="ml-2 bg-green-500 text-white px-2 py-1"
                >
                  Koppla
                </button>
              </div>
            ))}
          </div>

          {/* CHANGE ROLE */}
          <div className="border p-4 rounded">
            <h2 className="font-bold mb-2">Sätt roller</h2>

            {profiles.map((p) => (
              <div key={p.id} className="mb-2">
                {p.email} ({p.role})
                <button
                  onClick={() => changeRole(p.id, "admin")}
                  className="ml-2 bg-blue-500 text-white px-2"
                >
                  Admin
                </button>
                <button
                  onClick={() => changeRole(p.id, "driver")}
                  className="ml-2 bg-gray-500 text-white px-2"
                >
                  Driver
                </button>
              </div>
            ))}
          </div>

          {/* CREATE TRIP */}
          <div className="border p-4 rounded">
            <h2 className="font-bold mb-2">Skapa körning</h2>

            <select onChange={(e) => setTripDriver(e.target.value)}>
              <option>Välj förare</option>
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
              className="border p-2 ml-2"
            />

            <button
              onClick={createTrip}
              className="bg-green-500 text-white px-3 py-2 ml-2"
            >
              Skapa
            </button>
          </div>
        </>
      )}

      {/* TRIPS + SALARY */}
      <div>
        <h2 className="text-xl font-bold mb-2">Körningar</h2>

        {drivers.map((d) => (
          <div key={d.id} className="border p-3 mb-4 rounded">
            <h3 className="font-bold">{d.full_name}</h3>

            <div className="text-sm text-gray-500">
              Lön (33%): {calcSalary(d.id)} kr
            </div>

            {trips
              .filter((t) => t.driver_id === d.id)
              .map((t) => (
                <div key={t.id}>
                  {t.trip_date} • {t.amount} kr
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}