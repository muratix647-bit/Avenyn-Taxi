"use client";


import {petText} from '@/lib/pets';
import AppLanguage, {useAppLanguage,AppText} from "@/components/app-language";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CarFront,
  ChevronRight,
  Eye,
  EyeOff,
  House,
  KeyRound,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import DriverFlightCard from "@/components/driver-flight-card";
import CustomerSmartGuide from "@/components/customer-smart-guide";
import CustomerBookingDialog from "@/components/customer-booking-dialog";
import CustomerTripFooter from "@/components/customer-trip-footer";
import CustomerTimeEditor from "@/components/customer-time-editor";
import DeleteAccount from "@/components/delete-account";
import { useSupabaseSession } from "@/hooks/use-supabase-session";

const statusLabels: Record<string, string> = {
  new: "Bokning mottagen",
  offered: "Förare kontaktas",
  assigned: "Förare tilldelad",
  accepted: "Körning accepterad",
  en_route: "Föraren är på väg",
  arrived: "Föraren är framme",
  passenger_onboard: "Resan pågår",
  completed: "Resan är klar",
  cancelled: "Avbokad",
};

const localDateTime = (value: string) => `${String(value).slice(0,10).split("-").reverse().join("/")} kl ${String(value).slice(11,16)}`;

const readableAuthError = (message: string) => {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials"))
    return "Fel e-postadress eller lösenord.";
  if (value.includes("email not confirmed"))
    return "Bekräfta först kontot via länken i din e-post.";
  if (value.includes("password should be"))
    return "Lösenordet måste innehålla minst 8 tecken.";
  if (value.includes("rate limit"))
    return "För många försök. Vänta en stund och försök igen.";
  return message || "Inloggningen kunde inte genomföras.";
};

