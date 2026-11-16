"use client";
import {useState} from "react";
import styles from "./gothenburg-cinema.module.css";

export default function GothenburgCinema() {
  const [playing,setPlaying]=useState(false);
  return <section className={styles.cinema} aria-labelledby="gothenburg-film-title">
    <header className={styles.heading}><div><small>AVENYN TAXI · GÖTEBORG</small><h2 id="gothenburg-film-title">Upptäck vår stad</h2><p>En filmguide till Göteborgs sevärdheter.</p></div><img src="/avenyn-logo-optimized.webp" alt="Avenyn Taxi" width="64" height="64" loading="lazy"/></header>
    <div className={styles.screen}>
      {playing ? <iframe src="https://www.youtube-nocookie.com/embed/Z3BTmwlulC4?autoplay=1&playsinline=1&rel=0&hl=sv" title="Top 10 Best Things to Do in Gothenburg, Sweden – Göteborgs filmguide" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/> : <button type="button" className={styles.play} onClick={()=>setPlaying(true)} aria-label="Spela Göteborgs filmguide från YouTube"><span className={styles.playIcon} aria-hidden="true">▶</span><strong>Se filmen om Göteborg</strong><span>Spela via YouTube · ljud och helskärm finns i spelaren</span></button>}
    </div>
    <footer className={styles.footer}><span>Göteborg Travel Guide · YouTube</span><a href="https://www.youtube.com/watch?v=Z3BTmwlulC4" target="_blank" rel="noopener noreferrer">Öppna på YouTube ↗</a></footer>
  </section>;
}
