import { landvetterAreaTarget, permanentSeoRedirect } from "@/lib/seo-routing";
export async function GET(request: Request, {params}: {params: Promise<{ort:string}>}) {
  const {ort} = await params;
  const target = landvetterAreaTarget(ort);
  return target ? permanentSeoRedirect(request, target) : new Response("Not found", {status:404});
}
