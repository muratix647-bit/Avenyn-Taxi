import { adminSupabase } from "@/lib/supabase-server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const invalid = new URL("/driver?invite=invalid", request.url);
  if (!/^[A-Za-z0-9_-]{20,32}$/.test(code))
    return Response.redirect(invalid, 302);

  const { data, error } = await adminSupabase()
    .from("driver_invite_links")
    .select("token_hash,verification_type,expires_at")
    .eq("code", code)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (
    error ||
    !data ||
    !["invite", "recovery"].includes(data.verification_type)
  )
    return Response.redirect(invalid, 302);

  const destination = new URL("/driver", request.url);
  destination.searchParams.set("setup", "password");
  destination.searchParams.set("token_hash", data.token_hash);
  destination.searchParams.set("type", data.verification_type);
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
