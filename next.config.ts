import type { NextConfig } from "next";
import { publicSeoPaths, seoAliases, SEO_ORIGIN } from "./lib/seo-routing";

const nextConfig: NextConfig = {
  trailingSlash: false,
  async redirects() { return [
    {source: "/favicon.svg", destination: `${SEO_ORIGIN}/icon-192.png`, statusCode: 301 as const},
    // Legacy paths go straight to the canonical page, without an intermediate hop.
    ...Object.entries(seoAliases).map(([source, target]) => ({
      source: `/${source}`, destination: `${SEO_ORIGIN}/${target}`, statusCode: 301 as const,
    })),
    // Consolidate public information pages only; app sessions and APIs keep their origin.
    ...publicSeoPaths.map(path => ({
      source: path, has: [{type:"host" as const,value:"avenyntaxi.se"}],
      destination: `${SEO_ORIGIN}${path}`, statusCode: 301 as const,
    })),
    ...["www.avenyntaxi.com", "avenyntaxi.com"].map(host => ({
      source:"/:path*", has:[{type:"host" as const,value:host}],
      destination:`${SEO_ORIGIN}/:path*`, statusCode: 301 as const,
    })),
  ]; },
};
export default nextConfig;
