"use client";

import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Play, X} from "lucide-react";
import {AppText} from "@/components/app-language";

export default function BookingVideoGuide() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);
  return <>
    <button type="button" className="bookingVideoTrigger" onClick={() => setOpen(true)}>
      <Play size={17} aria-hidden="true"/>
      <AppText text="Så bokar du · 10 sekunder"/>
    </button>
    {open && createPortal(<dialog ref={dialog} className="bookingVideoDialog"
      aria-labelledby="booking-video-title" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header><h2 id="booking-video-title">Så bokar du med Avenyn Taxi</h2>
        <button type="button" autoFocus aria-label="Stäng videoguiden" onClick={() => setOpen(false)}><X/></button>
      </header>
      <video controls playsInline preload="metadata" poster="/booking-guide-poster.jpg" aria-label="10 sekunders bokningsguide på svenska">
        <source src="/avenyn-bokningsguide-10s.mp4" type="video/mp4"/>
        Din webbläsare kan inte spela videon.
      </video>
      <p>Välj hämtning och destination. Välj Åk nu eller Förboka. Under Tillval kan du välja exempelvis barnstol eller storbil. Fortsätt till kontaktuppgifter, kontrollera resan och priset och bekräfta bokningen.</p>
    </dialog>, document.body)}
  </>;
}
