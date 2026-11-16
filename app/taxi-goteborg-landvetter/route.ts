import { permanentSeoRedirect } from "@/lib/seo-routing";
export function GET(request: Request) {
  return permanentSeoRedirect(request, "/taxi-landvetter");
}
