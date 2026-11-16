import { legacySeoTarget, permanentSeoRedirect } from "@/lib/seo-routing";
export async function GET(request: Request, {params}: {params: Promise<{legacy:string}>}) {
  const {legacy} = await params;
  const target = legacySeoTarget(legacy);
  return target ? permanentSeoRedirect(request, target) : new Response("Not found", {status:404});
}
