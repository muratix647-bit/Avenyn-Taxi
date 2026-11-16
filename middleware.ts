import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { legacyPublicResponse } from "./lib/legacy-public-urls";

export function middleware(request: NextRequest) {
  return legacyPublicResponse(request) ?? NextResponse.next();
}
