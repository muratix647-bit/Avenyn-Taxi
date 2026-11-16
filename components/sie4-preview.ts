/**
 * Read-only SIE4 file preview: NO imports or network writes.
 * SIE #FORMAT PC8 => IBM CP437 is supported. UTF-8 also supported.
 * Every voucher is checked for equal debit and credit before any later import.
 */
export type SIEAccount = { account: string; name: string };
export type SIELine = {
  account: string;
  debitOre: number;
  creditOre: number;
  date: string | null;
  text: string;
};
export type SIEVoucher = {
  series: string;
  number: string;
  date: string;
  text: string;
  lines: SIELine[];
  debitOre: number;
  creditOre: number;
  balanced: boolean;
  issues: string[];
};
export type SIEPreview = {
  filename: string;
  format: string;
  organizationNumber: string | null;
  companyName: string | null;
  fiscalYear: { start: string; end: string } | null;
  accounts: SIEAccount[];
  vouchers: SIEVoucher[];
  openingBalances: Array<{ account: string; amountOre: number }>;
  warnings: string[];
  safeToConsiderForImport: boolean;
};

// IBM PC8 / CP437 mapping for bytes 0x80–0xFF, generated from Python standard codec.
const CP437_HIGH = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

function decodeCP437(bytes: Uint8Array): string {
  let result = "";
  for (const code of bytes) result += code < 128 ? String.fromCharCode(code) : CP437_HIGH[code - 128] || "�";
  return result;
}

export function decodeSIE(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  const head = new TextDecoder("ascii").decode(bytes.slice(0, 1000));
  if (/^#FORMAT\s+PC8/m.test(head)) return decodeCP437(bytes);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return decodeCP437(bytes); }
}

function tokenize(line: string): string[] {
  const result: string[] = [];
  const re = /"(?:[^"\\]|\\.)*"|\{[^}]*\}|[^\s]+/g;
  for (const token of line.match(re) ?? []) {
    if (token.startsWith('"') && token.endsWith('"')) {
      result.push(token.slice(1, -1).replace(/\\"/g, '"'));
    } else result.push(token);
  }
  return result;
}
function ore(v: string): number | null {
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(v)) return null;
  const neg = v.startsWith("-");
  const raw = neg ? v.slice(1) : v;
  const [whole, fractions = ""] = raw.replace(",", ".").split(".");
  const val = Number(whole) * 100 + Number(fractions.padEnd(2, "0"));
  return Number.isSafeInteger(val) ? (neg ? -val : val) : null;
}
function ymd(value?: string): string | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  const formatted = `${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}`;
  const date = new Date(formatted + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === formatted ? formatted : null;
}