function CustomerPortalContent() {
  const { client, session, loading, error: authError } = useSupabaseSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [portal, setPortal] = useState<any>(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [cancelBusy, setCancelBusy] = useState("");

  const loadTrips = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingTrips(true);
    setError("");
    try {
      const response = await fetch("/api/customer-bookings", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload?.error || "Dina resor kunde inte hämtas.");
      setPortal(payload);
    } catch (reason: any) {
      setError(reason?.message || "Dina resor kunde inte hämtas.");
    } finally {
      setLoadingTrips(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (session) loadTrips();
    else setPortal(null);
  }, [session, loadTrips]);

  useEffect(() => {
    if (!client) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("mode") === "register") setAuthMode("register");
    if (query.get("recovery") === "1") setRecoveryMode(true);
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => data.subscription.unsubscribe();
  }, [client]);

  useEffect(()=>{if(session&&!recoveryMode&&new URLSearchParams(window.location.search).get('next')==='foretag')window.location.replace('/foretag');},[session,recoveryMode]);

  const groups = useMemo(() => {
    const rows = portal?.bookings || [];
    const active = rows.filter(
      (row: any) => !["completed", "cancelled"].includes(row.status),
    );
    const history = rows.filter((row: any) =>
      ["completed", "cancelled"].includes(row.status),
    );
    return { active, history };
  }, [portal]);

  const authenticate = async () => {
    if (!client || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Skriv en giltig e-postadress.");
      return;
    }
    if (password.length < 8) {
      setError("Lösenordet måste innehålla minst 8 tecken.");
      return;
    }
    setAuthBusy(true);
    setError("");
    setNotice("");
    if (authMode === "register") {
      const { data, error: signUpError } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/customer${new URLSearchParams(window.location.search).get("next")==="foretag"?"?next=foretag&portal=1":""}` },
      });
      setAuthBusy(false);
      if (signUpError) {
        setError(readableAuthError(signUpError.message));
        return;
      }
      if (!data.session)
        setNotice(
          "Kontot är skapat. Kontrollera din e-post och bekräfta kontot innan du loggar in.",
        );
      return;
    }
    const { error: signInError } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setAuthBusy(false);
    if (signInError) setError(readableAuthError(signInError.message));
  };

  const sendPasswordReset = async () => {
    if (!client || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Skriv din e-postadress först.");
      return;
    }
    setAuthBusy(true);
    setError("");
    const { error: resetError } = await client.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/customer?recovery=1` },
    );
    setAuthBusy(false);
    if (resetError) setError(readableAuthError(resetError.message));
    else
      setNotice(
        "Vi har skickat en återställningslänk till din e-postadress.",
      );
  };

  const updatePassword = async () => {
    if (!client || password.length < 8) {
      setError("Det nya lösenordet måste innehålla minst 8 tecken.");
      return;
    }
    setAuthBusy(true);
    setError("");
    const { error: updateError } = await client.auth.updateUser({ password });
    setAuthBusy(false);
    if (updateError) {
      setError(readableAuthError(updateError.message));
      return;
    }
    window.location.replace("/customer");
  };

  const signOut = async () => {
    await client?.auth.signOut();
    setPortal(null);
    setNotice("");
  };

  const cancelBooking = async (booking: any) => {
    if (!session?.access_token) return;
    if (!window.confirm(`Vill du avboka bokning #${booking.bookingNumber}? Bokningen sparas som avbokad i din historik.`)) return;
    setCancelBusy(booking.id);
    setError("");
    try {
      const response = await fetch(
        `/api/customer-bookings?id=${encodeURIComponent(booking.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Bokningen kunde inte avbokas.");
      await loadTrips();
    } catch (reason: any) {
      setError(reason?.message || "Bokningen kunde inte avbokas.");
    } finally {
      setCancelBusy("");
    }
  };

  if (loading)
    return (
      <main className="customerPortalShell">
        <p className="customerPortalLoading"><AppText text={"Öppnar Mina resor…"} /></p>
      </main>
    );

  if (!session)
    return (
      <main className="customerPortalShell">
        <header className="customerPortalHeader">
          <Link href="/">
            <img
              src="/avenyn-logo-optimized.webp"
              width="58"
              height="58"
              alt="Avenyn Taxi"
            />
            <span><AppText text={"Avenyn Taxi"} /></span>
          </Link>
          <a className="customerHomeLink" href="https://www.avenyntaxi.se/"><House /> <AppText text={"Huvudmeny"} /></a>
        </header>
        <section className="customerLoginCard">
          <div className="customerLoginIcon">
            {authMode === "register" ? <UserPlus /> : <KeyRound />}
          </div>
          <small><AppText text={"MINA RESOR"} /></small>
          <h1>{<AppText text={authMode === "register" ? "Skapa kundkonto" : "Logga in"} />}</h1>
          <p>{<AppText text={authMode === "register"
              ? "Registrera dig med samma e-postadress som du använder när du bokar."
              : "Se dina bokningar, din taxi och aktuell flyginformation."} />}</p>
          <div className="customerAuthTabs" role="tablist" aria-label="Kundkonto">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setError("");
                setNotice("");
              }}
            >
              <AppText text={"Logga in"} /></button>
            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => {
                setAuthMode("register");
                setError("");
                setNotice("");
              }}
            >
              <AppText text={"Skapa konto"} /></button>
          </div>
          <label>
            <span><AppText text={"E-postadress"} /></span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && authenticate()}
              placeholder="namn@exempel.se"
            />
          </label>
          <label>
            <span><AppText text={"Lösenord"} /></span>
            <div className="customerPasswordField">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && authenticate()}
                placeholder={authMode === "register" ? "Minst 8 tecken" : "Ditt lösenord"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          <button type="button" onClick={authenticate} disabled={authBusy}>
            {authMode === "register" ? <UserPlus /> : <KeyRound />}
            {<AppText text={authBusy
              ? "Vänta…"
              : authMode === "register"
                ? "Skapa mitt konto"
                : "Logga in"} />}
          </button>
          {authMode === "login" && (
            <button
              className="customerForgotButton"
              type="button"
              onClick={sendPasswordReset}
              disabled={authBusy}
            >
              <AppText text={"Glömt lösenordet?"} /></button>
          )}
          {(error || authError) && (
            <div className="customerPortalError" role="alert">
              {<AppText text={error || authError} />}
              {authError && <button type="button" onClick={() => window.location.reload()}><AppText text={"Försök igen"} /></button>}
            </div>
          )}
          {notice && <div className="customerPortalNotice">{<AppText text={notice} />}</div>}
          <div className="customerLoginSecurity">
            <ShieldCheck />
            <span>
              <b><AppText text={"Säker inloggning"} /></b>
              <small><AppText text={"Ditt lösenord hanteras säkert av Supabase och sparas aldrig av Avenyn Taxi."} /></small>
            </span>
          </div>
          <a className="customerBackLink" href="https://www.avenyntaxi.se/">
            <AppText text={"Till huvudmenyn och bokningen"} /></a>
        </section>
        <CustomerSmartGuide />
      </main>
    );

  if (recoveryMode)
    return (
      <main className="customerPortalShell">
        <header className="customerPortalHeader">
          <Link href="/">
            <img
              src="/avenyn-logo-optimized.webp"
              width="58"
              height="58"
              alt="Avenyn Taxi"
            />
            <span><AppText text={"Avenyn Taxi"} /></span>
          </Link>
          <a className="customerHomeLink" href="https://www.avenyntaxi.se/"><House /> <AppText text={"Huvudmeny"} /></a>
        </header>
        <section className="customerLoginCard">
          <div className="customerLoginIcon"><KeyRound /></div>
          <small><AppText text={"MINA RESOR"} /></small>
          <h1><AppText text={"Välj nytt lösenord"} /></h1>
          <p><AppText text={"Använd minst 8 tecken."} /></p>
          <label>
            <span><AppText text={"Nytt lösenord"} /></span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && updatePassword()}
            />
          </label>
          <button type="button" onClick={updatePassword} disabled={authBusy}>
            <KeyRound /> {<AppText text={authBusy ? "Sparar…" : "Spara nytt lösenord"} />}
          </button>
          {error && <div className="customerPortalError" role="alert">{<AppText text={error} />}</div>}
        </section>
      </main>
    );

  const openBooking = (booking: any) => {
    if (booking.trackingToken)
      window.location.assign(`/track/${booking.trackingToken}`);
  };

  const renderBooking = (booking: any) => (
    <article
      className="customerTripCard customerTripCardClickable"
      key={booking.id}
      role="link"
      tabIndex={0}
      aria-label={`Öppna bokning ${booking.bookingNumber} och visa taxi och flyg live`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a,button,input,select,textarea")) return;
        openBooking(booking);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openBooking(booking);
        }
      }}
    >
      <div className="customerTripTop">
        <span>
          <small><AppText text={"BOKNING #"} />{<AppText text={booking.bookingNumber} />}</small>
          <b>{<AppText text={statusLabels[booking.status] || booking.status} />}</b>
        </span>
        <strong>{<AppText text={booking.price} />} <AppText text={"kr"} /></strong>
      </div>
      <p className="customerTripTime">
        <CalendarClock /> {localDateTime(booking.pickupTime)}
      </p>
      <div className="customerTripRoute">
        <div>
          <MapPin />
          <span>
            <small><AppText text={"Hämtning"} /></small>
            <b>{booking.pickup}</b>
          </span>
        </div>
        <div>
          <MapPin />
          <span>
            <small><AppText text={"Destination"} /></small>
            <b>{booking.destination}</b>
          </span>
        </div>
      </div>
      {booking.driverName && (
        <p className="customerTripDriver">
          <CarFront /> <AppText text={"Förare:"} /><b>{<AppText text={booking.driverName} />}</b>
        </p>
      )}
      {booking.canEdit && booking.trackingToken && <CustomerTimeEditor booking={booking} onSaved={()=>void loadTrips()}/>}
      {(booking.canEdit || booking.canCancel) && (
        <div className="customerTripActions">
          {booking.canEdit && (
            <button type="button" onClick={() => setEditingBooking(booking)}>
              <Pencil /> <AppText text={"Ändra övrigt"} /></button>
          )}
          {booking.canCancel && (
            <button
              type="button"
              className="danger"
              disabled={cancelBusy === booking.id}
              onClick={() => cancelBooking(booking)}
            >
              <Trash2 /> {<AppText text={cancelBusy === booking.id ? "Avbokar…" : "Avboka"} />}
            </button>
          )}
        </div>
      )}
      {booking.petDetails&&<p className="petTripBadge"><AppText text="Djur"/>: {petText(booking.petDetails)}</p>}<div className="customerTripActions"><Link href={`/?rebook=${encodeURIComponent(booking.id)}#booking-form`}><AppText text={"Boka igen"} /></Link><Link href={`/?rebook=${encodeURIComponent(booking.id)}&direction=return#booking-form`}><AppText text={"Boka återresa"} /></Link></div>
      <DriverFlightCard
        flightNumber={booking.flightNumber}
        pickupTime={booking.pickupTime}
        pickupAddress={booking.pickup}
        destinationAddress={booking.destination}
        trackingToken={booking.trackingToken}
      />
      <Link
        className="customerTripLiveButton"
        href={`/track/${booking.trackingToken}`}
      >
        <AppText text={"Visa resa"} /><ChevronRight />
      </Link>
    </article>
  );

  return (
    <main className="customerPortalShell">
      <header className="customerPortalHeader">
        <Link href="/">
          <img
            src="/avenyn-logo-optimized.webp"
            width="58"
            height="58"
            alt="Avenyn Taxi"
          />
          <span><AppText text={"Mina resor"} /></span>
        </Link>
        <div className="customerPortalHeaderActions">
          <a className="customerHomeLink" href="https://www.avenyntaxi.se/"><House /> <AppText text={"Huvudmeny"} /></a>
          <button type="button" onClick={signOut}>
            <LogOut /> <AppText text={"Logga ut"} /></button>
        </div>
      </header>
      <section className="customerPortalMain">
        <div className="customerPortalTitle">
          <span>
            <small><AppText text={"INLOGGAD SOM"} /></small>
            <h1>{<AppText text={portal?.email || session.user.email} />}</h1>
          </span>
          <button type="button" onClick={loadTrips} disabled={loadingTrips}>
            <RefreshCw className={loadingTrips ? "spinning" : ""} />
            <AppText text={"Uppdatera"} /></button>
        </div>
        {error && (
          <div className="customerPortalError" role="alert">
            {<AppText text={error} />}
          </div>
        )}
        {loadingTrips && !portal && <p role="status"><AppText text={"Hämtar dina resor…"} /></p>}
        {!loadingTrips && !error && !groups.active.length && !groups.history.length ? (
          <div className="customerTripsEmpty">
            <CarFront />
            <h2><AppText text={"Inga bokningar hittades"} /></h2>
            <p>
              <AppText text={"Använd samma e-postadress som i bokningen, eller boka en ny resa."} /></p>
            <a href="/#booking-form"><AppText text={"Boka taxi"} /></a>
          </div>
        ) : (
          <>
            {groups.active.length > 0 && (
              <section className="customerTripGroup">
                <h2><AppText text={"Aktuella resor"} /></h2>
                <div>{<AppText text={groups.active.map(renderBooking)} />}</div>
              </section>
            )}
            {groups.history.length > 0 && (
              <section className="customerTripGroup customerTripHistory">
                <h2><AppText text={"Tidigare resor"} /></h2>
                <div>{<AppText text={groups.history.map(renderBooking)} />}</div>
              </section>
            )}
          </>
        )}
        <DeleteAccount
          accessToken={session.access_token}
          kind="customer"
          onDeleted={() => client?.auth.signOut()}
        />
      </section>
      <CustomerBookingDialog
        booking={editingBooking}
        open={Boolean(editingBooking)}
        accessToken={session.access_token}
        onOpenChange={(value) => !value && setEditingBooking(null)}
        onSaved={loadTrips}
      />
      <CustomerSmartGuide />
      <CustomerTripFooter/>
    </main>
  );
}

export default function CustomerPortal() {return <AppLanguage kind="customer" picker={true}><CustomerPortalContent/></AppLanguage>}
