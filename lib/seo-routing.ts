import { seoPages, seoPageMap } from "./seo-pages";

export const SEO_ORIGIN = "https://www.avenyntaxi.se";
export const seoAliases: Record<string, string> = {
  "taxibud-goteborg": "bud-goteborg",
  "taxi-bud-goteborg": "bud-goteborg",
  "budtransport-goteborg": "bud-goteborg",
  "taxi-goteborg-landvetter": "taxi-landvetter",
  "taxi-molndal-landvetter": "taxi-molndal",
  "taxi-kungsbacka": "taxi-goteborg-kungsbacka",
  "taxi-tjorn": "taxi-goteborg-tjorn",
  "taxi-smogen": "taxi-goteborg-smogen",
  "taxi-stenungsund": "taxi-goteborg-stenungsund",
  "taxi-varberg": "taxi-goteborg-varberg",
  "taxi-orust": "taxi-henan",
};

export const publicSeoPaths = [
  "/", "/integritet", "/bokningsvillkor", "/priser-omraden",
  "/taxi-omraden", "/taxitjanster-goteborg", "/en/services", "/om-avenyn-taxi", "/bli-akeripartner",
  ...seoPages.map(page => `/${page.slug}`),
];

/** Only redirect to a real, equivalent page. Unknown addresses remain 404. */
export function legacySeoTarget(slug: string): string | null {
  const target = seoAliases[slug] ?? slug;
  return seoPageMap.has(target) ? `/${target}` : null;
}

export function landvetterAreaTarget(area: string): string | null {
  if (area === "goteborg") return "/taxi-landvetter";
  return legacySeoTarget(`taxi-${area}`);
}

export function permanentSeoRedirect(request: Request, target: string): Response {
  const url = new URL(target, SEO_ORIGIN);
  url.search = new URL(request.url).search;
  return new Response(null, {status:301, headers:{Location:url.toString()}});
}
