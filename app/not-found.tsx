import Link from "next/link";
import {ArrowLeft,Phone} from "lucide-react";
export default function NotFound(){return <main className="notFound"><section><img src="/avenyn-logo-optimized.webp" width="88" height="88" alt="Avenyn Taxi"/><small>404 · SIDAN FINNS INTE</small><h1>Vi hittar inte sidan</h1><p>Adressen kan vara fel eller sidan kan ha flyttats. Du kan gå tillbaka till Avenyn Taxi och boka din resa där.</p><div><Link href="/"><ArrowLeft/>Till startsidan</Link><a href="tel:+46700315315"><Phone/>Ring oss</a></div></section></main>}
