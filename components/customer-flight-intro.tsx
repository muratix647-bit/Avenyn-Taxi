"use client";

import {useEffect, useRef, useState} from "react";

/** A single taxi-and-road image, with a five-second introduction. */
export default function CustomerFlightIntro({onFinish}: {onFinish: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const photo = useRef<HTMLImageElement>(null);
  const finish = useRef(onFinish);
  finish.current = onFinish;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    const checkImage = () => {
      if (photo.current?.complete && photo.current.naturalWidth > 0) setReady(true);
    };
    checkImage();
    const loadCheck = window.setInterval(checkImage, 200);
    // Slow or failed loading must not block booking.
    const safetyTimer = window.setTimeout(() => finish.current(), 8000);
    return () => { window.clearTimeout(safetyTimer); window.clearInterval(loadCheck); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => finish.current(), 5000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  return <dialog ref={dialog} className={`customerTaxiIntro ${ready ? "isReady" : ""}`}
    aria-label="Välkommen till Avenyn Taxi" onCancel={() => finish.current()}>
    <div className="customerTaxiBrand">
      <img src="/avenyn-logo-optimized.webp" alt="Avenyn Taxi" width="100" height="100"/>
      <p>Din resa börjar här</p>
    </div>
    <div className="customerTaxiScene">
      <img ref={photo} src="/customer-start-taxi-night.jpg" alt="En svart Mercedes med Avenyn Taxi-loggan på en kvällsbelyst väg i Göteborg" fetchPriority="high"
        onLoad={() => setReady(true)} onError={() => finish.current()}/>
    </div>
    <button type="button" className="customerTaxiSkip" autoFocus onClick={() => finish.current()}>Hoppa över →</button>
  </dialog>;
}
