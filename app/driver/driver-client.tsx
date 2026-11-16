"use client";
import {selectedNavigationPhase,type NavigationChoice} from "@/lib/driver-navigation-choice";
import {driverMapTrip,journeyStarted} from "@/lib/driver-journey";
import "./driver-focus.css";
import DriverTripNotes from "@/components/driver-trip-notes";
import DriverPickupTime from '@/components/driver-pickup-time';
import DriverTripTiming from '@/components/driver-trip-timing';
import {driverUpcomingTrips} from '@/lib/driver-upcoming-trips';
import {pickupAt} from '@/lib/prebooking-watch';
import {driverPickupLabel} from '@/lib/driver-pickup-label';
import {DRIVER_BOOKING_CHANNEL,DRIVER_BOOKING_IMPORTANCE,DRIVER_NOTICE_MS} from '@/lib/driver-notifications';

import DriverWorkMap from '@/components/driver-work-map';
import {contactVisible} from '@/lib/driver-trip-privacy';
import DriverPetPreference from '@/components/driver-pet-preference';
import {petText} from '@/lib/pets';
import AppLanguage, {useAppLanguage,AppText} from "@/components/app-language";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { BackgroundGeolocation } from "@capgo/background-geolocation";
import {
  Ban,
  Banknote,
  BellRing,
  CalendarDays,
  CarFront,
  CreditCard,
  House,
  MapPin,
  Navigation,
  Phone,
  Power,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import SupabaseLogin from "@/components/supabase-login";
import AppChat from "@/components/app-chat";
import { useSupabaseSession } from "@/hooks/use-supabase-session";
import { authHeaders } from "@/lib/supabase-browser";
import DriverActiveTrip from "@/components/driver-active-trip";
import BookingAlert from "@/components/booking-alert";
import DriverAudioSettings from "@/components/driver-audio-settings";
import TripVoiceCall from "@/components/trip-voice-call";
import DriverFlightCard from "@/components/driver-flight-card";
import DeleteAccount from "@/components/delete-account";
import StreetPayments from "@/components/street-payments";
import DriverDailyGoal from "@/components/driver-daily-goal";
import DriverHistory from "./driver-history";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusText: Record<string, string> = {
  offered: "Tilldelad",
  assigned: "Tilldelad",
  accepted: "Tilldelad",
  en_route: "På väg",
  arrived: "Framme",
  passenger_onboard: "Kund i bilen",
  completed: "Slutförd",
};

type PushState =
  | "checking"
  | "inactive"
  | "active"
  | "blocked"
  | "unsupported";

type GpsState = "web" | "starting" | "active" | "error";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0),
  );
}

function supportsNativeBackgroundGps() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("BackgroundGeolocation")
  );
}

function supportsNativePushNotifications() {
  return (
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("PushNotifications")
  );
}

