import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.100.1";

const ORGANIZATION = "5565974796";
const BUCKET = "economy-receipts";
const CATEGORIES = new Set(["Drivmedel", "Reparation", "Tvätt", "Däck", "Förbrukningsmaterial", "Försäkring", "Leasing", "Övrigt"]);
const ACCOUNTS = new Set(["5611", "5613", "5460"]);
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8"
};
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceKey) throw new Error("missing_supabase_configuration");
const db = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const send = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: HEADERS });
const fail = (reason: string, status = 400) => send({ ok: false, error: reason }, status);
function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function intVal(v: unknown, label: string, max = 100000000): number {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw Error("invalid_" + label);
  return n;
}
function validDate(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw Error("invalid_date");
  const d = new Date(v + "T12:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw Error("invalid_date");
  return v;
}
function parseOre(v: string): number | null {
  const t = v.replace(/(?:kr|sek|:-)/gi, "").replace(/\s/g, "").trim();
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const sep = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
  const dec = sep >= 0 && /^\d{1,2}$/.test(t.slice(sep + 1));
  const whole = Number((dec ? t.slice(0, sep) : t).replace(/[.,]/g, ""));
  const pennies = dec ? Number(t.slice(sep + 1).padEnd(2, "0")) : 0;
  const n = whole * 100 + pennies;
  return Number.isSafeInteger(n) && n > 0 && n <= 100000000 ? n : null;
}
function parseReceiptText(text: string) {
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 250);
  let amount: number | null = null, vat: number | null = null, date: string | null = null;
  for (const line of lines) {
    const ymd = line.match(/\b(20\d\d)[\/.-](\d{1,2})[\/.-](\d{1,2})\b/);
    const dmy = line.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d\d)\b/);
    if (!date && (ymd || dmy)) {
      const bits = ymd ? [ymd[1], ymd[2], ymd[3]] : [dmy![3], dmy![2], dmy![1]];
      try { date = validDate(bits[0] + "-" + bits[1].padStart(2,"0") + "-" + bits[2].padStart(2,"0")); }
      catch { /* best effort only */ }
    }
    if (/(summa|att betala|totalt|totalbelopp|^total\b|kortköp)/i.test(line)) {
      const matches = line.match(/\d[\d .,]*\d|\d/g) ?? [];
      const n = matches.at(-1);
      if (n) amount = parseOre(n) ?? amount;
    }
    if (/(varav moms|\bmoms\b|mervärdesskatt|\bvat\b)/i.test(line)) {
      const matches = line.replace(/\b(?:6|12|25)\s*%/g, "").match(/\d[\d .,]*\d|\d/g) ?? [];
      const n = matches.at(-1);
      if (n) vat = parseOre(n) ?? vat;
    }
  }
  const lc = text.toLowerCase();
  const tags = [
    /(diesel|bensin|drivmedel|laddning|kwh)/.test(lc) ? "Drivmedel" : null,
    /(biltvätt|bilvård|tvätt)/.test(lc) ? "Tvätt" : null,
    /(service|verkstad|reparation)/.test(lc) ? "Reparation" : null,
    /(däck|tyre)/.test(lc) ? "Däck" : null,
    /(spolarvätska|förbrukningsmaterial)/.test(lc) ? "Förbrukningsmaterial" : null
  ].filter(Boolean);
  const first = lines.slice(0, 4).find((x) => x.length > 2 && x.length < 100 &&
    !/^(kvitto|receipt|faktura|datum|date)/i.test(x));
  return { supplier: first ?? "", expense_date: date, amount_ore: amount,
    vat_ore: amount !== null && vat !== null && vat <= amount ? vat : null,
    category: tags.length === 1 ? tags[0] : "Övrigt",
    review_required: true };
}
function checkedFile(v: FormDataEntryValue | null): File {
  if (!(v instanceof File)) throw Error("missing_file");
  if (!v.size || v.size > 10 * 1024 * 1024) throw Error("invalid_file_size");
  if (!["image/jpeg", "image/png", "application/pdf"].includes(v.type)) throw Error("unsupported_file_type");
  return v;
}
async function bytesOf(file: File): Promise<Uint8Array> {
  const b = new Uint8Array(await file.arrayBuffer());
  const pdf = b.length >= 5 && new TextDecoder().decode(b.subarray(0,5)) === "%PDF-";
  const png = b.length >= 8 && [137,80,78,71,13,10,26,10].every((x,i) => b[i] === x);
  const jpg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (!(file.type === "application/pdf" && pdf || file.type === "image/png" && png ||
    file.type === "image/jpeg" && jpg)) throw Error("file_signature_mismatch");
  return b;
}
async function hashFile(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function recognize(file: File, bytes: Uint8Array) {
  const key = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");
  if (file.type === "application/pdf") {
    return { status: "manual", text: "", reason: "pdf_ocr_not_configured" };
  }
  if (!key) return { status: "manual", text: "", reason: "image_ocr_not_configured" };
  if (file.size > 5 * 1024 * 1024) return { status: "manual", text: "", reason: "image_too_large_for_ocr" };
  const blocks: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768) blocks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  const response = await fetch("https://vision.googleapis.com/v1/images:annotate?key=" + encodeURIComponent(key), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ image: { content: btoa(blocks.join("")) },
      features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
      imageContext: { languageHints: ["sv", "en"] } }] }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) return { status: "error", text: "", reason: "ocr_failed" };
  const data = await response.json();
  if (data.responses?.[0]?.error) return { status: "error", text: "", reason: "ocr_failed" };
  return { status: "recognized", text: String(data.responses?.[0]?.fullTextAnnotation?.text ?? "").slice(0,15000) };
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return fail("login_required", 401);
  const { data: auth, error: authError } = await db.auth.getUser(jwt);
  const actor = auth.user?.id;
  if (authError || !isUuid(actor)) return fail("login_required", 401);
  const { data: admin, error: adminError } = await db.from("dispatch_admins")
    .select("id").eq("auth_user_id",actor).eq("role","admin").eq("active",true).maybeSingle();
  if (adminError || !admin) return fail("admin_access_required", 403);

  const multipart = (req.headers.get("content-type") ?? "").startsWith("multipart/form-data");
  const form = multipart ? await req.formData().catch(() => null) : null;
  const payload: Record<string, unknown> = multipart ? Object.fromEntries(
    Array.from(form?.entries() ?? []).filter(([,v]) => typeof v === "string")
  ) : await req.json().catch(() => ({}));
  const action = String(payload.action ?? "");
  try {
    if (action === "health") return send({ ok: true, admin: true,
      image_ocr_configured: Boolean(Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY")), pdf_ocr_configured: false });
    if (action === "analyze") {
      const file = checkedFile(form?.get("file") ?? null);
      const ocr = await recognize(file, await bytesOf(file));
      const parsed = parseReceiptText(ocr.text);
      let suggestion: unknown = null;
      if (parsed.amount_ore !== null) {
        const { data } = await db.rpc("finance_receipt_vat_suggestion", {
          p_amount_ore: parsed.amount_ore, p_document_vat_ore: parsed.vat_ore ?? 0,
          p_category: parsed.category
        });
        suggestion = data;
      }
      return send({ ok: true, status: ocr.status, reason: ocr.reason ?? null,
        text: ocr.text, parsed, suggestion });
    }
    if (action === "upload") {
      const file = checkedFile(form?.get("file") ?? null);
      const bytes = await bytesOf(file);
      const digest = await hashFile(bytes);
      const { data: prev, error: prevError } = await db.from("economy_receipts")
        .select("id").eq("file_sha256",digest).maybeSingle();
      if (prevError) return fail("duplicate_check_failed",500);
      if (prev) return send({ ok:false, error:"duplicate_file", receipt_id:prev.id },409);
      const expenseDate = validDate(payload.expense_date);
      const supplier = String(payload.supplier ?? "").trim().slice(0,160);
      const category = String(payload.category ?? "");
      const amount = intVal(payload.amount_ore,"amount");
      const vat = intVal(payload.vat_ore,"vat");
      const deductible = intVal(payload.deductible_vat_ore,"deductible_vat");
      if (!supplier) throw Error("supplier_required");
      if (!CATEGORIES.has(category)) throw Error("invalid_category");
      if (!amount || vat > amount || deductible > vat) throw Error("invalid_vat");
      if (payload.confirmed !== "true") throw Error("manual_review_required");
      const id = crypto.randomUUID();
      const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
      const path = "admin/" + id + "." + ext;
      const { error: uploadError } = await db.storage.from(BUCKET)
        .upload(path,bytes,{ contentType:file.type,upsert:false });
      if (uploadError) return fail("storage_upload_failed",500);
      const { data, error } = await db.from("economy_receipts").insert({
        id,expense_date:expenseDate,supplier,category,amount_ore:amount,vat_ore:vat,
        deductible_vat_ore:deductible,note:String(payload.note ?? "").slice(0,1500),
        file_path:path,file_name:file.name.slice(0,180),mime_type:file.type,created_by:actor,file_sha256:digest
      }).select("id,vat_suggestion").single();
      if (error) {
        await db.storage.from(BUCKET).remove([path]);
        return fail(error.code === "23505" ? "duplicate_file" : "receipt_save_failed",
          error.code === "23505" ? 409 : 500);
      }
      return send({ ok:true,receipt:data },201);
    }
    if (action === "list") {
      const { data,error } = await db.from("economy_receipts")
        .select("id,expense_date,supplier,category,amount_ore,vat_ore,deductible_vat_ore,file_name,vat_suggestion,created_at")
        .is("archived_at",null).order("created_at",{ascending:false}).limit(80);
      return error ? fail("receipt_list_failed",500) : send({ok:true,receipts:data ?? []});
    }
    if (!isUuid(payload.receipt_id)) throw Error("invalid_receipt_id");
    if (action === "file") {
      const {data: receipt} = await db.from("economy_receipts")
        .select("file_path").eq("id",payload.receipt_id).is("archived_at",null).maybeSingle();
      if (!receipt) return fail("receipt_not_found",404);
      const {data,error} = await db.storage.from(BUCKET).createSignedUrl(receipt.file_path,300);
      return error ? fail("signed_url_failed",500) : send({ok:true,url:data.signedUrl});
    }
    if (action === "preview") {
      const rate = payload.vat_rate_percent == null || payload.vat_rate_percent === "" ?
        null : intVal(payload.vat_rate_percent,"vat_rate",25);
      const businessUse = payload.business_use_percent == null || payload.business_use_percent === "" ?
        null : intVal(payload.business_use_percent,"business_use",100);
      const {data,error} = await db.rpc("finance_receipt_vat_preview",{
        p_receipt_id:payload.receipt_id,p_vat_rate_percent:rate,p_business_use_percent:businessUse
      });
      return error ? fail(error.message,400) : send({ok:true,suggestion:data});
    }
    if (action === "candidates") {
      const {data,error} = await db.rpc("finance_receipt_bank_candidates",{p_receipt_id:payload.receipt_id});
      return error ? fail("bank_candidates_failed",500) : send({ok:true,candidates:data ?? []});
    }
    if (action === "link") {
      if (!isUuid(payload.bank_id) || payload.confirmed !== true) throw Error("bank_confirmation_required");
      const {data,error} = await db.rpc("finance_set_receipt_bank_link",{
        p_org:ORGANIZATION,p_bank:payload.bank_id,p_receipt:payload.receipt_id,
        p_action:"link",p_confirmed:true,p_actor:actor
      });
      return error ? fail(error.message,409) : send({ok:true,result:data});
    }
    if (action === "review" || action === "approve") {
      if (!isUuid(payload.bank_id)) throw Error("bank_link_required");
      const {data:review,error:reviewError} = await db.rpc("finance_receipt_expense_review",{
        p_org:ORGANIZATION,p_bank:payload.bank_id,p_receipt:payload.receipt_id
      });
      if (reviewError) return fail("ledger_review_failed",500);
      if (!review) return fail("bank_link_required",409);
      if (action === "review") return send({ok:true,review});
      if (payload.confirmed !== true) throw Error("approval_required");
      const account = String(payload.account ?? "");
      if (!ACCOUNTS.has(account) || !(review.accounts ?? []).some((x: {code:string}) => x.code===account)) {
        throw Error("account_requires_manual_review");
      }
      const deductible = intVal(payload.deductible_vat_ore,"deductible_vat");
      if (deductible > Number(review.receipt.vat_ore) ||
          deductible >= Number(review.receipt.amount_ore)) throw Error("deductible_vat_exceeds_limit");
      if (review.entry?.status === "posted") return send({ok:true,already_posted:true,entry:review.entry});
      if (deductible !== Number(review.receipt.deductible_vat_ore)) {
        const {error} = await db.from("economy_receipts")
          .update({deductible_vat_ore:deductible}).eq("id",payload.receipt_id);
        if (error) return fail("vat_update_failed",409);
      }
      const {data:draft,error:draftError} = await db.rpc("finance_save_receipt_expense",{
        p_org:ORGANIZATION,p_bank:payload.bank_id,p_receipt:payload.receipt_id,
        p_account:account,p_vat:deductible,p_expected_version:review.entry?.version ?? 0,
        p_confirmed:true,p_actor:actor
      });
      if (draftError) return fail(draftError.message,409);
      const {data:posted,error:postError} = await db.rpc("finance_post_ledger_draft",{
        p_entry_id:draft.id,p_expected_version:draft.version,p_actor:actor
      });
      if (postError) return fail("ledger_draft_saved_but_post_failed:" + postError.message,409);
      return send({ok:true,posted,entry_id:draft.id});
    }
    return fail("unsupported_action",404);
  } catch(e) {
    return fail(e instanceof Error ? e.message : "unexpected_failure",400);
  }
});
