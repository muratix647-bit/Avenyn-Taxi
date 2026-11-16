"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, RotateCcw } from "lucide-react";
import styles from "./welcome-film.module.css";

const scenes = [
  { file: "avenyn", title: "Avenyn", line: "Mitt i Göteborg." },
  { file: "liseberg", title: "Liseberg", line: "På väg till nya minnen." },
  { file: "centralen", title: "Centralstationen", line: "Här börjar nästa resa." },
  { file: "karlatornet", title: "Karlatornet", line: "Staden med nya perspektiv." },
  { file: "marstrand", title: "Marstrand", line: "Hamnen och utsikten från Carlsten." },
  { file: "orust", title: "Orust", line: "Mollösund – fiskeläge vid havet." },
  { file: "kladesholmen", title: "Klädesholmen", line: "Öliv, sjöbodar och havsutsikt." },
  { file: "tjorn", title: "Tjörn", line: "Tjörnbron – vägen till ön." },
  { file: "henan", title: "Henån", line: "Promenera längs ån på Orust." },
  { file: "smogen", title: "Smögen", line: "Smögenbryggan i kvällsljus." },
  { file: "kungsbacka", title: "Kungsbacka", line: "Upptäck stadens torg." },
  { file: "asa", title: "Åsa", line: "Strandliv och hav i Halland." },
  { file: "vastkusten", title: "Västkusten", line: "Bohusläns klippor och öppna hav." },
  { file: "boras", title: "Borås", line: "Upptäck staden vid Viskan." },
  { file: "planes", title: "Ut i världen", line: "Vi tar dig en bit på vägen." },
];

export default function WelcomeFilm({ onContinue }: { onContinue?: () => void }) {
  const [scene, setScene] = useState(0);
  const [paused, setPaused] = useState(true);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState("");
  const [loadVideo, setLoadVideo] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const item = scenes[scene];
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const savedData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!reduced.matches && !savedData) { setLoadVideo(true); setPaused(false); }
    const stop = () => { if (reduced.matches) setPaused(true); };
    const hide = () => { if (document.hidden) setPaused(true); };
    reduced.addEventListener("change", stop);
    document.addEventListener("visibilitychange", hide);
    return () => { reduced.removeEventListener("change", stop); document.removeEventListener("visibilitychange", hide); };
  }, []);
  useEffect(() => {
    const current = video.current;
    if (!current) return;
    if (paused) current.pause();
    else current.play().catch(() => setPaused(true));
  }, [scene, paused, loadVideo]);
  useEffect(() => {
    const element = dialog.current;
    if (onContinue && element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [Boolean(onContinue)]);
  const replay = () => {
    setError(""); setLoadVideo(true); setEnded(false); setScene(0); setPaused(false);
    if (video.current) video.current.currentTime = 0;
  };
  const body = <section className={styles.film} aria-label="Välkommen till Avenyn Taxi">
    <header className={styles.header}>
      <img src="/avenyn-logo-optimized.webp" width="58" height="58" alt="Avenyn Taxi" />
      <span>GÖTEBORG · SEDAN 2003</span>
      {onContinue && <button type="button" onClick={onContinue} className={styles.skip}>Hoppa över</button>}
    </header>
    <div className={styles.cinema}>
      <img className={styles.poster} src={`/welcome/${item.file}.webp`} alt={item.file === "planes" ? "Två passagerarflygplan vid en flygplats i solnedgång" : item.title + " – " + item.line} width="1280" height="720" />
      {loadVideo && <video key={item.file} ref={video} className={styles.video} muted playsInline preload="auto" poster={`/welcome/${item.file}.webp`} aria-label={`Välkomstfilm · ${item.title}`} onEnded={() => {
        if (scene < scenes.length - 1) setScene(scene + 1);
        else { setEnded(true); setPaused(true); }
      }} onError={() => { setPaused(true); setError("Filmen kunde inte spelas. Du kan fortsätta till bokningen direkt."); }}>
        <source src={`/welcome/${item.file}.mp4`} type="video/mp4" />
      </video>}
      <div className={styles.caption}><span>{item.title}</span><strong>{item.line}</strong></div>
      <div className={styles.playback}>
        <button type="button" onClick={() => { if (ended) replay(); else { setLoadVideo(true); setPaused(!paused); } }} aria-label={ended ? "Spela välkomstfilmen igen" : paused ? "Spela välkomstfilmen" : "Pausa välkomstfilmen"}>{ended ? <RotateCcw/> : paused ? <Play/> : <Pause/>}</button>
      </div>
    </div>
    <div className={styles.progress} aria-label={`Scen ${scene + 1} av ${scenes.length}`}>{scenes.map((s, i) => <button type="button" key={s.file} className={i <= scene ? styles.reached : ""} aria-label={`Visa ${s.title}`} aria-current={i === scene ? "step" : undefined} onClick={() => { setScene(i); setEnded(false); setError(""); }} />)}</div>
    <div className={styles.content}>
      <p className={styles.eyebrow}>DIN RESA BÖRJAR HÄR</p>
      <h1>Göteborg & Västkusten.</h1><p className={styles.question}>Vart vill du åka?</p>
      {onContinue ? <button type="button" className={styles.book} onClick={onContinue}>Boka din resa <ArrowRight/></button> : <a className={styles.book} href="/?skipWelcome=1#booking-form">Boka din resa <ArrowRight/></a>}
      {error && <p role="status" className={styles.note}>{error}</p>}
      <div className={styles.footer}><button type="button" onClick={replay}>Spela igen</button><a href="/valkommen/kallor" target="_blank" rel="noreferrer">Foto och film</a></div>
    </div>
  </section>;
  return onContinue ? <dialog className={styles.dialog} ref={dialog} onCancel={e => { e.preventDefault(); onContinue(); }} aria-label="Välkommen till Avenyn Taxi">{body}</dialog> : <main className={styles.page}>{body}</main>;
}