export function parseSIE4(text: string, filename = "fil.se"): SIEPreview {
  const warnings: string[] = [];
  const accounts = new Map<string, string>();
  const vouchers: SIEVoucher[] = [];
  const openingBalances: SIEPreview["openingBalances"] = [];
  let format = "UNKNOWN", organizationNumber: string | null = null;
  let companyName: string | null = null;
  let fiscalYear: SIEPreview["fiscalYear"] = null;
  let current: SIEVoucher | null = null;
  let insideVoucher = false;
  let headerCount = 0;
  let hasType = false;
  for (const [i, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) continue;
    const tokens = tokenize(line);
    const type = tokens[0];
    if (type === "#FLAGGA" || type === "#PROGRAM" || type === "#GEN") continue;
    if (type === "#SIETYP") { hasType = true; if (tokens[1] !== "4") warnings.push("SIE-typ är inte SIE4."); continue; }
    if (type === "#FORMAT") { format = tokens[1] ?? "UNKNOWN"; continue; }
    if (type === "#ORGNR") { organizationNumber = tokens[1] ?? null; continue; }
    if (type === "#FNAMN") { companyName = tokens.slice(1).join(" ") || null; continue; }
    if (type === "#RAR" && tokens[1] === "0") {
      const start = ymd(tokens[2]); const end = ymd(tokens[3]);
      if (start && end && start <= end) fiscalYear = { start, end };
      continue;
    }
    if (type === "#KONTO") {
      if (tokens[1] && tokens[2]) accounts.set(tokens[1], tokens.slice(2).join(" "));
      continue;
    }
    if (type === "#IB" && tokens.length > 3) {
      const n = ore(tokens[3]); if (n !== null) openingBalances.push({ account: tokens[2], amountOre: n });
      else warnings.push(`Rad ${i + 1}: ogiltigt ingående saldo.`);
      continue;
    }
    if (type === "#VER") {
      if (current) warnings.push(`Rad ${i + 1}: en verifikation avslutades inte korrekt.`);
      headerCount++;
      current = {
        series: tokens[1] || "A", number: tokens[2] || "", date: ymd(tokens[3]) || "",
        text: tokens.slice(4).join(" "), lines: [], debitOre: 0, creditOre: 0, balanced: false,
        issues: [],
      };
      vouchers.push(current);
      insideVoucher = false;
      if (!current.date) current.issues.push("Verifikationsdatum saknas.");
      continue;
    }
    if (type === "{") { insideVoucher = Boolean(current); continue; }
    if (type === "}") { insideVoucher = false;current = null;continue; }
    if (type === "#TRANS" && current && insideVoucher) {
      const a = tokens[1] || "";
      // SIE4: #TRANS Konto {dimensions} Belopp [Transdatum [Text]]
      const amountField = tokens[2]?.startsWith("{") ? 3 : 2;
      const value = ore(tokens[amountField] ?? "");
      if (value === null) { current.issues.push(`Rad ${i + 1}: ogiltigt transaktionsbelopp.`); continue; }
      if (value === 0) current.issues.push(`Rad ${i + 1}: nollbelopp kräver kontroll.`);
      if (!/^\d{4}$/.test(a)) current.issues.push(`Rad ${i + 1}: oväntat konto ${a}.`);
      const tranDate = ymd(tokens[amountField + 1]);
      const record = {
        account: a, debitOre: value > 0 ? value : 0,
        creditOre: value < 0 ? -value : 0,
        date: tranDate, text: tokens.slice(amountField + (tranDate ? 2 : 1)).join(" "),
      };
      current.lines.push(record);
      current.debitOre += record.debitOre;
      current.creditOre += record.creditOre;
      continue;
    }
    if (type === "#TRANS") warnings.push(`Rad ${i + 1}: transaktion utanför verifikation.`);
    // #RTRANS, #BTRANS and nonstandard dimensions are not imported; explicitly warn.
    if ((type === "#RTRANS" || type === "#BTRANS") && current) current.issues.push(`Rad ${i + 1}: ${type} kräver manuell kontroll.`);
  }
  if (current) warnings.push("Sista verifikationen saknar avslutande klammer.");
  if (!hasType) warnings.push("SIE-typ (#SIETYP 4) saknas.");
  if (!headerCount) warnings.push("Inga #VER-poster hittades. Är detta en SIE4-export?");
  for (const voucher of vouchers) {
    if (!Number.isSafeInteger(voucher.debitOre) || !Number.isSafeInteger(voucher.creditOre)) voucher.issues.push("Summan är för stor för säker beräkning.");
    voucher.balanced = voucher.lines.length >= 2 && voucher.debitOre > 0 && voucher.debitOre === voucher.creditOre;
    if (!voucher.balanced) voucher.issues.push("Obalanserad verifikation eller färre än två rader.");
    for (const t of voucher.lines) if (!accounts.has(t.account)) voucher.issues.push(`Konto ${t.account} saknar #KONTO.`);
  }
  if (!fiscalYear) warnings.push("Räkenskapsperiod (#RAR 0) saknas.");
  if (!organizationNumber) warnings.push("Organisationsnummer (#ORGNR) saknas.");
  if (vouchers.length > 10000) warnings.push("För många verifikationer för denna förhandsgranskning.");
  return {
    filename, format, organizationNumber, companyName, fiscalYear,
    accounts: Array.from(accounts, ([account, name]) => ({ account, name })), vouchers,
    openingBalances, warnings,
    safeToConsiderForImport: Boolean(fiscalYear && organizationNumber && vouchers.length &&
      vouchers.length <= 10000 && !warnings.length && vouchers.every(v => v.balanced && !v.issues.length)),
  };
}
