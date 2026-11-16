import type { MetadataRoute } from "next";
import { publicSeoPaths, SEO_ORIGIN } from "@/lib/seo-routing";

import {regionalSeoSlugs} from "@/lib/seo-areas";

const updated = new Date("2026-09-26T00:00:00.000Z");
const pageDates: Record<string, Date> = {
  "/taxitjanster-goteborg": new Date("2026-10-12T16:00:00.000Z"),
  "/en/services": new Date("2026-10-12T16:00:00.000Z"),
  "/bud-goteborg": new Date("2026-10-12T15:35:00.000Z"),
  "/": new Date("2026-10-12T16:00:00.000Z"),
  "/foretagstaxi-goteborg": new Date("2026-10-12T14:45:00.000Z"),
  "/taxi-goteborg": new Date("2026-10-11T14:00:00.000Z"),
  "/taxi-landvetter": new Date("2026-10-11T14:00:00.000Z"),
  "/integritet": new Date("2026-10-07T20:15:00.000Z"),
  "/bokningsvillkor": new Date("2026-10-07T20:15:00.000Z"),
};
for (const path of ["priser-omraden", "om-avenyn-taxi", "bli-akeripartner", "taxi-marstrand", "taxi-henan", "taxi-vastkusten", "taxi-goteborg-smogen"]) {
  pageDates[`/${path}`] = new Date("2026-09-30T23:00:00.000Z");
}

for (const slug of ["taxi-omraden", "taxi-goteborg", "taxi-landvetter", "taxi-vastra-gotaland", ...regionalSeoSlugs]) pageDates[`/${slug}`] = new Date("2026-10-11T14:00:00.000Z");

for (const slug of ['', 'taxi-centrum', 'taxi-avenyn', 'taxi-goteborg-central', 'taxi-landvetter', 'taxi-omraden']) pageDates[`/${slug}`] = new Date("2026-10-13T16:20:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [...new Set(publicSeoPaths)].map(path => ({
    url: `${SEO_ORIGIN}${path}`,
    lastModified: pageDates[path] ?? updated,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : ["/taxi-goteborg", "/taxi-landvetter"].includes(path) ? .9 : .7,
  }));
}
