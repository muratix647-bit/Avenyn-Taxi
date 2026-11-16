import { legacySeoTarget, SEO_ORIGIN } from "./seo-routing";

const oldPages: Record<string, string> = {
  "/en": "/", "/home": "/", "/pages": "/",
  "/pricing": "/priser-omraden",
  "/about": "/om-avenyn-taxi", "/contact": "/om-avenyn-taxi",
  "/services": "/taxitjanster-goteborg",
  "/fleet": "/om-avenyn-taxi#bilar", "/privacy": "/integritet",
};
const oldTaxiPages: Record<string, string> = {
  "foretagstaxi-goteborg": "/foretagstaxi-goteborg",
  "fast-pris-taxi-landvetter": "/taxi-landvetter",
  "flygtaxi-goteborg": "/taxi-landvetter",
};

/** Historical public URLs only; never redirects APIs, account sessions or unknown pages. */
export function legacyPublicResponse(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const original = new URL(request.url);
  let pathname: string;
  try { pathname = decodeURIComponent(original.pathname).replace(/\/+$/, "") || "/"; }
  catch { return null; }
  if (["/cdn-cgi/l/email-protection", "/Muratix647@gmail.com"].includes(pathname)) {
    return new Response(request.method === "HEAD" ? null : "Den gamla adressen har tagits bort. Kontakta oss på https://www.avenyntaxi.se/om-avenyn-taxi", {
      status:410, headers:{"Content-Type":"text/plain; charset=utf-8","X-Robots-Tag":"noindex","Cache-Control":"public, max-age=3600"},
    });
  }
  if (pathname === "/en/services") return null;
  const english = pathname === "/en" || pathname.startsWith("/en/");
  const path = pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
  let target = oldPages[path];
  if (!target && path.startsWith("/taxi/")) {
    const slug = path.slice(6);
    target = oldTaxiPages[slug] || (english ? legacySeoTarget(slug) ?? undefined : undefined);
  }
  // Old renderer keys such as taxi-frolunda:1k1k0bf are not page names.
  const keyedSlug = path.match(/^\/(taxi-[a-z0-9-]+):[a-z0-9]+$/i);
  if (!target && keyedSlug) target = legacySeoTarget(keyedSlug[1]) ?? undefined;
  if (!target) return null;
  const destination = new URL(target, SEO_ORIGIN);
  destination.search = original.search;
  if (english && ["/", "/om-avenyn-taxi", "/priser-omraden"].includes(destination.pathname)) destination.searchParams.set("lang", "en-US");
  if (destination.pathname === "/" && destination.searchParams.has("area")) {
    const area = destination.searchParams.get("area")?.trim();
    if (area && !destination.searchParams.has("pickup")) destination.searchParams.set("pickup", area);
    destination.searchParams.delete("area");
    destination.hash = "booking-form";
  }
  return new Response(null, {status:301,headers:{Location:destination.toString()}});
}
