import { adminSupabase } from "./supabase-server";
import { retrieveCheckoutSession } from "./stripe";

let lastSyncAt = 0;
let activeSync: Promise<number> | null = null;

export async function syncPendingStripePayments(bookingIds?: string[]) {
  // An explicitly empty driver scope must never become a global payment scan.
  if (bookingIds && !bookingIds.some(Boolean)) return 0;
  const now = Date.now();
  if (activeSync) return activeSync;
  if (now - lastSyncAt < 12_000) return 0;
  lastSyncAt = now;

  activeSync = (async () => {
    try {
      const admin = adminSupabase();
      let query = admin
        .from("payment_requests")
        .select("id,booking_id,stripe_checkout_session_id")
        .eq("status", "pending")
        .not("stripe_checkout_session_id", "is", null)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      const uniqueBookingIds = [...new Set((bookingIds || []).filter(Boolean))];
      if (uniqueBookingIds.length) query = query.in("booking_id", uniqueBookingIds);
      const { data, error } = await query;
      if (error) throw error;

      let updated = 0;
      for (const payment of data || []) {
        try {
          const session = await retrieveCheckoutSession(
            String(payment.stripe_checkout_session_id),
          );
          if (session.payment_status === "paid") {
            const paidAt = new Date().toISOString();
            const requestUpdate = await admin
              .from("payment_requests")
              .update({
                status: "paid",
                paid_at: paidAt,
                stripe_payment_intent_id: session.payment_intent || null,
                updated_at: paidAt,
              })
              .eq("id", payment.id)
              .eq("status", "pending");
            if (requestUpdate.error) throw requestUpdate.error;
            const bookingUpdate = await admin
              .from("bookings")
              .update({
                payment_status: "paid",
                payment_method: "Stripe",
                updated_at: paidAt,
              })
              .eq("id", payment.booking_id);
            if (bookingUpdate.error) throw bookingUpdate.error;
            updated += 1;
          } else if (session.status === "expired") {
            await admin
              .from("payment_requests")
              .update({ status: "expired", updated_at: new Date().toISOString() })
              .eq("id", payment.id)
              .eq("status", "pending");
          }
        } catch (error) {
          console.error("payment_reconciliation_item_failed", {
            paymentRequestId: payment.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return updated;
    } catch (error) {
      console.error(
        "payment_reconciliation_failed",
        error instanceof Error ? error.message : error,
      );
      return 0;
    } finally {
      activeSync = null;
    }
  })();

  return activeSync;
}
