/**
 * Conservative helpers for OCR text from Swedish receipts.
 * Never use the result for automatic bookkeeping or VAT deduction.
 * The original receipt must be reviewed by an administrator.
 */
export type ParsedReceipt = {
  supplier: string;
  expenseDate: string;
  totalOre: number | null;
  vatRate: number | null;
  category: string;
  notices: string[];
};

function oreValue(raw: string): number | null {
  let s = raw.replace(/[\s\u00a0]/g, "").replace(/kr\.?$/i, "");
  // Many Swedish receipts write thousand separators as dots: 1.250,00.
  if (/^\d{1,3}(?:\.\d{3})+[,]\d{2}$/.test(s)) s = s.replace(/\./g, "");
  // Swedish numeric notation: 1 250,00 or 125,00; accept decimal point too.
  const decimal = s.match(/^\d{1,10}[,.]\d{2}$/);
  if (!decimal) return null;
  const val = Math.round(Number(s.replace(",", ".")) * 100);
  return Number.isSafeInteger(val) && val > 0 && val <= 100000000 ? val : null;
}

function validISO(year: number, month: number, day: number): string {
  if (year < 2010 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === iso ? iso : "";
}

export function parseSwedishReceipt(text: string): ParsedReceipt {
  const lines = text.replace(/\r/g, "").split("\n").map(s => s.trim()).filter(Boolean);
  const notices: string[] = [];
  const supplier = lines.find(s => s.length >= 3 && s.length <= 80 &&
      !/^(kvitto|kassakvitto|original|datum|date|tid|order|terminal|org\.?nr|moms|total|summa|att betala)\b/i.test(s) &&
      /[a-zåäö]/i.test(s))?.slice(0, 80) ?? "";
  let expenseDate = "";
  for (const line of lines) {
    // yyyy-mm-dd, yyyy.mm.dd or yyyy/mm/dd
    const ymd = line.match(/\b(20\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})\b/);
    if (ymd) expenseDate = validISO(+ymd[1], +ymd[2], +ymd[3]);
    if (!expenseDate) {
      // dd-mm-yyyy or dd.mm.yyyy, optionally two-digit year
      const dmy = line.match(/\b(\d{1,2})[-.\/](\d{1,2})[-.\/](20\d{2}|\d{2})\b/);
      if (dmy) {
        const yr = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3];
        expenseDate = validISO(yr, +dmy[2], +dmy[1]);
      }
    }
    if (expenseDate) break;
  }
  // Only read numbers on a line explicitly marked as the final total.
  // Never take the largest number: receipt numbers, time and other figures can be larger.
  let totalOre: number | null = null;
  const totalLines = lines.filter(s =>
    /\b(att\s+betala|summa|total(?:t)?|belopp\s+att\s+betala)\b/i.test(s) &&
    !/\bmoms\b/i.test(s)
  );
  for (const line of totalLines.reverse()) {
    const matches = Array.from(line.matchAll(/(?:\d[\d\s\u00a0.]*\d|\d)[,.]\d{2}/g));
    if (matches.length) {
      totalOre = oreValue(matches.at(-1)![0]);
      if (totalOre !== null) break;
    }
  }
  const foundRates = new Set<number>();
  for (const line of lines) {
    if (!/moms|vat|mervärdesskatt/i.test(line)) continue;
    for (const m of line.matchAll(/\b(6|12|25)\s*%/g)) foundRates.add(+m[1]);
  }
  let vatRate: number | null = foundRates.size === 1 ? [...foundRates][0] : null;
  if (foundRates.size > 1) notices.push("Kvittot verkar ha blandad moms. Räkna varje momssats separat.");
  else if (foundRates.size === 0) notices.push("Momssats kunde inte läsas säkert från originalkvittot.");
  if (!supplier) notices.push("Leverantör saknas eller var oläsbar.");
  if (!expenseDate) notices.push("Datum kunde inte läsas säkert.");
  if (totalOre === null) notices.push("Totalbelopp kunde inte läsas säkert.");
  const haystack = lines.join(" ").toLowerCase();
  let category = "okand";
  if (/\b(bensin|diesel|drivmedel|tankning)\b/i.test(haystack)) category = "personbil_bransle";
  else if (/\b(reparation|verkstad|bilservice|reparationsarbete)\b/i.test(haystack)) category = "personbil_reparation";
  else if (/\b(leasingavgift|leasingbil)\b/i.test(haystack)) category = "personbil_leasing";
  else if (/\b(kontorsmaterial|skrivarpapper|tonerkassett)\b/i.test(haystack)) category = "kontorsmaterial";
  else if (/\b(mobilabonnemang|mobiltelefoni)\b/i.test(haystack)) category = "telefoni";
  else if (/\b(förbrukningsmaterial|förbrukningsartikel)\b/i.test(haystack)) category = "forbrukningsmaterial";
  notices.push("OCR-resultat och BAS-konto är förslag. Kontrollera originalbilden och avdragsrätten.");
  return { supplier, expenseDate, totalOre, vatRate, category, notices };
}
