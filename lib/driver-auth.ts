import { sendDriverAccountEmail } from "@/lib/email";
import { sendDriverAccountSms } from "@/lib/sms";
import { adminSupabase } from "@/lib/supabase-server";

const DRIVER_SETUP_URL = "https://avenyntaxi.se/driver?setup=password";
const DRIVER_APP_URL = "https://avenyntaxi.se/forarapp";

async function firstPartyDriverSetupUrl(
  admin: ReturnType<typeof adminSupabase>,
  driverId: string,
  properties: {
  hashed_token: string;
  verification_type: string;
  },
) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    const { error } = await admin.from("driver_invite_links").insert({
      code,
      driver_id: driverId,
      token_hash: properties.hashed_token,
      verification_type: properties.verification_type,
      expires_at: expiresAt,
    });
    if (!error) return `https://avenyntaxi.se/forare/${code}`;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Den personliga förarlänken kunde inte skapas.");
}

type DriverIdentity = {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
};

export async function sendDriverAccountInvite(
  driver: DriverIdentity,
  delivery: "email" | "sms" = "email",
) {
  const admin = adminSupabase();
  const email = String(driver.email || "").trim().toLowerCase();
  const fullName = String(driver.full_name || "Förare").trim() || "Förare";
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new Error("Föraren måste ha en giltig e-postadress.");

  let existingAccount = false;
  let link = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: DRIVER_SETUP_URL,
      data: { full_name: fullName, account_type: "driver" },
    },
  });

  if (link.error) {
    existingAccount = true;
    link = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: DRIVER_SETUP_URL },
    });
  }

  if (
    link.error ||
    !link.data?.properties?.hashed_token ||
    !link.data?.properties?.verification_type ||
    !link.data?.user?.id
  )
    throw new Error(
      link.error?.message || "Inbjudningslänken kunde inte skapas.",
    );

  const actionUrl = await firstPartyDriverSetupUrl(
    admin,
    driver.id,
    link.data.properties,
  );

  const { error: linkError } = await admin
    .from("drivers")
    .update({
      auth_user_id: link.data.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", driver.id)
    .eq("email", email)
    .is("archived_at", null);
  if (linkError) throw linkError;

  const sent =
    delivery === "sms"
      ? await sendDriverAccountSms(driver, actionUrl, DRIVER_APP_URL)
      : await sendDriverAccountEmail({
          name: fullName,
          email,
          actionUrl,
          existingAccount,
        });
  if (!sent.accepted)
    throw new Error(
      delivery === "sms"
        ? sent.reason === "invalid_phone"
          ? "Föraren måste ha ett giltigt mobilnummer för SMS."
          : "Kontot skapades men SMS-inbjudan kunde inte skickas."
        : "Kontot skapades men inbjudningsmejlet kunde inte skickas.",
    );

  return {
    sent: true,
    delivery,
    existingAccount,
    authUserId: link.data.user.id,
  };
}