function DriverClientContent() {
  const {
    client,
    session,
    loading,
    error: authError,
    setError: setAuthError,
  } = useSupabaseSession();
  const [localMapPosition,setLocalMapPosition]=useState<any>(null);
  const [sheetOpen,setSheetOpen]=useState(false);
  const [expandedMap,setExpandedMap]=useState(false);
  const toggleExpandedMap=()=>{setSheetOpen(false);setExpandedMap(v=>!v)};
  useEffect(()=>{if(!expandedMap)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setExpandedMap(false)};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[expandedMap]);
  const [bookingTab,setBookingTab]=useState<'mine'|'available'>('mine');
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(timer)},[]);
  const openBookings=(tab:'mine'|'available')=>{setBookingTab(tab);setDriverView('work');setSheetOpen(true)};
  const [mapSize,setMapSize]=useState('normal');
  const [freeMap,setFreeMap]=useState(false);
  useEffect(()=>{try{const saved=localStorage.getItem('avenyn-driver-map-size');if(saved&&['small','normal','large'].includes(saved))setMapSize(saved);}catch{}},[]);
  const chooseMapSize=(value:string)=>{setMapSize(value);try{localStorage.setItem('avenyn-driver-map-size',value)}catch{}};

  const [selectedRouteId,setSelectedRouteId]=useState<string|null>(null);
  const [navigationChoice,setNavigationChoice]=useState<NavigationChoice|null>(null);
  const openedNotification=useRef<string|null>(null);
  const [reminderNotice,setReminderNotice]=useState<{body:string;url:string}|null>(null);
  const [tapRequest,setTapRequest]=useState(0);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<number | null>(null);
  const [data, setData] = useState<any>(null),
    [trips, setTrips] = useState<any[]>([]),
    [prebookings, setPrebookings] = useState<any[]>([]),
    [summary, setSummary] = useState<any>({ trips: 0, revenue: 0 }),
    [driverView, setDriverView] = useState<"work" | "payments" | "history" | "account">("work"),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [online, setOnline] = useState(false),
    [availability, setAvailability] = useState("available"),
    [msg, setMsg] = useState(""),
    [paymentNotice, setPaymentNotice] = useState(""),
    [updating, setUpdating] = useState<string | null>(null),
    [passwordSetup, setPasswordSetup] = useState(false),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState(""),
    [passwordBusy, setPasswordBusy] = useState(false),
    [inviteVerifying, setInviteVerifying] = useState(false),
    [pushState, setPushState] = useState<PushState>("checking"),
    [pushBusy, setPushBusy] = useState(false),
    [nativeApp, setNativeApp] = useState(false),
    [gpsState, setGpsState] = useState<GpsState>("web"),
    [gpsDisclosureOpen, setGpsDisclosureOpen] = useState(false),
    [completionTrip, setCompletionTrip] = useState<any | null>(null),
    [completionAmount, setCompletionAmount] = useState(""),
    [completionMethod, setCompletionMethod] = useState("card"),
    [completionPaid, setCompletionPaid] = useState(true),
    [completionNote, setCompletionNote] = useState(""),
    [completionError, setCompletionError] = useState(""),
    [logoutBusy, setLogoutBusy] = useState(false);
  const [chatOpen,setChatOpen]=useState(false);
  const dismissedKey=`avenyn-hidden-prebookings:${session?.user.id||''}`;
  const [dismissed,setDismissed]=useState<{key:string;ids:string[]}>({key:'',ids:[]});
  useEffect(()=>{try{const ids=JSON.parse(localStorage.getItem(dismissedKey)||'[]');setDismissed({key:dismissedKey,ids:Array.isArray(ids)?ids:[]})}catch{setDismissed({key:dismissedKey,ids:[]})}},[dismissedKey]);
  const hiddenIds=dismissed.key===dismissedKey?dismissed.ids:[];
  const visiblePrebookings=prebookings.filter(t=>(t.available||!hiddenIds.includes(String(t.id)))&&!trips.some(trip=>trip.id===t.id&&contactVisible(trip)));
  const hidePrebooking=(id:string)=>{const ids=[...new Set([...hiddenIds,String(id)])].slice(-1500);setDismissed({key:dismissedKey,ids});try{localStorage.setItem(dismissedKey,JSON.stringify(ids))}catch{}};
  const restorePrebookings=()=>{setDismissed({key:dismissedKey,ids:[]});try{localStorage.removeItem(dismissedKey)}catch{}};
  useEffect(()=>{if(trips.some(contactVisible))setSheetOpen(false)},[trips.length]);
  const watch = useRef<number | null>(null),
    heartbeat = useRef<ReturnType<typeof setInterval> | null>(null),
    lastPosition = useRef<GeolocationPosition | null>(null),
    lastSent = useRef(0),
    trackingStarted = useRef(false),
    nativeTrackingStarted = useRef(false),
    nativeTrackingToken = useRef<string | null>(null),
    nativeTrackingBusy = useRef(false),
    knownTrips = useRef<Set<string> | null>(null),
    knownPaidTrips = useRef<Set<string> | null>(null),
    soundTimer = useRef<ReturnType<typeof setInterval> | null>(null),
    soundStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inviteVerificationStarted = useRef(false);
  useEffect(() => {
    if (gpsDisclosureOpen) setMsg("");
  }, [gpsDisclosureOpen]);
  useEffect(() => {
    const isNative = supportsNativeBackgroundGps();
    setNativeApp(isNative);
    if (isNative) setGpsState("starting");
  }, []);
  useEffect(() => {
    if (!msg) return;
    const timer = window.setTimeout(() => setMsg(""), DRIVER_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [msg]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (query.get("invite") === "invalid")
      setAuthError(
        "Lösenordslänken är ogiltig eller har gått ut. Be dispatch skicka en ny SMS-länk.",
      );
    setPasswordSetup(
      query.get("setup") === "password" ||
        ["invite", "recovery"].includes(hash.get("type") || ""),
    );
  }, [setAuthError]);
  useEffect(() => {
    if (!client || inviteVerificationStarted.current) return;
    const query = new URLSearchParams(window.location.search);
    const tokenHash = query.get("token_hash") || "";
    const verificationType = query.get("type") || "";
    if (
      !tokenHash ||
      !["invite", "recovery"].includes(verificationType)
    )
      return;

    inviteVerificationStarted.current = true;
    setInviteVerifying(true);
    setPasswordSetup(true);
    setAuthError("");
    client.auth
      .verifyOtp({
        token_hash: tokenHash,
        type: verificationType as "invite" | "recovery",
      })
      .then(({ error }) => {
        if (error) {
          setPasswordSetup(false);
          setAuthError(
            "Länken är ogiltig eller har gått ut. Be dispatch skicka en ny SMS-länk.",
          );
          return;
        }
        window.history.replaceState({}, "", "/driver?setup=password");
      })
      .catch(() => {
        setPasswordSetup(false);
        setAuthError(
          "Länken kunde inte öppnas. Be dispatch skicka en ny SMS-länk.",
        );
      })
      .finally(() => setInviteVerifying(false));
  }, [client, setAuthError]);
  const stopSound = () => {
    if (soundTimer.current) clearInterval(soundTimer.current);
    if (soundStopTimer.current) clearTimeout(soundStopTimer.current);
    soundTimer.current = null;
    soundStopTimer.current = null;
  };
  const ringForNewTrip = () => {
    window.dispatchEvent(new Event('avenyn-booking-arrived'));
  };
  const api = async (url: string, init: RequestInit = {}) =>
    fetch(url, {
      ...init,
      credentials: "same-origin",
      headers: { ...(init.headers || {}), ...(await authHeaders()) },
    });
  const saveNativePushToken = async (token: string) => {
    const response = await api("/api/driver-push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nativeToken: token,
        platform: Capacitor.getPlatform(),
      }),
    });
    const saved = await response.json();
    if (!response.ok)
      throw new Error(saved.error || "Notiser kunde inte aktiveras.");
    return saved;
  };
  useEffect(() => {
    if (!session || !data?.profile?.approved) return;
    if (supportsNativePushNotifications()) {
      let disposed = false;
      const handles: Array<{ remove: () => Promise<void> }> = [];
      const setupNativePush = async () => {
        try {
          if (Capacitor.getPlatform() === "android") {
            await PushNotifications.createChannel({
              id: DRIVER_BOOKING_CHANNEL,
              name: "Bokningar",
              description: "Nya och uppdaterade bokningar",
              importance: DRIVER_BOOKING_IMPORTANCE,
              visibility: 1,
              vibration: true,
            });
          }
          handles.push(
            await PushNotifications.addListener(
              "registration",
              async (token) => {
                if (disposed) return;
                try {
                  await saveNativePushToken(token.value);
                  setPushState("active");
                } catch (error: any) {
                  setPushState("inactive");
                  setMsg(error?.message || "Notiser kunde inte aktiveras.");
                } finally {
                  setPushBusy(false);
                }
              },
            ),
          );
          handles.push(
            await PushNotifications.addListener("registrationError", () => {
              if (disposed) return;
              setPushState("inactive");
              setPushBusy(false);
              setMsg("Telefonen kunde inte registreras för pushnotiser.");
            }),
          );
          handles.push(
            await PushNotifications.addListener(
              "pushNotificationReceived",
              (notification) => {
                const tag = String(notification.data?.tag || "");
                if(!disposed&&tag.startsWith('driver-reminder-')){setReminderNotice({body:notification.body||'Du har en kommande körning.',url:String(notification.data?.url||'/driver')});ringForNewTrip();navigator.vibrate?.([200,100,200]);void refreshTrips.current();}
                if (!disposed && tag.startsWith("booking-")) {ringForNewTrip();void refreshTrips.current();}
              },
            ),
          );
          handles.push(
            await PushNotifications.addListener(
              "pushNotificationActionPerformed",
              (action) => {
                const url = action.notification.data?.url;
                if (
                  !disposed &&
                  typeof url === "string" &&
                  url.startsWith("/")
                )
                  window.location.assign(url);
              },
            ),
          );
          const permission = await PushNotifications.checkPermissions();
          if (permission.receive === "granted") {
            setPushState("checking");
            await PushNotifications.register();
          } else setPushState("inactive");
        } catch {
          if (!disposed) setPushState("inactive");
        }
      };
      setupNativePush();
      return () => {
        disposed = true;
        handles.forEach((handle) => handle.remove().catch(() => {}));
      };
    }
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("blocked");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) =>
        setPushState(subscription ? "active" : "inactive"),
      )
      .catch(() => setPushState("inactive"));
  }, [session, data?.profile?.approved]);

  const enablePushNotifications = async () => {
    if (supportsNativePushNotifications()) {
      setPushBusy(true);
      setMsg("");
      try {
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt")
          permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted") {
          setPushState("blocked");
          setMsg("Tillåt notiser i telefonens inställningar och försök igen.");
          setPushBusy(false);
          return;
        }
        setPushState("checking");
        setMsg("Aktiverar riktiga pushnotiser…");
        await PushNotifications.register();
      } catch (error: any) {
        setPushState("inactive");
        setPushBusy(false);
        setMsg(error?.message || "Notiser kunde inte aktiveras.");
      }
      return;
    }
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setPushState("unsupported");
      return;
    }
    setPushBusy(true);
    setMsg("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("blocked");
        setMsg("Tillåt notiser i webbläsarens inställningar och försök igen.");
        return;
      }
      const configResponse = await api("/api/driver-push");
      const config = await configResponse.json();
      if (!configResponse.ok || !config.publicKey)
        throw new Error(config.error || "Pushnotiser är inte tillgängliga.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(config.publicKey),
        }));
      const saveResponse = await api("/api/driver-push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok)
        throw new Error(saved.error || "Notiser kunde inte aktiveras.");
      setPushState("active");
    } catch (error: any) {
      setPushState("inactive");
      setMsg(error?.message || "Notiser kunde inte aktiveras.");
    } finally {
      setPushBusy(false);
    }
  };
  const availableBoardIds=useRef<Set<string>|null>(null);
  const lastFastApplied=useRef(0),fastOfferIds=useRef(new Set<string>());
  const fastBusy=useRef(false),fastQueued=useRef(false);
  const refreshTrips=useRef<()=>Promise<void>>(async()=>{});
  const sheetTouchStart=useRef<number|null>(null);
  const loadActiveTrips=async()=>{
    if(fastBusy.current){fastQueued.current=true;return;}
    fastBusy.current=true;
    try{const r=await api('/api/driver-trips?activeOnly=1',{cache:'no-store'});if(!r.ok)return;const j=await r.json();const next=j.active||[];
      lastFastApplied.current=Date.now();setTrips(next);
      if(Array.isArray(j.availableIds)){availableBoardIds.current=new Set(j.availableIds);setPrebookings(rows=>rows.filter(row=>availableBoardIds.current!.has(String(row.id))));}
      const pending=next.some((t:any)=>['assigned','offered'].includes(t.status));
      if(pending){setDriverView('work');if(next.some((t:any)=>['assigned','offered'].includes(t.status)&&!fastOfferIds.current.has(String(t.id))))ringForNewTrip();}else stopSound();
      fastOfferIds.current=new Set(next.filter((t:any)=>['assigned','offered'].includes(t.status)).map((t:any)=>String(t.id)));
    }catch{}finally{fastBusy.current=false;if(fastQueued.current){fastQueued.current=false;void refreshTrips.current()}}
  };
  refreshTrips.current=loadActiveTrips;
  const loadTask=useRef<Promise<void>|null>(null);
  const load = async (force=false) => {
    if(loadTask.current){if(!force)return loadTask.current;try{await loadTask.current}catch{}}
    const task=(async()=>{
    const p = await api("/api/profile").then((r) => r.json());
    setData(p);
    if (!name && p.user?.displayName) setName(p.user.displayName);
    if (p.profile?.approved) {
      const profileOnline = Boolean(p.profile.is_online);
      setOnline(profileOnline);
      setAvailability(
        p.profile.availability_status === "offline"
          ? "available"
          : p.profile.availability_status || "available",
      );
      if (profileOnline && !trackingStarted.current) {
        if (supportsNativeBackgroundGps()) startNativeTracking().catch(() => {});
        else if (navigator.geolocation)
          navigator.geolocation.getCurrentPosition(
            (position) => beginTracking(position, true),
            () => setMsg("Tillåt platsåtkomst så att live-GPS kan fortsätta."),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
          );
      }
      if (!profileOnline && trackingStarted.current) {
        stopTracking();
        if (nativeTrackingStarted.current) stopNativeTracking().catch(() => {});
      }
      const requestStarted=Date.now();
      const r = await api("/api/driver-trips");
      if (r.ok) {
        const j:any = await r.json();
        if(lastFastApplied.current>requestStarted){setPrebookings((j.prebookings||[]).filter((row:any)=>!availableBoardIds.current||availableBoardIds.current.has(String(row.id))));setSummary(j.summary||{});setSummaryUpdatedAt(Date.now());return;}
        const next = j.active || [],
          ids = new Set(next.map((x: any) => String(x.id))),
          paidIds = new Set(
            next
              .filter((x: any) => x.payment_status === "paid")
              .map((x: any) => String(x.id)),
          );
        const hasPendingAssignment = next.some((x: any) =>
          ["assigned", "offered"].includes(x.status),
        );
        if (!hasPendingAssignment) stopSound();
        if (
          knownTrips.current &&
          next.some(
            (x: any) =>
              !knownTrips.current!.has(String(x.id)) &&
              ["assigned", "offered"].includes(x.status),
          )
        )
          ringForNewTrip();
        if (knownPaidTrips.current) {
          const newlyPaid = next.find(
            (x: any) =>
              x.payment_status === "paid" &&
              !knownPaidTrips.current!.has(String(x.id)),
          );
          if (newlyPaid) {
            setPaymentNotice(
              `Bokning #${newlyPaid.booking_number || newlyPaid.id} är betald via appen. Ta inte betalt av kunden igen.`,
            );
            if (navigator.vibrate) navigator.vibrate([180, 100, 180]);
          }
        }
        knownTrips.current = ids as any;
        knownPaidTrips.current = paidIds as any;
        setTrips(next);
        setPrebookings(j.prebookings || []);
        setSummary(j.summary || {});
        setSummaryUpdatedAt(Date.now());
      }
    }
    })();loadTask.current=task;
    try{await task}catch(error:any){setMsg(error?.message||"Körningarna kunde inte uppdateras.")}finally{if(loadTask.current===task)loadTask.current=null;}
  };
  useEffect(() => {
    if (!session || !client) return;
    load();
    const channel = client
      .channel("driver:bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {void refreshTrips.current();void load();},
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_driver_offers" },
        () => {void refreshTrips.current();void load();},
      )
      .subscribe();
    const refresh=()=>{if(document.visibilityState==='visible')void refreshTrips.current()};
    const onPush=(event:MessageEvent)=>{if(event.data?.type==='AVENYN_DRIVER_REMINDER'){setReminderNotice({body:event.data.body||'Du har en kommande körning.',url:event.data.url||'/driver'});ringForNewTrip();void refreshTrips.current()}else if(event.data?.type==='AVENYN_BOOKING_PUSH'){ringForNewTrip();void refreshTrips.current()}};
    document.addEventListener('visibilitychange',refresh);navigator.serviceWorker?.addEventListener('message',onPush);
    const offerTimer=setInterval(refresh,2000);void refreshTrips.current();
    const t = setInterval(()=>{if(document.visibilityState==='visible')void load()}, 15000);
    return () => {
      clearInterval(t);clearInterval(offerTimer);document.removeEventListener('visibilitychange',refresh);navigator.serviceWorker?.removeEventListener('message',onPush);
      client.removeChannel(channel);
      if (soundTimer.current) clearInterval(soundTimer.current);
      if (soundStopTimer.current) clearTimeout(soundStopTimer.current);
      if (heartbeat.current) clearInterval(heartbeat.current);
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
    };
  }, [session, client]);
  const register = async () => {
    await api("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    setMsg("Ansökan är skickad till dispatch.");
    load();
  };
  const savePassword = async () => {
    if (!client) return;
    if (newPassword.length < 8)
      return setAuthError("Lösenordet måste innehålla minst 8 tecken.");
    if (newPassword !== confirmPassword)
      return setAuthError("Lösenorden är inte likadana.");
    setPasswordBusy(true);
    setAuthError("");
    const { error } = await client.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (error) return setAuthError("Lösenordet kunde inte sparas. Begär en ny länk.");
    setPasswordSetup(false);
    setNewPassword("");
    setConfirmPassword("");
    window.history.replaceState({}, "", "/driver");
    setMsg("Lösenordet är sparat. Ditt förarkonto är klart.");
  };
  const send = (p: GeolocationPosition, on: boolean) => {
    if(on && p.coords.accuracy<=50)setLocalMapPosition({latitude:p.coords.latitude,longitude:p.coords.longitude,updated_at:new Date(p.timestamp).toISOString()});
    return api("/api/locations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        heading: p.coords.heading || 0,
        speedKmh: (p.coords.speed || 0) * 3.6,
        online: on,
      }),
    });
  };
  const stopTracking = () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    if (heartbeat.current) clearInterval(heartbeat.current);
    heartbeat.current = null;
    trackingStarted.current = false;
  };
  const ensureNativeGpsPermissions = async () => {
    let permissions = await BackgroundGeolocation.checkPermissions();
    if (permissions.location !== "granted")
      permissions = await BackgroundGeolocation.requestPermissions({
        permissions: ["location"],
      });
    if (permissions.notification !== "granted")
      permissions = await BackgroundGeolocation.requestPermissions({
        permissions: ["notification"],
      });
    if (
      permissions.backgroundLocation !== "granted" &&
      permissions.backgroundLocation !== "always"
    )
      permissions = await BackgroundGeolocation.requestPermissions({
        permissions: ["backgroundLocation"],
      });

    const foregroundAllowed = permissions.location === "granted";
    const backgroundAllowed =
      permissions.backgroundLocation === "granted" ||
      permissions.backgroundLocation === "always";
    if (!foregroundAllowed || !backgroundAllowed)
      throw new Error(
        "Välj Exakt plats och Tillåt hela tiden i telefonens platsinställningar.",
      );
  };
  const gpsConsentKey = () => `avenyn_driver_background_location_v2:${session?.user?.id || ""}`;
  const hasGpsConsent = () => Boolean(session?.user?.id) && localStorage.getItem(gpsConsentKey()) === "accepted";
  const startNativeTracking = async () => {
    if (!supportsNativeBackgroundGps()) return false;
    if (nativeTrackingBusy.current) return false;
    nativeTrackingBusy.current = true;
    try {
      // Every entry point, including profile restoration, must pass this gate.
      if (!hasGpsConsent()) {
        await BackgroundGeolocation.stop();
        nativeTrackingStarted.current = false;
        trackingStarted.current = false;
        setGpsState("starting");
        setGpsDisclosureOpen(true);
        return false;
      }
      if (nativeTrackingStarted.current) return true;
      setGpsState("starting");
      await ensureNativeGpsPermissions();
      await BackgroundGeolocation.stop().catch(() => {});
      const response = await api("/api/driver-native-tracking", {
        method: "POST",
      });
      const tracking = await response.json();
      if (!response.ok || !tracking.token || !tracking.endpoint)
        throw new Error(
          tracking.error || "Bakgrunds-GPS kunde inte aktiveras.",
        );
      await BackgroundGeolocation.start(
        {
          backgroundTitle: "Avenyn Taxi · GPS aktiv",
          backgroundMessage:
            "Du är online. Positionen delas med trafikledningen även när skärmen är låst.",
          requestPermissions: false,
          stale: false,
          distanceFilter: 0,
          minIntervalMs: 500,
          url: tracking.endpoint,
          headers: { Authorization: `Bearer ${tracking.token}` },
        },
        (position, error) => {
          if (error) {
            setGpsState("error");
            setMsg(
              "GPS-signalen försvann. Kontrollera att platsåtkomst är inställd på Tillåt hela tiden.",
            );
            return;
          }
          if (position) {setGpsState("active");if(position.accuracy<=50)setLocalMapPosition({latitude:position.latitude,longitude:position.longitude,updated_at:new Date().toISOString()});}
        },
      );
      nativeTrackingToken.current = tracking.token;
      nativeTrackingStarted.current = true;
      trackingStarted.current = true;
      setGpsState("active");
      return true;
    } catch (error: any) {
      nativeTrackingStarted.current = false;
      trackingStarted.current = false;
      setGpsState("error");
      setMsg(error?.message || "Bakgrunds-GPS kunde inte aktiveras.");
      return false;
    } finally {
      nativeTrackingBusy.current = false;
    }
  };
  const stopNativeTracking = async () => {
    await BackgroundGeolocation.stop().catch(() => {});
    await api("/api/driver-native-tracking", { method: "DELETE" }).catch(
      () => {},
    );
    nativeTrackingStarted.current = false;
    trackingStarted.current = false;
    setGpsState("starting");
  };
  const goOnlineWithNativeGps = async () => {
    const started = await startNativeTracking();
    if (!started) return;
    setOnline(true);
    setMsg(
      "Du är online. Bakgrunds-GPS fungerar även när telefonen är låst.",
    );
  };
  const declineGpsDisclosure = async () => {
    localStorage.removeItem(gpsConsentKey());
    setGpsDisclosureOpen(false);
    await stopNativeTracking();
    const response = await api("/api/locations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ online: false }),
    });
    setOnline(false);
    setMsg(response.ok ? "Du är offline. Platsdelning är avstängd." : "GPS är stoppad, men offline-status kunde inte sparas. Försök igen.");
  };
  const acceptGpsDisclosure = async () => {
    localStorage.setItem(gpsConsentKey(), "accepted");
    setGpsDisclosureOpen(false);
    await goOnlineWithNativeGps();
  };
  const pushLivePosition = (p: GeolocationPosition) => {
    lastPosition.current = p;
    const now = Date.now();
    if (now - lastSent.current < 500) return;
    lastSent.current = now;
    send(p, true).catch(() => {});
  };
  const beginTracking = (p: GeolocationPosition, sendImmediately = false) => {
    stopTracking();
    trackingStarted.current = true;
    lastPosition.current = p;
    lastSent.current = Date.now();
    if (sendImmediately) send(p, true).catch(() => {});
    watch.current = navigator.geolocation.watchPosition(
      pushLivePosition,
      () => setMsg("GPS-signalen försvann. Kontrollera platsåtkomsten."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    heartbeat.current = setInterval(() => {
      if (lastPosition.current && Date.now() - lastSent.current >= 1000) {
        lastSent.current = Date.now();
        send(lastPosition.current, true).catch(() => {});
      }
    }, 1000);
  };
  const toggle = async () => {
    if (online) {
      if (supportsNativeBackgroundGps()) await stopNativeTracking();
      const response = await api("/api/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ online: false }),
      });
      if (!response.ok)
        return setMsg(
          (await response.json()).error || "Offline-läget kunde inte sparas.",
        );
      stopTracking();
      setOnline(false);
      setAvailability("available");
      setMsg("Du är offline.");
    } else if (supportsNativeBackgroundGps()) {
      // A deliberate new online session always starts with the disclosure.
      // Saved consent is only used to restore an already active session.
      localStorage.removeItem(gpsConsentKey());
      setGpsDisclosureOpen(true);
    } else
      navigator.geolocation.getCurrentPosition(
        async (p) => {
          const r = await send(p, true);
          if (!r.ok) return setMsg((await r.json()).error);
          setOnline(true);
          setMsg("Du är online och GPS-positionen uppdateras live.");
          beginTracking(p);
        },
        () => setMsg("Tillåt platsåtkomst i telefonen för att gå online."),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
  };
  useEffect(() => {
    if (
      !online ||
      !navigator.geolocation ||
      supportsNativeBackgroundGps()
    )
      return;
    const resumeTracking = () => {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (position) => beginTracking(position, true),
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    };
    document.addEventListener("visibilitychange", resumeTracking);
    window.addEventListener("focus", resumeTracking);
    window.addEventListener("pageshow", resumeTracking);
    return () => {
      document.removeEventListener("visibilitychange", resumeTracking);
      window.removeEventListener("focus", resumeTracking);
      window.removeEventListener("pageshow", resumeTracking);
    };
  }, [online]);
  useEffect(() => {
    if (!online || !supportsNativeBackgroundGps()) return;
    let checking = false;
    const checkTracking = async () => {
      if (checking || document.visibilityState !== "visible" || !nativeTrackingToken.current || nativeTrackingBusy.current) return;
      checking = true;
      try {
        const response = await fetch("/api/native-location", { headers: { Authorization: `Bearer ${nativeTrackingToken.current}` }, cache: "no-store" });
        if (response.status === 401) {
          nativeTrackingStarted.current = false;
          trackingStarted.current = false;
          await startNativeTracking();
        }
      } catch { /* A network outage must not revoke a valid device token. */ }
      finally { checking = false; }
    };
    const timer = window.setInterval(() => void checkTracking(), 60000);
    document.addEventListener("visibilitychange", checkTracking);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", checkTracking); };
  }, [online, session?.access_token]);
  const logoutDriver = async () => {
    if (!client || logoutBusy) return;
    setLogoutBusy(true);
    setMsg("");
    try {
      if (supportsNativeBackgroundGps()) await stopNativeTracking();
      else stopTracking();
      await api("/api/locations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ online: false }),
      }).catch(() => null);
      setOnline(false);
      setAvailability("available");
      await client.auth.signOut();
    } finally {
      setLogoutBusy(false);
    }
  };
  const changeAvailability = async (status: string) => {
    setAvailability(status);
    const r = await api("/api/locations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ online: true, status }),
    });
    if (!r.ok) setMsg((await r.json()).error || "Statusen kunde inte ändras.");
    else
      setMsg(
        status === "available"
          ? "Du är tillgänglig."
          : status === "busy"
            ? "Du är markerad som upptagen."
            : "Du är pausad.",
      );
  };
  const status = async (id: string, s: string) => {
    if (s === "accepted") stopSound();
    setUpdating(id);
    setMsg("");
    try {
      const r = await api("/api/driver-trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bookingId: id, status: s }),
        }),
        j = await r.json();
      if (!r.ok) {
        setMsg(j.error || "Statusen kunde inte ändras.");
        return false;
      }
      await load(true);
      if(s==='accepted'){setSelectedRouteId(null);setSheetOpen(false);setMsg('Körningen är accepterad och sparad under Mina körningar. Tryck Kör till kunden när du åker.');}
      if(['en_route','arrived','passenger_onboard'].includes(s)){if(s!=='arrived')setNavigationChoice(previous=>({tripId:id,phase:s==='passenger_onboard'?'destination':'pickup',open:previous?.tripId===id?previous.open:true}));setSelectedRouteId(id);setDriverView('work');setSheetOpen(false);}
      return true;
    } finally {
      setUpdating(null);
    }
  };
  const undoStatus = async (trip: any) => {
    if (
      !confirm(
        `Ångra senaste statusen för bokning #${trip.booking_number || trip.id}?`,
      )
    )
      return;
    setUpdating(trip.id);
    setMsg("");
    try {
      const response = await api("/api/driver-trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "undo", bookingId: trip.id }),
      });
      const payload: any = await response.json();
      if (!response.ok) {
        setMsg(payload.error || "Statusen kunde inte ångras.");
        return;
      }
      setMsg("Senaste statusändringen har ångrats.");
      await load(true);
    } finally {
      setUpdating(null);
    }
  };
  const openCompletion = (trip: any) => {
    const prepaid = trip.payment_status === "paid";
    setCompletionTrip(trip);
    setCompletionAmount(String(trip.price ?? ""));
    setCompletionMethod(prepaid ? "app" : "card");
    setCompletionPaid(prepaid || true);
    setCompletionNote("");
    setCompletionError("");
  };
  const completeTrip = async () => {
    if (!completionTrip) return;
    const amount = Number(String(completionAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      setCompletionError("Ange ett giltigt slutbelopp.");
      return;
    }
    if (completionMethod === "other" && !completionNote.trim()) {
      setCompletionError("Beskriv det andra betalsättet.");
      return;
    }
    setUpdating(completionTrip.id);
    setCompletionError("");
    try {
      const response = await api("/api/driver-trips", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          bookingId: completionTrip.id,
          amount,
          paymentMethod: completionMethod,
          paid: completionPaid,
          paymentNote: completionNote,
        }),
      });
      const payload: any = await response.json();
      if (!response.ok) {
        setCompletionError(payload.error || "Körningen kunde inte slutföras.");
        return;
      }
      setCompletionTrip(null);
      setMsg("Körningen är slutförd och registrerad på ditt namn.");
      await load(true);
    } finally {
      setUpdating(null);
    }
  };
  const reject = async (id: string) => {
    if (
      !confirm("Tacka nej till körningen? Den skickas tillbaka till dispatch.")
    )
      return;
    stopSound();
    setUpdating(id);
    setMsg("");
    try {
      const r = await api("/api/driver-trips", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "reject", bookingId: id }),
        }),
        j = await r.json();
      if (!r.ok) {
        setMsg(j.error || "Körningen kunde inte avvisas.");
        return;
      }
      await load(true);
    } finally {
      setUpdating(null);
    }
  };
  const requestPayment = async (t: any) => {
    setUpdating(t.id);
    setMsg("");
    try {
      const r = await api("/api/payments/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bookingId: t.id, source: "driver" }),
        }),
        j = await r.json();
      if (!r.ok || !j.url)
        throw new Error(j.error || "Betalningslänken kunde inte skapas.");
      const share = {
        title: `Avenyn Taxi · bokning #${t.booking_number}`,
        text: `Betala ${j.amount} kr säkert för din taxiresa med Avenyn Taxi:`,
        url: j.url,
      };
      if (navigator.share) await navigator.share(share);
      else {
        await navigator.clipboard.writeText(`${share.text} ${share.url}`);
        setMsg("Betalningslänken är kopierad. Skicka den till kunden.");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError")
        setMsg(e?.message || "Betalningslänken kunde inte skapas.");
    } finally {
      setUpdating(null);
    }
  };
  const navigate = async (trip: any, toDestination = false): Promise<void> => {
    setSelectedRouteId(trip.id);
    setNavigationChoice({tripId:trip.id,phase:toDestination?'destination':'pickup',open:true});
    setDriverView('work');
    setSheetOpen(false);
    setMsg(toDestination?'Navigation till destinationen':'Navigation till hämtplatsen');
  };
  const acceptTrip = async (trip: Parameters<typeof navigate>[0]) => {
    const accepted = await status(trip.id, "accepted");
    if (accepted) setMsg("Körningen är accepterad och sparad under Mina körningar. Tryck Kör till kunden när du åker.");
  };
  const offeredTrip=trips.find(t=>["offered","assigned"].includes(t.status));
  const mapTrip=offeredTrip||(navigationChoice?.open?trips.find(t=>t.id===navigationChoice.tripId&&contactVisible(t)):undefined)||driverMapTrip(trips,selectedRouteId);
  const navigationPhase=selectedNavigationPhase(mapTrip,navigationChoice);
  const {myTrips,nextTrip,imminentTrip}=driverUpcomingTrips(trips,clock);
  const quietMap=!sheetOpen&&!offeredTrip&&!navigationPhase&&!myTrips.some(journeyStarted)&&!imminentTrip;
  const quickTrip=mapTrip&&contactVisible(mapTrip)?mapTrip:myTrips.find(journeyStarted)||imminentTrip;
  const navigationTrip=mapTrip&&contactVisible(mapTrip)?mapTrip:sheetOpen?myTrips[0]:quickTrip;
  useEffect(()=>{if(offeredTrip){setExpandedMap(false);setDriverView("work")}},[offeredTrip?.id]);
  useEffect(()=>{if(driverView!=="work"||sheetOpen)setExpandedMap(false)},[driverView,sheetOpen]);


  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('booking');
    if(!id||openedNotification.current===id||!trips.some(t=>t.id===id))return;
    openedNotification.current=id;setBookingTab('mine');setDriverView('work');setSheetOpen(true);
    window.setTimeout(()=>{Array.from(document.querySelectorAll<HTMLElement>('[data-booking-id]')).find(el=>el.dataset.bookingId===id)?.scrollIntoView({block:'nearest'});},100);
  },[trips]);

  if (loading)
    return (
      <main className="portal">
        <section className="portalcard">
          <p><AppText text={"Öppnar förarappen…"} /></p>
        </section>
      </main>
    );
  if (inviteVerifying)
    return (
      <main className="portal">
        <section className="portalcard">
          <p><AppText text={"Kontrollerar din personliga inbjudan…"} /></p>
        </section>
      </main>
    );
  if (!session && client)
    return (
      <SupabaseLogin
        client={client}
        title="Förarapp"
        error={authError}
        setError={setAuthError}
        loginKind="driver"
      />
    );
  if (!session || !client)
    return (
      <main className="portal">
        <section className="portalcard">
          <div className="notice">
            {<AppText text={authError || "Inloggningen kunde inte öppnas."} />}
          </div>
        </section>
      </main>
    );
  if (passwordSetup)
    return (
      <main className="portal">
        <section className="portalcard authCard driverPasswordCard">
          <img src="/avenyn-logo-optimized.webp" width="96" height="96" alt="Avenyn Taxi" />
          <small><AppText text={"SÄKERT FÖRARKONTO"} /></small>
          <h1><AppText text={"Välj ditt lösenord"} /></h1>
          <p><AppText text={"Lösenordet ska ha minst 8 tecken och används när du loggar in i Förarappen."} /></p>
          <label>
            <span><AppText text={"Nytt lösenord"} /></span>
            <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <label>
            <span><AppText text={"Upprepa lösenord"} /></span>
            <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && savePassword()} />
          </label>
          {authError && <div className="notice">{<AppText text={authError} />}</div>}
          <button className="primary" disabled={passwordBusy} onClick={savePassword}>
            {<AppText text={passwordBusy ? "Sparar…" : "Spara lösenord"} />}
          </button>
        </section>
      </main>
    );
  const focusedTrip = !offeredTrip && mapTrip && navigationPhase ? mapTrip : null;
  const drivingFocus = driverView === "work" && !!focusedTrip && !sheetOpen;
  return (
    <main className={`driverShell ${expandedMap?"isExpandedMap":""} ${drivingFocus ? "isDrivingFocus" : ""} ${driverView=== "work" && data?.profile?.approved ? "isMapWork" : ""}`} onClickCapture={(event)=>{
      const target=(event.target as HTMLElement).closest('button,a');
      if(!target||!data?.profile?.approved)return;
      const label=target.getAttribute('aria-label')||target.textContent?.trim();
      const bookingId=target.closest('[data-booking-id]')?.getAttribute('data-booking-id');
      if(label)void api('/api/driver-audit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId,label:label.slice(0,120)})}).then(r=>{if(!r.ok)setMsg('Knapptrycket kunde inte tidsloggas. Kontrollera anslutningen.');}).catch(()=>setMsg('Knapptrycket kunde inte tidsloggas. Kontrollera anslutningen.'));
    }}>
      <header className="appHeader">
        <Link href="/" className="miniBrand">
          <img
            src="/avenyn-logo-optimized.webp"
            width="52"
            height="52"
            alt="Avenyn Taxi"
          />
          <span><AppText text={"FÖRARAPP"} /></span>
        </Link>
        <div className="appHeaderActions">
          <a href="https://www.avenyntaxi.se/"><House /> <AppText text={"Huvudmeny"} /></a>
          <button className="textButton" disabled={logoutBusy} onClick={logoutDriver}>
            {<AppText text={logoutBusy ? "Loggar ut…" : "Logga ut"} />}
          </button>
        </div>
      </header>
      <section className="driverContent">
        <div className="driverHello">
          <div>

            <h1>
              <AppText text={"Hej,"} />{data?.profile?.name || session.user.email?.split("@")[0]}
            </h1>
          </div>
          {data?.profile?.approved && (
            <button
              className={online ? "onlineButton" : "offlineButton"}
              onClick={toggle}
            >
              <Power />
              {<AppText text={online ? "Online" : "Gå online"} />}
            </button>
          )}
        </div>
        {!data?.profile ? (
          <div className="onboardCard">
            <UserRound />
            <h2><AppText text={"Skapa förarkonto"} /></h2>
            <p>
              <AppText text={"Fyll i uppgifterna. Dispatch godkänner kontot innan du kan ta körningar."} /></p>
            <label>
              <AppText text={"Namn"} /><input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <AppText text={"Telefon"} /><input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="070-000 00 00"
              />
            </label>
            <button className="primary" onClick={register}>
              <AppText text={"Skicka ansökan"} /></button>
          </div>
        ) : !data.profile.approved ? (
          <div className="waitingCard">
            <span>⏳</span>
            <h2><AppText text={"Väntar på godkännande"} /></h2>
            <p><AppText text={"Dispatch meddelar dig när förarkontot är aktiverat."} /></p>
          </div>
        ) : (
          <>
            {reminderNotice&&<aside className="driverReminderNotice" role="alert"><strong>{reminderNotice.body}</strong><a href={reminderNotice.url}>Öppna körningen</a><button type="button" onClick={()=>setReminderNotice(null)}>Stäng</button></aside>}
            <div className="driverWorkView" data-map-size={navigationPhase?mapSize:undefined} hidden={driverView !== "work"}><DriverWorkMap freeMap={freeMap} navigationPhase={navigationPhase} localPosition={localMapPosition} navigationVisible={!sheetOpen&&!completionTrip&&!gpsDisclosureOpen&&!chatOpen} active={driverView==='work'} trip={mapTrip} busy={!!updating} message={msg} onAccept={()=>offeredTrip&&void status(offeredTrip.id,"accepted")} onReject={()=>offeredTrip&&void reject(offeredTrip.id)} accessToken={session.access_token} online={online} revenue={summary.revenue} onToggle={toggle} onHistory={()=>setDriverView('history')} onPayments={()=>{setTapRequest(v=>v+1);setDriverView('payments')}} onMore={()=>setDriverView('account')}/>
            <section className={`driverTripSheet ${sheetOpen?'isOpen':''} ${trips.some(contactVisible)?'hasActiveTrip':''} ${quietMap?'isQuietMap':''}`} data-booking-tab={bookingTab} hidden={!!offeredTrip} onTouchStart={e=>{sheetTouchStart.current=e.touches.length===1&&e.currentTarget.scrollTop<=0?e.touches[0].clientY:null}} onTouchCancel={()=>{sheetTouchStart.current=null}} onTouchEnd={e=>{if(sheetTouchStart.current!==null&&e.changedTouches.length){const delta=e.changedTouches[0].clientY-sheetTouchStart.current;if(!sheetOpen&&delta < -60)setSheetOpen(true);else if(sheetOpen&&delta>70&&e.currentTarget.scrollTop<=0)setSheetOpen(false);}sheetTouchStart.current=null}}><button type="button" className="driverExpandMap" aria-pressed={expandedMap} onClick={toggleExpandedMap}>{expandedMap?'↙ Tillbaka till körningen':'⛶ Förstora karta'}</button>{quietMap&&<button type="button" className="driverNextBooking" onClick={()=>openBookings('mine')}><span>{nextTrip?'Nästa körning':'Mina körningar'}</span><strong>{nextTrip&&Number.isFinite(pickupAt(nextTrip))?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(pickupAt(nextTrip)):nextTrip?driverPickupLabel(nextTrip):'Inga bokade körningar'}</strong><span>Visa ›</span></button>}<button type="button" className="driverUnifiedMenu" onClick={()=>setDriverView("account")} aria-label="Öppna förarmenyn">☰ Meny</button><BookingAlert key={session.user.id} owner={session.user.id} driver totalCount={visiblePrebookings.length} bookings={visiblePrebookings.filter(t=>t.can_claim)} offers={trips.filter(t=>!contactVisible(t))} onOpen={()=>{setBookingTab("available");setDriverView("work");setSheetOpen(true);window.setTimeout(()=>{const el=document.getElementById("driver-prebookings");el?.setAttribute("open","");el?.scrollIntoView({block:"nearest"});},0)}}/><button type="button" className="driverSheetToggle" aria-expanded={sheetOpen} onClick={()=>{setBookingTab("mine");setSheetOpen(v=>!v)}}><span className="driverSheetHandle"/>{focusedTrip&&!sheetOpen?<span className="driverFocusIdentity"><img src="/avenyn-logo-optimized.webp" width="38" height="38" alt="Avenyn Taxi"/><span><small>{focusedTrip.status==='passenger_onboard'?'Till destinationen':focusedTrip.status==='arrived'?'Väntar på kunden':'Hämtar upp'}</small><strong>{focusedTrip.customer_name||"Kund"}</strong><span className="driverFocusAddress">{focusedTrip.status==='passenger_onboard'?focusedTrip.destination:focusedTrip.pickup}</span></span><span className="driverFocusDetails">Resa ↑</span></span>:<><b><AppText text={trips.some(contactVisible)?sheetOpen?'Mina körningar':'Mina körningar':online?'Du är online':'Du är offline'}/></b><small>{trips.length} <AppText text="körningar"/> · <AppText text={trips.some(contactVisible)?sheetOpen?'Dölj resan':'Öppna din resa':'Visa / dölj'}/></small></>}</button>{(quickTrip?[quickTrip]:[]).map(t=><div className="driverCallRow" hidden={!sheetOpen} key={t.id}><TripVoiceCall bookingId={t.id} accessToken={session.access_token} role="driver" compact /></div>)}{!sheetOpen&&(quickTrip?[quickTrip]:[]).map(t=><div className={`driverQuickTrip ${t.status==='accepted'?'isWaiting':''}`} key={t.id}>{t.status==='accepted'&&<DriverTripTiming trip={t}/>}<div><small>{t.status==='accepted'?`Accepterad · #${t.booking_number} · ${driverPickupLabel(t)}`:t.status==='en_route'?'På väg':t.status==='arrived'?'Framme':'Kund i bilen'}</small></div><button type="button" disabled={updating===t.id} onClick={()=>t.status==='passenger_onboard'?openCompletion(t):void status(t.id,t.status==='accepted'?'en_route':t.status==='en_route'?'arrived':'passenger_onboard')}>{updating===t.id?'Sparar…':t.status==='accepted'?'START':t.status==='en_route'?'Jag är framme':t.status==='arrived'?'Kund i bilen – starta resan':'Slutför resa'}</button></div>)}{navigationTrip&&!offeredTrip&&<nav className="driverNavigationControls" aria-label="Navigation"><button type="button" aria-pressed={navigationPhase==='pickup'} onClick={()=>void navigate(navigationTrip,false)}>Till hämtplats</button><button type="button" aria-pressed={navigationPhase==='destination'} onClick={()=>void navigate(navigationTrip,true)}>Till destination</button>{navigationPhase&&<button type="button" className="closeNavigation" onClick={()=>{setNavigationChoice({tripId:navigationTrip.id,phase:navigationPhase,open:false});setSelectedRouteId(null);}}>Stäng navi</button>}</nav>}{navigationPhase&&<div className="driverMapPreferences"><label>Kartstorlek<select aria-label="Kartstorlek" value={mapSize} onChange={e=>chooseMapSize(e.target.value)}><option value="small">Liten</option><option value="normal">Normal</option><option value="large">Stor</option></select></label><button type="button" aria-pressed={freeMap} onClick={()=>setFreeMap(v=>!v)}>{freeMap?'Återgå till bilnavigation':'Fri karta · zooma själv'}</button></div>}<div className="driverSheetBody" hidden={!sheetOpen}>
            {paymentNotice && (
              <div className="driverPaymentAlert" role="alert" aria-live="assertive">
                <CreditCard />
                <div>
                  <strong><AppText text={"BETALD VIA APPEN"} /></strong>
                  <span>{<AppText text={paymentNotice} />}</span>
                </div>
                <button type="button" onClick={() => setPaymentNotice("")}>
                  <AppText text={"OK"} /></button>
              </div>
            )}
            {online && !trips.some(contactVisible) && (
              <label className="availabilityPicker">
                <span><AppText text={"Arbetsstatus"} /></span>
                <select
                  value={availability}
                  onChange={(e) => changeAvailability(e.target.value)}
                >
                  <option value="available"><AppText text={"Tillgänglig"} /></option>
                  <option value="busy"><AppText text={"Upptagen"} /></option>
                  <option value="paused"><AppText text={"Paus"} /></option>
                </select>
              </label>
            )}
            <section className="tripList" hidden={bookingTab!=="mine"}>
              <h2><AppText text={"Mina körningar"} /><small>({<AppText text={trips.length} />})</small></h2>
              {trips.length === 0 ? (
                <div className="emptyTrip">
                  <CarFront />
                  <p><AppText text={"Inga aktuella körningar."} /></p>
                </div>
              ) : (
                ([...myTrips,...trips.filter(t=>!contactVisible(t))]).map((t) => contactVisible(t) ? <DriverActiveTrip key={t.id} trip={t} accessToken={session.access_token} busy={updating===t.id} onStatus={s=>void status(t.id,s)} onUndo={()=>void undoStatus(t)} onComplete={()=>openCompletion(t)} onNavigate={destination=>navigate(t,destination)} onPayment={()=>void requestPayment(t)} onRoute={()=>{setSelectedRouteId(t.id);setSheetOpen(false)}}/> : (
                  <article className="tripCard" data-booking-id={t.id} key={t.id}>
                    <div className="tripTop">
                      <b>
                        #{<AppText text={t.booking_number || t.id} />} ·{<AppText text={" "} />}
                        {<AppText text={statusText[t.status] || t.status} />}
                      </b>
                      <strong>{<AppText text={t.price} />} <AppText text={"kr"} /></strong>
                    </div>
                    <DriverPickupTime trip={t}/>
                    {t.confirmed_at&&<p><AppText text={"Accepterad:"} />{<AppText text={new Date(t.confirmed_at).toLocaleString('sv-SE',{timeZone:'Europe/Stockholm'})} />}</p>}
                    {t.payment_status === "paid" && (
                      <div className="driverPaidNotice" role="status">
                        <CreditCard />
                        <div>
                          <strong><AppText text={"BETALD VIA APPEN"} /></strong>
                          <span><AppText text={"Ta inte betalt av kunden igen."} /></span>
                        </div>
                      </div>
                    )}
                    <div
                      className={
                        t.payment_status === "paid"
                          ? "paymentBadge paid"
                          : "paymentBadge"
                      }
                    >
                      <CreditCard />
                      {<AppText text={t.payment_status === "paid"
                        ? "Betald via appen"
                        : "Ej betald"} />}
                    </div>
                    <div className="tripFlow" aria-label="Körningens status">
                      <span className="done"><AppText text={"Tilldelad"} /></span>
                      <span
                        className={
                          ["en_route", "arrived", "passenger_onboard"].includes(
                            t.status,
                          )
                            ? "done"
                            : ""
                        }
                      >
                        <AppText text={"På väg"} /></span>
                      <span
                        className={
                          ["arrived", "passenger_onboard"].includes(t.status)
                            ? "done"
                            : ""
                        }
                      >
                        <AppText text={"Framme"} /></span>
                      <span
                        className={
                          t.status === "passenger_onboard" ? "done" : ""
                        }
                      >
                        <AppText text={"Kund i bilen"} /></span>
                      <span><AppText text={"Slutförd"} /></span>
                    </div>
                    <div className="routeLine">
                      <i />
                      <div>
                        <span>
                          <AppText text={"Hämta ·"} />{<AppText text={" "} />}
                          {driverPickupLabel(t)}
                        </span>
                        <b>{t.pickup}</b>
                      </div>
                    </div>
                    <div className="routeLine drop">
                      <i />
                      <div>
                        <span><AppText text={"Destination"} /></span>
                        <b>{t.destination}</b>
                      </div>
                    </div>
                    <div className="tripCustomerDetails">
                      <div>
                        <small><AppText text={"Kund"} /></small>
                        <b>{contactVisible(t)?t.customer_name||"Kundnamn saknas":<AppText text="Visas efter acceptans"/>}</b>
                      </div>
                      <div>
                        <small><AppText text={"Bokning"} /></small>
                        <b>
                          {<AppText text={t.passengers} />} <AppText text={"passagerare ·"} />{<AppText text={" "} />}
                          {<AppText text={String(t.car_type || "standard").toLocaleLowerCase(
                            "sv",
                          ) === "large"
                            ? "Storbil"
                            : "Vanlig bil"} />}
                          {<AppText text={Number(t.child_seats) > 0
                            ? ` · ${t.child_seats} barnstol${Number(t.child_seats) > 1 ? "ar" : ""}`
                            : ""} />}
                        </b>
                      </div>
                      {t.pet_details&&<p className="petTripBadge"><AppText text="Djur"/>: {petText(t.pet_details)}</p>}
                      {t.notes && (
                        <div className="tripNote">
                          <small><AppText text={"Meddelande"} /></small>
                          <b>{<AppText text={t.notes} />}</b>
                        </div>
                      )}
                    </div>
                    <button type="button" className="driverTripRoute" onClick={()=>{setSelectedRouteId(t.id);setDriverView("work");setSheetOpen(false)}}><AppText text="Visa rutt A → B"/></button>
                    <DriverFlightCard
                      notes={t.notes}
                      pickupTime={t.pickup_time}
                      pickupAddress={t.pickup}
                      destinationAddress={t.destination}
                      accessToken={session.access_token}
                    />
                    {contactVisible(t)&&<div className="tripMeta">
                      <span>
                        <UserRound />
                        {<AppText text={t.customer_phone} />}
                      </span>
                      <a href={"tel:" + t.customer_phone}>
                        <Phone />
                        <AppText text={"Ring kund"} /></a>
                    </div>}
                    {contactVisible(t)&&t.payment_status !== "paid" && (
                      <button
                        className="paymentRequestButton"
                        disabled={updating === t.id}
                        onClick={() => requestPayment(t)}
                      >
                        <Send />
                        {<AppText text={updating === t.id
                          ? "Skapar betalningslänk…"
                          : "Begär betalning"} />}
                      </button>
                    )}
                    {[
                      "offered",
                      "assigned",
                      "accepted",
                      "en_route",
                      "arrived",
                    ].includes(t.status) && (
                      <button
                        className="navigateTrip"
                        onClick={() => navigate(t)}
                      >
                        <Navigation />
                        <AppText text={"Navigera till kund"} /></button>
                    )}
                    {t.status === "passenger_onboard" && (
                      <button
                        className="navigateTrip destination"
                        onClick={() => navigate(t, true)}
                      >
                        <Navigation />
                        <AppText text={"Navigera till destination"} /></button>
                    )}
                    <div className="tripActions">
                      {["offered", "assigned"].includes(t.status) && (
                        <>
                          <button
                            disabled={updating === t.id}
                            onClick={() => void acceptTrip(t)}
                          >
                            {<AppText text={updating === t.id
                              ? "Sparar…"
                              : "Acceptera körning"} />}
                          </button>
                          <button
                            disabled={updating === t.id}
                            className="rejectTrip"
                            onClick={() => reject(t.id)}
                          >
                            <Ban />
                            <AppText text={"Tacka nej"} /></button>
                        </>
                      )}
                      {t.status === "accepted" && (
                        <button
                          disabled={updating === t.id}
                          onClick={() => status(t.id, "en_route")}
                        >
                          <Navigation />
                          {<AppText text={updating === t.id ? "Sparar…" : "På väg till kund"} />}
                        </button>
                      )}
                      {t.status === "en_route" && (
                        <button
                          disabled={updating === t.id}
                          onClick={() => status(t.id, "arrived")}
                        >
                          <MapPin />
                          {<AppText text={updating === t.id ? "Sparar…" : "Jag är framme"} />}
                        </button>
                      )}
                      {t.status === "arrived" && (
                        <button
                          disabled={updating === t.id}
                          onClick={() => status(t.id, "passenger_onboard")}
                        >
                          <Navigation />
                          {<AppText text={updating === t.id ? "Sparar…" : "Kund i bilen"} />}
                        </button>
                      )}
                      {t.status === "passenger_onboard" && (
                        <button
                          disabled={updating === t.id}
                          onClick={() => openCompletion(t)}
                        >
                          <Banknote />
                          {<AppText text={updating === t.id ? "Sparar…" : "Slutför och registrera betalning"} />}
                        </button>
                      )}
                      {["accepted", "en_route", "arrived", "passenger_onboard"].includes(
                        t.status,
                      ) && (
                        <button
                          type="button"
                          className="undoTripStatus"
                          disabled={updating === t.id}
                          onClick={() => undoStatus(t)}
                        >
                          <RotateCcw /> <AppText text={"Ångra senaste status"} /></button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>
            <details id="driver-prebookings" className="prebookingPool" open={bookingTab==="available"} hidden={bookingTab!=="available"}>
              <summary>Alla bokningar · {visiblePrebookings.length} bokningar · {visiblePrebookings.filter(t=>t.can_claim).length} lediga för dig</summary>

{hiddenIds.length>0&&<button type="button" onClick={restorePrebookings}>Visa borttagna igen</button>}
              <button type="button" onClick={()=>void load()}><AppText text={"Uppdatera listan"} /></button>
              {!visiblePrebookings.length&&<p><AppText text={"Inga bokningar att visa just nu."} /></p>}
              {visiblePrebookings.map(t=><article className="tripCard" data-booking-id={t.id} key={t.id}>
                <div className="tripTop"><b>#{<AppText text={t.booking_number} />} · {driverPickupLabel(t)}</b><strong>{<AppText text={t.price} />} <AppText text={"kr"} /></strong></div>
                <p role={t.overdue?"status":undefined} className="prebookingImportant" hidden={!t.overdue}>⚠ Hämtningstiden har passerat. Kontrollera datum och tid med trafikledningen innan du tackar ja.</p><p className={`prebookingAvailability ${t.can_claim?"isAvailable":"isAssigned"}`}>{t.availability_label}</p><div className="prebookingActions">                <button className="primary" disabled={!t.can_claim||updating===t.id} onClick={async()=>{
                  if(!confirm(`${t.overdue?'Hämtningstiden har passerat. Bekräfta först rätt tid med trafikledningen.\n\n':''}Tacka ja till bokning #${t.booking_number} den ${t.booking_date} kl. ${String(t.pickup_time).slice(0,5)}? Kontrollera restid och att bilen har rätt utrustning${t.child_seats?' och barnstolar':''}.`))return;
                  setUpdating(t.id);setMsg('');try{const r=await api('/api/driver-trips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:t.id,action:'claim_prebooking'})});const j:any=await r.json();if(!r.ok)throw Error(j.error);setMsg('Bokningen är accepterad och finns under Mina körningar.');setSelectedRouteId(null);setSheetOpen(false);await load(true);}catch(e:any){setMsg(e.message);await load(true);}finally{setUpdating(null);}
                }}>{<AppText text={updating===t.id?'Sparar…':t.can_claim?'Tacka ja':t.assigned_to_me?'Din körning':'Ej tillgänglig'} />}</button><button type="button" className="prebookingDismiss" disabled={!!updating} onClick={async()=>{if(!t.available){hidePrebooking(t.id);return;}setUpdating(t.id);try{const r=await api('/api/driver-trips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:t.id,action:'decline_booking'})});const j:any=await r.json();if(!r.ok)throw Error(j.error);setPrebookings(rows=>rows.filter(b=>b.id!==t.id));setMsg('Du har tackat nej. Bokningen är borttagen från din lista men ligger kvar för övriga förare.');await load(true);}catch(e:any){setMsg(e.message);await load(true);}finally{setUpdating(null);}}}>{t.available?'Tacka nej':'Dölj från min lista'}</button></div>
                {t.stop_address&&<p className="prebookingImportant">Stopp: {t.stop_address}</p>}{t.pet_details&&<p className="petTripBadge"><AppText text="Djur"/>: {petText(t.pet_details)}</p>}<p><b><AppText text={"Från:"} /></b> {t.pickup_address}</p><p><b><AppText text={"Till:"} /></b> {<AppText text={t.dropoff_address} />}</p>
                <p className="prebookingImportant">{<AppText text={t.passengers} />} <AppText text={"passagerare ·"} />{<AppText text={t.car_type==='large'?'Storbil':'Vanlig bil'} />} · {<AppText text={t.child_seats||0} />} <AppText text={"barnstolar ·"} />{<AppText text={t.luggage_count||0} />} <AppText text={"bagage"} /></p>

              </article>)}
            </details>

            </div></section></div>
            <div hidden={driverView !== "payments"}><StreetPayments accessToken={session.access_token} tapRequest={tapRequest} active={driverView==='payments'} /></div>
            {driverView === "history" && <><DriverHistory onChanged={load} />            <details className="driverOptional"><summary><AppText text={"Dagens inkört och dagsmål"} /></summary>
              <DriverDailyGoal key={session.user.id} owner={session.user.id} summary={summary} updatedAt={summaryUpdatedAt} />
            </details>
</>}
            {driverView === "account" && (
              <section className="driverAccountView"><button type="button" className="driverReturnMap" onClick={()=>{setSheetOpen(false);setDriverView("work")}}>← Till kartan</button><h1><AppText text="Meny"/></h1><div className="driverMoreMenu"><button onClick={()=>{if(navigationPhase){openBookings('mine');return;}setSheetOpen(false);setDriverView('work');window.setTimeout(()=>window.dispatchEvent(new Event('avenyn-open-map-settings')),100)}}>Kartinställningar</button><button onClick={()=>{setBookingTab("mine");setSheetOpen(true);setDriverView("work")}}>Mina körningar · kontakt</button><button onClick={()=>setDriverView('history')}><AppText text="Inkört och dagsmål"/></button><button onClick={()=>setDriverView('payments')}><AppText text="Ta betalt · Blipp / betallänk"/></button><button onClick={()=>{setBookingTab('available');setSheetOpen(true);setDriverView('work');window.setTimeout(()=>document.querySelector('.prebookingPool')?.setAttribute('open',''),0)}}><AppText text="Alla bokningar"/></button><a href="mailto:info@avenyntaxi.se"><AppText text="Support"/></a></div><DriverTripNotes trips={trips} api={api}/><DriverAudioSettings /><DriverPetPreference accessToken={session.access_token} onChanged={()=>void load()}/>            <details className="driverOptional driverConnectionOptions"><summary><AppText text={"GPS och notiser"} /><small>{<AppText text={gpsState === "error" || pushState === "blocked" ? "Kontrollera inställningar" : pushState !== "active" ? "Notiser ej aktiva" : "Inställningar"} />}</small></summary>
            <div
              className={`driverGpsCard ${online && nativeApp && gpsState === "active" ? "isActive" : ""}`}
              role="status"
            >
              <Navigation />
              <div>
                <strong>
                  {<AppText text={nativeApp
                    ? gpsState === "active" && online
                      ? "Bakgrunds-GPS aktiv"
                      : gpsState === "error"
                        ? "Bakgrunds-GPS behöver tillåtelse"
                        : "Bakgrunds-GPS redo"
                    : "GPS via webbläsaren"} />}
                </strong>
                <span>
                  {<AppText text={nativeApp
                    ? online && gpsState === "active"
                      ? "Positionen uppdateras även när skärmen är låst."
                      : "Gå online och välj Exakt plats samt Tillåt hela tiden."
                    : "Installera eller uppdatera Android-förarappen för GPS med låst skärm."} />}
                </span>
              </div>
              {nativeApp && gpsState === "error" && (
                <button
                  type="button"
                  onClick={() => BackgroundGeolocation.openSettings()}
                >
                  <AppText text={"Inställningar"} /></button>
              )}
            </div>
            <div className={`driverPushCard driverPushCard--${pushState}`}>
              <BellRing />
              <div>
                <strong><AppText text={"Bokningsnotiser"} /></strong>
                <span>
                  {<AppText text={pushState === "active"
                    ? "Aktiverade · fungerar även när telefonen är låst"
                    : pushState === "blocked"
                      ? "Notiser är blockerade i telefonens webbläsarinställningar"
                      : pushState === "unsupported"
                        ? "Den här webbläsaren stödjer inte pushnotiser"
                        : "Aktivera en gång på den här telefonen"} />}
                </span>
              </div>
              {!(["active", "unsupported"] as PushState[]).includes(
                pushState,
              ) && (
                <button
                  type="button"
                  disabled={pushBusy || pushState === "checking"}
                  onClick={enablePushNotifications}
                >
                  {<AppText text={pushBusy ? "Aktiverar…" : "Aktivera"} />}
                </button>
              )}
            </div>
            </details>


                <h1>{data.profile.name || "Förarkonto"}</h1>
                <p>{<AppText text={session.user.email} />}</p>
                <div className="driverAccountStatus">

                  <b><AppText text={"Godkänd förare"} /></b>
                </div>
                <DeleteAccount
                  accessToken={session.access_token}
                  kind="driver"
                  onDeleted={async () => {
                    await client.auth.signOut();
                  }}
                />
              </section>
            )}
            <nav className="driverMainTabs hasChat" aria-label="Förarappens meny">
              <button className={driverView==='work'&&!sheetOpen?'active':''} onClick={()=>{if(driverView==='work'&&!sheetOpen)toggleExpandedMap();else {setSheetOpen(false);setDriverView('work')}}}><MapPin/><span>Karta</span></button>
              <button className={driverView==='work'&&sheetOpen&&bookingTab==='available'?'active':''} onClick={()=>openBookings('available')}><BellRing/><span>Lediga <b className="driverTabCount">{visiblePrebookings.filter(t=>t.can_claim).length}</b></span></button>
              <button className={driverView==='work'&&sheetOpen&&bookingTab==='mine'?'active':''} onClick={()=>openBookings('mine')}><CalendarDays/><span>Körningar <b className="driverTabCount">{myTrips.length}</b></span></button>
              <AppChat key={session.user.id} role="driver" accessToken={session.access_token} navigationTab label="Chatt" onOpenChange={setChatOpen}/>
              <button className={driverView==='account'?'active':''} onClick={()=>setDriverView('account')}><UserRound/><span>Mer</span></button>
            </nav>
          </>
        )}
        {data?.profile && !data.profile.approved && (
          <DeleteAccount
            accessToken={session.access_token}
            kind="driver"
            onDeleted={async () => {
              await client.auth.signOut();
            }}
          />
        )}
        {msg && !gpsDisclosureOpen && <div className="toastMsg" role="status" aria-live="polite">{<AppText text={msg} />}</div>}
      </section>
      <Dialog open={gpsDisclosureOpen} onOpenChange={(open) => { if (!open) void declineGpsDisclosure(); }}>
        <DialogContent className="driverGpsDisclosure" showCloseButton={false}>
          <DialogHeader>
            <span className="driverGpsDisclosureIcon" aria-hidden="true">
              <ShieldCheck />
            </span>
            <DialogTitle><AppText text={"Bakgrundsposition när du är online"} /></DialogTitle>
            <DialogDescription>
              <AppText text={"Avenyn Taxi Förare samlar in din exakta position när du väljer att gå online – även när appen inte syns eller telefonens skärm är låst."} /></DialogDescription>
          </DialogHeader>
          <div className="driverGpsDisclosureDetails">
            <p>
              <AppText text={"Positionen används för att trafikledningen ska kunna tilldela körningar och för att kunden ska kunna följa sin tilldelade taxi."} /></p>
            <p>
              <AppText text={"Delningen stoppas när du går offline eller loggar ut. Du kan också stänga av behörigheten i telefonens inställningar."} /></p>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="driverGpsDisclosureCancel"
              onClick={declineGpsDisclosure}
            >
              <AppText text={"Inte nu"} /></button>
            <button
              type="button"
              className="driverGpsDisclosureAccept"
              onClick={acceptGpsDisclosure}
            >
              <AppText text={"Jag godkänner – fortsätt"} /></button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(completionTrip)}
        onOpenChange={(open) => {
          if (!open && !updating) setCompletionTrip(null);
        }}
      >
        <DialogContent overlayClassName="driverPaymentOverlay" className="driverCompletionDialog">
          <DialogHeader>
            <DialogTitle><AppText text={"Slutför körningen"} /></DialogTitle>
            <DialogDescription>
              <AppText text={"Registrera slutbelopp och hur kunden betalade. Uppgifterna visas sedan under ditt namn i Admin."} /></DialogDescription>
          </DialogHeader>
          {completionTrip?.payment_status === "paid" && (
            <div className="driverCompletionPrepaid">
              <CreditCard />
              <div>
                <b><AppText text={"Redan betald via appen"} /></b>
                <span><AppText text={"Belopp och betalstatus hämtas från onlinebetalningen."} /></span>
              </div>
            </div>
          )}
          <div className="driverCompletionFields">
            <label>
              <span><AppText text={"Slutbelopp (kr)"} /></span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100000"
                step="1"
                value={completionAmount}
                disabled={completionTrip?.payment_status === "paid"}
                onChange={(event) => setCompletionAmount(event.target.value)}
              />
            </label>
            <label>
              <span><AppText text={"Betalsätt"} /></span>
              <select
                value={completionMethod}
                disabled={completionTrip?.payment_status === "paid"}
                onChange={(event) => setCompletionMethod(event.target.value)}
              >
                {completionTrip?.payment_status === "paid" && (
                  <option value="app"><AppText text={"Betald via appen"} /></option>
                )}
                <option value="card"><AppText text={"Kort i bilen"} /></option>
                <option value="blipp"><AppText text={"Blipp"} /></option>
                <option value="swish"><AppText text={"Swish"} /></option>
                <option value="paypal"><AppText text={"PayPal"} /></option>
                <option value="cash"><AppText text={"Kontant"} /></option>
                <option value="invoice"><AppText text={"Faktura"} /></option>
                <option value="other"><AppText text={"Annat"} /></option>
              </select>
            </label>
            {completionTrip?.payment_status !== "paid" && (
              <label className="driverCompletionPaid">
                <input
                  type="checkbox"
                  checked={completionPaid}
                  onChange={(event) => setCompletionPaid(event.target.checked)}
                />
                <span><AppText text={"Betalningen är mottagen"} /></span>
              </label>
            )}
            {completionMethod === "other" && (
              <label>
                <span><AppText text={"Beskriv betalsättet"} /></span>
                <input
                  value={completionNote}
                  maxLength={200}
                  onChange={(event) => setCompletionNote(event.target.value)}
                  placeholder="Exempel: hotellvoucher"
                />
              </label>
            )}
          </div>
          {completionError && (
            <div className="driverCompletionError" role="alert">
              {<AppText text={completionError} />}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              className="driverGpsDisclosureCancel"
              disabled={Boolean(updating)}
              onClick={() => setCompletionTrip(null)}
            >
              <AppText text={"Avbryt"} /></button>
            <button
              type="button"
              className="driverGpsDisclosureAccept"
              disabled={Boolean(updating)}
              onClick={completeTrip}
            >
              {<AppText text={updating ? "Sparar…" : "Bekräfta och slutför"} />}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function DriverClient() {return <AppLanguage kind="driver" picker={true}><DriverClientContent/></AppLanguage>}
