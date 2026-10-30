
const Deno = {
  env: {
    get(name) {
      if (name === "GEMINI_API_KEY") {
        return process.env.GEMINI_API_KEY || "";
      }
      return process.env[name];
    }
  }
};

// @ts-nocheck — Deno edge function; not checked by project TypeScript
// createClient mocked
import * as XLSX from "xlsx";
import { PDFDocument } from "pdf-lib";
import { getDocumentProxy } from "unpdf";

// Support a comma-separated list of allowed origins in the ALLOWED_ORIGIN secret.
// Example: "https://logiclot.com,http://localhost:8080"
const DEFAULT_ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGIN") || "https://logiclot.com")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

function determineAllowOrigin(requestOrigin: string | null) {
  if (!requestOrigin) return DEFAULT_ALLOWED_ORIGINS[0];
  if (DEFAULT_ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  return DEFAULT_ALLOWED_ORIGINS[0];
}

function buildCorsHeaders(requestOrigin: string | null) {
  const allow = determineAllowOrigin(requestOrigin);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { row.push(field.trim()); field = ""; }
      else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        row.push(field.trim());
        if (row.some(c => c !== "")) rows.push(row);
        row = []; field = "";
        if (ch === "\r") i++;
      } else { field += ch; }
    }
  }
  row.push(field.trim());
  if (row.some(c => c !== "")) rows.push(row);
  return rows;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP: Record<string, string> = {
  // VIN
  vin: "vin", vehiclevin: "vin", vinno: "vin", vinnumber: "vin",
  vehicleidentificationnumber: "vin", fullvin: "vin",
  // Year
  year: "year", yr: "year", modelyear: "year", vehicleyear: "year", mfryear: "year",
  // Make
  make: "make", manufacturer: "make", vehiclemake: "make", brand: "make",
  // Model
  model: "model", vehiclemodel: "model",
  // Trim / Style — "Style" is the Americas Auto Auction trim column
  trim: "trim", trimlevel: "trim", style: "trim", series: "trim",
  bodytrim: "trim", seriestrim: "trim", trimstyle: "trim",
  // Mileage
  mileage: "mileage", miles: "mileage", odometer: "mileage", odo: "mileage",
  odometerreading: "mileage", odometermi: "mileage", mi: "mileage",
  currentmileage: "mileage", actualmileage: "mileage", vehiclemileage: "mileage",
  // Lane
  lane: "lane", lanename: "lane", lanenumber: "lane", laneno: "lane",
  // Run order (lane sequence number — e.g. "Run #" column at Manheim/ADESA)
  runorder: "run_order", run: "run_order", runno: "run_order", runnumber: "run_order",
  linenumber: "run_order", line: "run_order", item: "run_order", itemno: "run_order",
  // Lot / Stock number (IAA lot#, ADESA stock#, Americas AA item# — distinct from run order)
  lot: "lot_number", lotnumber: "lot_number", lotno: "lot_number", lotnum: "lot_number",
  stocknumber: "lot_number", stockno: "lot_number", stock: "lot_number",
  // Seller / title
  sellertype: "seller_type", seller: "seller_type",
  titlestatus: "title_status", title: "title_status",
  titlebrand: "title_status", titletype: "title_status",
  // Damage location (IAA primary/secondary damage, generic damage field)
  primarydamage: "damage_location", damagelocation: "damage_location",
  damagearea: "damage_location",
  // Damage type (IAA loss type / loss code)
  losstype: "damage_type", lostype: "damage_type", losscode: "damage_type",
  damagetype: "damage_type",
  // Drive condition (IAA start code, generic starts/drives)
  startcode: "drive_condition", startingcode: "drive_condition",
  drivecondition: "drive_condition", starts: "drive_condition",
  // Body condition (airbags deployed/intact)
  bodycondition: "body_condition", airbags: "body_condition",
  airbagstatus: "body_condition",
  // Key status
  keys: "key_status", keysavailable: "key_status", keystatus: "key_status",
  // Secondary damage → merged into condition_notes
  secondarydamage: "condition_notes",
  // Condition notes — multiple source columns are MERGED (not overwritten)
  conditionnotes: "condition_notes", condition: "condition_notes",
  notes: "condition_notes", comments: "condition_notes",
  announcements: "condition_notes", announcement: "condition_notes",
  lights: "condition_notes", light: "condition_notes",   // auction light codes
  defects: "condition_notes", issues: "condition_notes",
  damage: "condition_notes",
  // MMR / wholesale price
  mmr: "mmr_value", mmrvalue: "mmr_value", mmrprice: "mmr_value",
  manheimmarketreport: "mmr_value", wbmv: "mmr_value", blackbook: "mmr_value",
  // Bids
  currentbid: "current_bid", bid: "current_bid", highbid: "current_bid",
  startingbid: "current_bid", bidamount: "current_bid", currentbidamount: "current_bid",
  highbidamount: "current_bid", bidprice: "current_bid", currentbidprice: "current_bid",
  // Buy now
  buynow: "buy_now", buynowprice: "buy_now", buyitnow: "buy_now",
  buynowamount: "buy_now", buyitnowprice: "buy_now", buyout: "buy_now",
  // General price estimate — also catches auction/dealer price columns by common names
  price: "price_estimate", priceestimate: "price_estimate",
  estprice: "price_estimate", estimatedprice: "price_estimate",
  saleprice: "price_estimate", listprice: "price_estimate",
  askingprice: "price_estimate", retailprice: "price_estimate",
  netprice: "price_estimate", wholesaleprice: "price_estimate",
  bookvalue: "price_estimate", appraisal: "price_estimate",
  appraisalvalue: "price_estimate", tradeinvalue: "price_estimate",
  vehiclevalue: "price_estimate", marketvalue: "price_estimate",
  averageprice: "price_estimate", avgprice: "price_estimate",
  // IAAI / IAA specific columns
  estimatedretailvalue: "price_estimate", estimatedretail: "price_estimate",
  iaaestimatedretailvalue: "price_estimate",
  titlestate: "title_status",
  // "Run # / Lot #" combined column used by some IAA exports — the auction run sequence number
  runlot: "run_order", runlotno: "run_order", runlotnum: "run_order",
  // CR score — "Grade" is the Americas Auto Auction CR score column
  cr: "cr_score", crscore: "cr_score", conditionreport: "cr_score",
  conditionscore: "cr_score", conditiongrade: "cr_score",
  conditionreportgrade: "cr_score",
  crgrade: "cr_score", crvalue: "cr_score", grade: "cr_score",
  score: "cr_score", vehiclescore: "cr_score", vehiclegrade: "cr_score",
  condreport: "cr_score", conditionreportscore: "cr_score",
  reportgrade: "cr_score", inspectionscore: "cr_score",
  auctiongrade: "cr_score", conditionrating: "cr_score",
  // Vehicle type
  type: "vehicle_type", vehicletype: "vehicle_type", bodytype: "vehicle_type",
  bodystyle: "vehicle_type", category: "vehicle_type", vehiclecategory: "vehicle_type",
  // Recon
  reconestimate: "estimated_recon_cost", reconest: "estimated_recon_cost",
  estimatedrecon: "estimated_recon_cost", reconcost: "estimated_recon_cost",
  recon: "estimated_recon_cost",
};

const CR_HEADER_HINT = /(cr|condition|grade|score|report|inspect)/i;

function parseNumberish(raw: string): number | null {
  // Strip fraction denominators like "/5" (e.g. CR score "3.5/5" → "3.5", "4/5" → "4")
  const stripped = raw.replace(/\s*\/\s*\d+\s*$/, "");
  const cleaned = stripped.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-" || cleaned === "-.") return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function looksLikeCrValue(raw: string): boolean {
  const value = parseNumberish(raw);
  if (value == null) return false;
  // Accept 1–5 range. Integers ("3", "4") are valid CR scores at some auctions.
  return value >= 1 && value <= 5;
}

function detectCrColumn(headers: string[], dataRows: string[][], mappedIndex?: number): { index: number | null; header: string | null; source: string } {
  // If a mapped index was provided, verify it actually contains numeric CR-like values.
  // Some CSVs have a "CR" column with Yes/No values (e.g. Americas Auto Auction) and a
  // separate "Grade" column with decimal scores. We prefer the numeric one.
  if (mappedIndex != null) {
    let hasDecimalCr = false;
    for (const row of dataRows.slice(0, Math.min(200, dataRows.length))) {
      if (looksLikeCrValue((row[mappedIndex] ?? "").trim())) { hasDecimalCr = true; break; }
    }
    if (hasDecimalCr) return { index: mappedIndex, header: headers[mappedIndex] ?? null, source: "header_map" };
    // Fall through — mapped column has no numeric CR values, search heuristically
  }
  let bestIndex: number | null = null;
  let bestScore = 0;
  headers.forEach((header, index) => {
    let decimalMatches = 0;
    let nonEmpty = 0;
    for (const row of dataRows.slice(0, 200)) {
      const raw = (row[index] ?? "").trim();
      if (!raw) continue;
      nonEmpty += 1;
      if (looksLikeCrValue(raw)) decimalMatches += 1;
    }
    if (!nonEmpty || !decimalMatches) return;
    const ratio = decimalMatches / nonEmpty;
    const hintBonus = CR_HEADER_HINT.test(header) ? 5 : 0;
    const score = decimalMatches + ratio * 10 + hintBonus;
    if (decimalMatches >= 3 && ratio >= 0.2 && score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return {
    index: bestIndex,
    header: bestIndex != null ? headers[bestIndex] ?? null : null,
    source: bestIndex != null ? "data_heuristic" : "not_found",
  };
}

function parseMileageValue(raw: string): { mileage: number | null; isTMU: boolean } {
  const upper = raw.toUpperCase();
  const isTMU = upper.includes("TMU");
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9]/g, "");
  if (!cleaned) return { mileage: null, isTMU };
  const value = parseInt(cleaned, 10);
  if (isNaN(value) || value < 0 || value > 1500000) return { mileage: null, isTMU };
  return { mileage: isTMU ? null : value, isTMU };
}

function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

// ─── Price column auto-detection ────────────────────────────────────────────
// Finds a column with values in vehicle price range ($500–$150k) when no price
// column was recognised by name. Helps with custom auction formats.
function detectPriceColumn(
  headers: string[],
  dataRows: string[][],
  alreadyMappedIndices: Set<number>,
): { index: number | null; source: string } {
  const PRICE_HINT = /(price|value|mmr|bid|cost|retail|wholesale|market|book|net|apprais|wbmv|reserve|floor|estimate|asking|buyout)/i;
  let bestIndex: number | null = null;
  let bestScore = 0;
  headers.forEach((header, index) => {
    if (alreadyMappedIndices.has(index)) return;
    let priceMatches = 0;
    let nonEmpty = 0;
    for (const row of dataRows.slice(0, 100)) {
      const raw = (row[index] ?? "").trim();
      if (!raw) continue;
      nonEmpty++;
      const val = parseNumberish(raw);
      if (val != null && val >= 100 && val <= 250000) priceMatches++;
    }
    if (!nonEmpty || priceMatches < 3) return;
    const ratio = priceMatches / nonEmpty;
    if (ratio < 0.4) return;
    const hintBonus = PRICE_HINT.test(header) ? 8 : 0;
    const score = priceMatches + ratio * 10 + hintBonus;
    if (score > bestScore) { bestScore = score; bestIndex = index; }
  });
  return { index: bestIndex, source: bestIndex != null ? "price_heuristic" : "not_found" };
}

function parseCSVToVehicles(csvText: string, runListId: string, orgId: string): Record<string, unknown>[] {
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
  csvText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = parseCSV(csvText);
  if (rows.length < 2) throw new Error("CSV has no data rows");

  const headers = rows[0];
  const dataRows = rows.slice(1);
  console.log("[parse-run-list] 📊 CSV file parsed:", { header_count: headers.length, row_count: dataRows.length });
  console.log(`[parse-run-list] 📊 SOURCE TOTAL: ${dataRows.length} data rows in CSV`);

  const colMap: Record<string, number> = {};
  // Columns that map to condition_notes BEYOND the first occurrence get merged (not overwritten)
  const conditionNotesExtra: number[] = [];
  headers.forEach((h, idx) => {
    const col = HEADER_MAP[norm(h)];
    if (!col) return;
    if (col === "condition_notes" && colMap.condition_notes != null) {
      conditionNotesExtra.push(idx); // merge lights, announcements, defects, etc.
    } else {
      colMap[col] = idx;
    }
  });

  if (colMap.mileage == null) {
    const mileagePatterns = [/mileage/i, /miles/i, /odometer/i, /\bodo\b/i];
    for (let idx = 0; idx < headers.length; idx++) {
      for (const pat of mileagePatterns) {
        if (pat.test(headers[idx])) { colMap.mileage = idx; break; }
      }
      if (colMap.mileage != null) break;
    }
  }

  // Auto-detect a price column if no recognised price column exists.
  // Handles custom auction formats where the price column has an unusual name.
  const priceFields = ["mmr_value", "current_bid", "buy_now", "price_estimate"];
  if (!priceFields.some(f => colMap[f] != null)) {
    const mappedIdx = new Set(Object.values(colMap));
    const detected = detectPriceColumn(headers, dataRows, mappedIdx);
    if (detected.index != null) {
      console.log(`[parse-run-list] 💰 Auto-detected price column: "${headers[detected.index]}" (idx ${detected.index})`);
      colMap.price_estimate = detected.index;
    } else {
      console.log("[parse-run-list] ⚠️  No price column found — segment-based retail estimation will be used.");
    }
  }

  const detectedCr = detectCrColumn(headers, dataRows, colMap.cr_score);
  if (detectedCr.index != null) colMap.cr_score = detectedCr.index;

  console.log("[parse-run-list] CSV column mapping:", JSON.stringify(colMap));

  const numFields = new Set(["mmr_value", "current_bid", "buy_now", "price_estimate", "cr_score", "estimated_recon_cost"]);

  let crValuesExtracted = 0, rowsFallbackNoCr = 0;
  let mileageParsed = 0, mileageMissing = 0, tmuDetected = 0;
  let validVinCount = 0, invalidVinCount = 0, missingVinCount = 0;
  let parsedMakeModel = 0;

  const parsedRows = dataRows.map(row => {
    const v: Record<string, unknown> = { run_list_id: runListId, organization_id: orgId, has_cr: false };
    const riskFlags: string[] = [];

    for (const [col, idx] of Object.entries(colMap)) {
      const raw = (row[idx] ?? "").trim();
      if (!raw) continue;

      if (col === "mileage") {
        const { mileage, isTMU } = parseMileageValue(raw);
        if (isTMU) { tmuDetected++; riskFlags.push("TMU"); }
        if (mileage != null) { v.mileage = mileage; mileageParsed++; }
        else { mileageMissing++; }
        continue;
      }

      if (col === "year") {
        const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) v.year = parseInt(yearMatch[0], 10);
        continue;
      }

      if (col === "run_order") {
        // Handle formats like "B-0001" (Americas AA), "LOT-5", "R123", plain "45"
        // Strip leading non-digit chars then parse — parseInt stops at first non-digit
        const stripped = raw.replace(/^[^0-9]+/, "");
        const n = parseInt(stripped, 10);
        if (!isNaN(n) && n >= 0) v[col] = n;
        continue;
      }

      if (numFields.has(col)) {
        const n = parseNumberish(raw);
        // Reject negative values for price/cost fields (accounting notation like "($1,500)")
        if (n != null && (col === "cr_score" || n >= 0)) v[col] = n;
      } else {
        v[col] = raw;
      }
    }

    const vin = typeof v.vin === "string" ? v.vin.trim().toUpperCase() : "";
    if (vin) {
      v.vin = vin;
      if (isValidVin(vin)) validVinCount++; else invalidVinCount++;
    } else { missingVinCount++; }

    if (v.make || v.model) parsedMakeModel++;

    // Normalize vehicle_type to match DB enum values
    if (typeof v.vehicle_type === "string") {
      const vt = v.vehicle_type.trim().toLowerCase();
      if (["suv", "crossover", "sport utility", "sport utility vehicle", "crossover suv"].includes(vt)) v.vehicle_type = "SUV";
      else if (["sedan", "saloon", "4dr", "4-door", "full-size", "midsize", "mid-size"].includes(vt)) v.vehicle_type = "Sedan";
      else if (["truck", "pickup", "crew cab", "regular cab", "extended cab", "double cab"].includes(vt)) v.vehicle_type = "Truck";
      else if (["van", "minivan", "mini-van", "cargo van", "passenger van", "commercial"].includes(vt)) v.vehicle_type = "Van";
      else if (["coupe", "convertible", "2dr", "2-door", "roadster", "cabriolet"].includes(vt)) v.vehicle_type = "Coupe";
      else if (["economy", "hatchback", "wagon", "compact", "subcompact"].includes(vt)) v.vehicle_type = "Economy";
      else v.vehicle_type = v.vehicle_type.trim(); // preserve original casing
    }

    // Merge extra condition_notes sources (lights codes, secondary announcements, etc.)
    if (conditionNotesExtra.length > 0) {
      const parts: string[] = [];
      if (v.condition_notes) parts.push(String(v.condition_notes));
      for (const idx of conditionNotesExtra) {
        const raw = (row[idx] ?? "").trim();
        if (raw && raw !== "-" && raw.toLowerCase() !== "n/a" && raw !== "0") parts.push(raw);
      }
      if (parts.length > 0) v.condition_notes = parts.join("; ");
    }

    const crValue = typeof v.cr_score === "number" && v.cr_score >= 1 && v.cr_score <= 5 ? v.cr_score : null;
    if (crValue != null) { v.cr_score = crValue; v.has_cr = true; crValuesExtracted++; }
    else { delete v.cr_score; rowsFallbackNoCr++; }

    if (riskFlags.length > 0) v.risk_flags = riskFlags;
    return v;
  });

  console.log("[parse-run-list] ═══ PARSING SUMMARY ═══");
  console.log(`[parse-run-list] 📊 Source rows: ${dataRows.length}, Parsed: ${parsedRows.length}, Skipped: ${dataRows.length - parsedRows.length}`);
  console.log(`[parse-run-list] 📊 Mileage parsed/missing: ${mileageParsed}/${mileageMissing}, TMU: ${tmuDetected}`);
  console.log(`[parse-run-list] 📊 VIN valid/invalid/missing: ${validVinCount}/${invalidVinCount}/${missingVinCount}`);
  console.log(`[parse-run-list] 📊 CR extracted/noCR: ${crValuesExtracted}/${rowsFallbackNoCr}`);
  console.log(`[parse-run-list] 📊 Make/Model parsed: ${parsedMakeModel}/${dataRows.length}`);

  return parsedRows;
}

function rowHasVehicleSignal(row: Record<string, unknown>): boolean {
  const vin = typeof row.vin === "string" ? row.vin.trim().toUpperCase() : "";
  if (vin && isValidVin(vin)) return true;

  const year = typeof row.year === "number" ? row.year : null;
  const make = typeof row.make === "string" ? row.make.trim() : "";
  const model = typeof row.model === "string" ? row.model.trim() : "";
  const mileage = typeof row.mileage === "number" ? row.mileage : null;
  const lane = row.lane != null ? String(row.lane).trim() : "";
  const runOrder = typeof row.run_order === "number" ? row.run_order : null;
  const lotNumber = typeof row.lot_number === "string" ? row.lot_number.trim() : "";

  // A partial VIN (with wildcards, like IAA format) plus year is sufficient
  if (vin && vin.length >= 10 && year) return true;
  // VIN + make is sufficient even without year
  if (vin && vin.length >= 10 && make) return true;

  return Boolean(
    (year && make && model) ||
    (year && make && lane) ||
    (year && model && runOrder != null) ||
    (make && model && mileage != null) ||
    (lane && runOrder != null) ||
    // IAA: lot_number + year + make is sufficient (no VIN until it's fetched)
    (lotNumber && year && make)
  );
}

function getVehicleRowKey(row: Record<string, unknown>): string | null {
  const vin = typeof row.vin === "string" ? row.vin.trim().toUpperCase() : "";
  if (vin && isValidVin(vin)) return `vin:${vin}`;

  // IAA lot numbers are as unique as a VIN within a run list — use as primary key
  const lotNumber = typeof row.lot_number === "string" ? row.lot_number.trim() : "";
  if (lotNumber) return `lot:${lotNumber}`;

  const keyParts = [
    row.lane != null ? `lane:${norm(String(row.lane))}` : "",
    typeof row.run_order === "number" ? `run:${row.run_order}` : "",
    typeof row.year === "number" ? `year:${row.year}` : "",
    typeof row.make === "string" ? `make:${norm(row.make)}` : "",
    typeof row.model === "string" ? `model:${norm(row.model)}` : "",
    typeof row.mileage === "number" ? `mi:${row.mileage}` : "",
  ].filter(Boolean);

  return keyParts.length >= 4 ? keyParts.join("|") : null;
}

function dedupeVehicleRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const deduped: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = getVehicleRowKey(row);
    if (!key) {
      deduped.push(row);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

function parseSpreadsheetToVehicles(
  fileBytes: Uint8Array,
  runListId: string,
  orgId: string,
): Record<string, unknown>[] {
  const workbook = XLSX.read(fileBytes, { type: "array", dense: false });
  const sheetNames = workbook.SheetNames || [];

  if (sheetNames.length === 0) {
    throw new Error("Spreadsheet does not contain any sheets");
  }

  console.log(`[parse-run-list] 📗 Spreadsheet workbook detected: ${sheetNames.length} sheet(s)`);

  const combinedVehicles: Record<string, unknown>[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet["!ref"]) {
      console.log(`[parse-run-list] 📗 Skipping empty sheet: ${sheetName}`);
      continue;
    }

    const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (!csvText.trim()) {
      console.log(`[parse-run-list] 📗 Skipping blank sheet: ${sheetName}`);
      continue;
    }

    try {
      const parsed = parseCSVToVehicles(csvText, runListId, orgId).filter(rowHasVehicleSignal);
      console.log(`[parse-run-list] 📗 Sheet ${sheetName}: ${parsed.length} vehicle row(s)`);
      combinedVehicles.push(...parsed);
    } catch (err) {
      console.warn(
        `[parse-run-list] 📗 Sheet ${sheetName} skipped:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const dedupedVehicles = dedupeVehicleRows(combinedVehicles);
  console.log(
    `[parse-run-list] 📗 Spreadsheet summary: ${combinedVehicles.length} parsed row(s), ${dedupedVehicles.length} after dedupe`,
  );

  if (dedupedVehicles.length === 0) {
    throw new Error("Spreadsheet parsing failed: no vehicle rows were found in any sheet");
  }

  return dedupedVehicles;
}

// ─── Lightweight PDF text extraction ────────────────────────────────────────

// Real PDF text extraction — handles compressed streams + CID/Type3 fonts
// (e.g. Chrome "Print to PDF" exports like the IAA sale lists).
// Falls back to the old raw-byte scan only if this fails.
async function extractPDFTextRaw(pdfBytes: Uint8Array): Promise<string> {
  try {
    const pdf = await getDocumentProxy(pdfBytes.slice());
    const numPages = (pdf && typeof pdf.numPages === "number") ? pdf.numPages : 0;
    const pages: string[] = [];
    for (let p = 1; p <= numPages; p++) {
      const page = await pdf.getPage(p);
      const textContent = await page.getTextContent();
      let out = "";
      for (const item of (textContent.items || [])) {
        if (typeof item.str === "string") {
          out += item.str;
          out += item.hasEOL ? "\n" : " ";
        }
      }
      pages.push(out);
    }
    const fullText = pages.join("\n");
    if (fullText.replace(/\s/g, "").length > 50) {
      console.log(`[parse-run-list] 📄 unpdf extraction: ${fullText.length} chars, ${(fullText.match(/\n/g) || []).length} newlines`);
      return fullText;
    }
    console.log("[parse-run-list] 📄 unpdf returned little text — using raw fallback");
  } catch (err) {
    console.log("[parse-run-list] 📄 unpdf failed, using raw fallback:",
      err instanceof Error ? err.message : err);
  }
  return extractPDFTextRawBytes(pdfBytes);
}

function extractPDFTextRawBytes(pdfBytes: Uint8Array): string {
  try {
    const rawStr = new TextDecoder("latin1").decode(pdfBytes);
    const textMatches: string[] = [];
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let m;
    while ((m = btEtRegex.exec(rawStr)) !== null) {
      const block = m[1];
      // Standard string: (text) Tj
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tj;
      while ((tj = tjRegex.exec(block)) !== null) {
        textMatches.push(tj[1]);
      }
      // Array form: [(text) 123 (text)] TJ
      const tjArrayRegex = /\[(.*?)\]\s*TJ/gi;
      let tja;
      while ((tja = tjArrayRegex.exec(block)) !== null) {
        const parts = tja[1].match(/\(([^)]*)\)/g);
        if (parts) textMatches.push(parts.map(p => p.slice(1, -1)).join(""));
      }
      // Hex-encoded strings: <hex> Tj or [<hex> 123 <hex>] TJ
      const hexTjRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
      let htj;
      while ((htj = hexTjRegex.exec(block)) !== null) {
        const decoded = decodeHexString(htj[1]);
        if (decoded) textMatches.push(decoded);
      }
      const hexArrayRegex = /\[(.*?)\]\s*TJ/gi;
      let htja;
      while ((htja = hexArrayRegex.exec(block)) !== null) {
        const hexParts = htja[1].match(/<([0-9A-Fa-f]+)>/g);
        if (hexParts) {
          const decoded = hexParts.map(p => decodeHexString(p.slice(1, -1))).filter(Boolean).join("");
          if (decoded) textMatches.push(decoded);
        }
      }
    }
    const text = textMatches.join(" ");
    console.log(`[parse-run-list] 📄 Raw BT/ET extraction: ${text.length} chars, ${textMatches.length} fragments`);
    return text;
  } catch (err) {
    console.log("[parse-run-list] Raw PDF extraction failed:", err);
    return "";
  }
}

function decodeHexString(hex: string): string {
  // PDF hex strings can be 2-byte (CIDFont) or 1-byte encoded
  // Try 2-byte first: if all decoded chars are printable ASCII, use 1-byte
  if (hex.length % 4 === 0) {
    let result = "";
    let isAsciiLike = true;
    for (let i = 0; i < hex.length; i += 4) {
      const code = parseInt(hex.substring(i, i + 4), 16);
      if (code > 0 && code < 0xFFFF) result += String.fromCharCode(code);
      if (code > 127) isAsciiLike = false;
    }
    if (isAsciiLike && result.length > 0) return result;
  }
  // Fallback: 1-byte decoding
  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.substring(i, i + 2), 16);
    if (code >= 32 && code < 127) result += String.fromCharCode(code);
  }
  return result;
}

// ─── Lightweight page count (no pdf-lib) ────────────────────────────────────

async function countPdfPages(pdfBytes: Uint8Array): Promise<number> {
  // Most reliable path: parse the PDF catalog/page tree directly.
  try {
    const doc = await PDFDocument.load(pdfBytes);
    const count = doc.getPageCount();
    if (Number.isFinite(count) && count > 0) return count;
  } catch {
    // Ignore and use heuristic fallback.
  }

  try {
    const rawStr = new TextDecoder("latin1").decode(pdfBytes);
    // First, try explicit /Type /Page objects.
    const pageObjectMatches = rawStr.match(/\/Type\s*\/Page\b/g);
    const pageObjectCount = pageObjectMatches ? pageObjectMatches.length : 0;

    // Fallback: use the largest /Count value from page tree nodes.
    const countMatches = [...rawStr.matchAll(/\/Count\s+(\d{1,5})\b/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((n) => Number.isFinite(n) && n > 0 && n < 10000);
    const countHint = countMatches.length > 0 ? Math.max(...countMatches) : 0;

    return Math.max(1, pageObjectCount, countHint);
  } catch {
    return 1;
  }
}

// Attempt to download a file from storage or HTTP URL. Tries:
// 1) default 'run-lists' bucket
// 2) interpret leading path segment as bucket name (bucket/path...)
// 3) if filePath looks like an http(s) URL, fetch it directly
async function downloadRunListFile(supabase: any, filePath: string) {
  // Try default bucket first
  try {
    const { data, error } = await supabase.storage.from('run-lists').download(filePath);
    if (!error && data) return { data };
  } catch (_) { /* ignore */ }

  // If filePath looks like bucket/path, try that bucket
  const trimmed = filePath.replace(/^\/+/, "");
  const parts = trimmed.split('/');
  if (parts.length > 1) {
    const bucket = parts[0];
    const path = parts.slice(1).join('/');
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (!error && data) return { data };
    } catch (_) { /* ignore */ }
  }

  // If it's an absolute URL, try fetching directly
  if (/^https?:\/\//i.test(filePath)) {
    try {
      const resp = await fetch(filePath);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const blob = new Blob([new Uint8Array(buf)]);
        return { data: blob };
      }
    } catch (_) { /* ignore */ }
  }

  return { error: new Error('Download failed') };
}

async function extractPdfPage(pdfBytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const pageCount = srcDoc.getPageCount();
  if (pageIndex < 0 || pageIndex >= pageCount) {
    throw new Error(`Page ${pageIndex + 1} is out of range for PDF with ${pageCount} page(s)`);
  }

  const singlePageDoc = await PDFDocument.create();
  const [page] = await singlePageDoc.copyPages(srcDoc, [pageIndex]);
  singlePageDoc.addPage(page);

  const saved = await singlePageDoc.save();
  return saved;
}

// ─── Base64 encoding (chunked to avoid stack overflow) ──────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    let binary = "";
    for (let j = 0; j < slice.length; j++) binary += String.fromCharCode(slice[j]);
    chunks.push(binary);
  }
  return btoa(chunks.join(""));
}

// ─── Gemini API helper ───────────────────────────────────────────────────────

const OCR_INLINE_LIMIT = 3 * 1024 * 1024; // 3MB for inline (full PDF) OCR
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt: string, pdfBase64?: string, label?: string, maxTokens = 8000): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const parts: unknown[] = [];
  if (pdfBase64) {
    parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
  }
  parts.push({ text: prompt });

  const controller = new AbortController();
  // 55s timeout — keeps us under Supabase's 60s edge function wall-clock limit.
  // Gemini OCR for a single PDF page typically responds in 5–25s.
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const resp = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        // Per-page OCR: 8k tokens (enough for 15-20 vehicles as JSON).
        // Full-PDF and text-chunk callers override via maxTokens param.
        generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini ${resp.status}: ${errText.substring(0, 300)}`);
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const finishReason = data.candidates?.[0]?.finishReason ?? "unknown";
    if (finishReason === "MAX_TOKENS") {
      console.warn(`[parse-run-list] ⚠️ Gemini hit token limit${label ? ` (${label})` : ""} — response may be truncated. Length=${text.length}`);
    }
    const preview = text.substring(0, 400).replace(/\n/g, "\\n");
    console.log(`[parse-run-list] 🤖 Gemini response${label ? ` (${label})` : ""}: ${text.length} chars, finish=${finishReason}, preview: ${preview}`);
    return text;

  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Gemini timed out${label ? ` for ${label}` : ""}`);
    }
    throw err;
  }
}

// ─── OCR a single-page / full PDF via Gemini ────────────────────────────────

async function ocrSinglePagePdf(pageBytes: Uint8Array, label: string, vendorHint?: PdfVendor): Promise<VehicleBlock[]> {
  const sizeMB = (pageBytes.length / 1024 / 1024).toFixed(2);
  console.log(`[parse-run-list] 📸 Gemini OCR: ${label} (${sizeMB}MB)`);
  const base64 = uint8ToBase64(pageBytes);
  const vendorLine = vendorHint && vendorHint !== "unknown" ? `Likely source: ${vendorHint}.` : "";
  try {
    const content = await callGemini(
      `You are reading an auction run list PDF (${label}). It may be from Manheim, ADESA, CarMax Auctions, Americas Auto Auction, IAAI (Insurance Auto Auctions), or any other auction house. ${vendorLine}

This PDF may use one of these common layouts:

1. MANHEIM/ADESA style — tabular: PHOTO | LANE/RUN | LOCATION | CR | ODO | COLOR | MMR | VIN
   Example: lane=4, run=64, year=2011, make=HONDA, model=ACCORD, trim=EX-L, cr=2.0, mileage=145154, mmr=4125, vin=5KBCP3F89BB002438

2. CARMAX AUCTIONS style — each vehicle on ONE line:
   RUN# YEAR MAKE MODEL TRIM MILEAGE DRIVE•TRANS•ENGINE VIN COLOR LOCATION
   Where RUN# is like "A/155" or "C/59". No CR score, no MMR value.
   Example: A/155 2003 Acura MDX Touring 167,519 4WD • Automatic • 3.5L 2HNYD186X3H510923 Blue Laurel
   lane = letter before slash ("A"), run_order = number after slash (155).

3. AMERICAS AUTO AUCTION / generic presale style — tabular columns may include:
   Run Number | Year | Make | Model | Style (trim) | Odometer | CR (Yes/No flag — ignore) | Grade (numeric CR score like 2.7) | Lane | VIN | Announcements
   Run Number may look like "B-0001" — run_order = the integer part (1). No MMR/price columns — set mmr_value=null.
   Grade is the real condition score (1.0–5.0). CR column is just a Yes/No flag — ignore it for cr_score.

4. IAAI / IAA (Insurance Auto Auctions) style — salvage/total-loss vehicles. Columns typically:
   Lot# | Year | Make | Model | Series (trim) | Odometer | Primary Damage | Loss Type | Title Type | Current Bid | Buy Now | Est. Retail Value | VIN | Location (contains lane+run like "B - #47")
   No CR score (salvage vehicles have no condition report) — set cr_score=null.
   Map lot/stock number to lot_number (NOT run_order). The lane letter and run sequence number appear in the location/sale-info block as e.g. "B - #47" (lane=B, run_order=47) or "A - #45" (lane=A, run_order=45).
   Map "Primary Damage" to damage_location. Map "Loss Type" to damage_type.
   Map "Title Type" to title_status (e.g. "Salvage", "Clear", "Certificate of Destruction").
   Map "Current Bid" to current_bid. Map "Buy Now" to buy_now. Map "Est. Retail Value" or the dollar-value shown as price_estimate.
   Example: lane="B", run_order=47, lot_number="44401165", year=2021, make=ACURA, model=ILX, trim=STANDARD, mileage=73181, damage_location="Left Side", damage_type="Collision", title_status="Salvage", current_bid=null, buy_now=4350, price_estimate=17513, vin="19UDE2F32MA******"

For EACH vehicle extract:
- "lane", "run_order" (integer), "lot_number" (string or null), "year" (integer), "make", "model", "trim" (null if absent)
- "mileage" (integer, no commas), "cr_score" (decimal or null), "mmr_value" (integer or null)
- "buy_now" (integer or null), "current_bid" (integer or null), "price_estimate" (integer or null)
- "vin" (17 chars), "color" (null if absent)
- "title_status" (null if absent — e.g. "Salvage", "Clear", "Certificate of Destruction")
- "damage_location" (null if absent — e.g. "Front End", "Left Side", "Rear", "All Over", "Normal Wear")
- "damage_type" (null if absent — e.g. "Collision", "Other", "Normal Wear & Tear")
- "drive_condition" (null if absent — e.g. "Run & Drive", "Starts", "No Start")
- "body_condition" (null if absent — e.g. "Intact", "Deployed" for airbags)
- "key_status" (null if absent — e.g. "Key Available", "No Key")
- "condition_notes" (brief summary of remaining announcements not captured above, or null)

Return ONLY a JSON array. Use null for missing fields. Extract ALL vehicles.`,
      base64, label, 16000,
    );
    const blocks = await extractVehiclesFromOcrContent(content, async () => {
      return await callGemini(
        `Read this auction run list PDF (${label}) and transcribe every vehicle. ${vendorLine}\nOne per line:\nLANE/RUN | YEAR MAKE MODEL TRIM | CR | MILEAGE | COLOR | MMR | VIN | TITLE\n\nManheim: 4/64 | 2011 HONDA ACCORD EX-L | 2.0 | 145154 | WHITE | 4125 | 5KBCP3F89BB002438 | null\nCarMax:  A/155 | 2003 ACURA MDX Touring | null | 167519 | Blue | null | 2HNYD186X3H510923 | null\nIAAI:    A/47 | 2019 FORD F-150 XLT | null | 45000 | null | 8500 | 1FTEW1E55KFA12345 | Salvage | lot=44789294\n(CarMax and IAAI have no CR — use null. For IAAI: LANE is the lane letter (A/B/C or null), RUN is the run sequence number (or null), append lot=<Stock#>. TITLE is the Title/Title Type field — "Salvage" or "Clear".)\n\nDo NOT skip any vehicles.`,
        base64,
        `${label}-text-fallback`,
        4000,
      );
    });
    console.log(`[parse-run-list] 📸 Gemini OCR (${label}): ${blocks.length} vehicles`);
    return blocks;
  } catch (err) {
    console.error(`[parse-run-list] 📸 Gemini OCR failed for ${label}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── OCR a specific page from a full PDF via Gemini ─────────────────────────

async function ocrSpecificPage(fullPdfBytes: Uint8Array, pageIndex: number, vendorHint?: PdfVendor): Promise<VehicleBlock[]> {
  const pageNum = pageIndex + 1;

  // Try extracting a single-page PDF with pdf-lib (smaller payload → faster OCR).
  // If pdf-lib can't parse the file (CIDFont, non-standard encoding, IAA-style PDFs),
  // fall back to sending the full PDF with a page-specific instruction — Gemini handles
  // multi-page PDFs natively and can be told which page to focus on.
  let pdfToSend: Uint8Array;
  let isSinglePageExtract = false;

  try {
    const pagePdfBytes = await extractPdfPage(fullPdfBytes, pageIndex);
    pdfToSend = pagePdfBytes;
    isSinglePageExtract = true;
    const sizeMB = (pagePdfBytes.length / 1024 / 1024).toFixed(2);
    console.log(`[parse-run-list] 📸 Gemini OCR page ${pageNum} from extracted ${sizeMB}MB single-page PDF`);
  } catch (extractErr) {
    console.warn(
      `[parse-run-list] 📸 pdf-lib extraction failed for page ${pageNum} — falling back to full-PDF OCR:`,
      extractErr instanceof Error ? extractErr.message : extractErr,
    );
    // Gemini inline limit is ~20MB. Use 18MB as a safe threshold.
    const FULL_PDF_INLINE_MAX = 18 * 1024 * 1024;
    if (fullPdfBytes.length > FULL_PDF_INLINE_MAX) {
      console.error(
        `[parse-run-list] 📸 Full PDF (${(fullPdfBytes.length / 1024 / 1024).toFixed(1)}MB) exceeds inline limit — skipping page ${pageNum}`,
      );
      return [];
    }
    pdfToSend = fullPdfBytes;
    console.log(`[parse-run-list] 📸 Sending full PDF (${(fullPdfBytes.length / 1024 / 1024).toFixed(2)}MB) targeting page ${pageNum}`);
  }

  const label = isSinglePageExtract ? `page-${pageNum}` : `full-pdf-page-${pageNum}`;
  const base64 = uint8ToBase64(pdfToSend);
  const vendorLine = vendorHint && vendorHint !== "unknown" ? `Likely source: ${vendorHint}.` : "";
  // When sending the full PDF, explicitly tell Gemini which page to focus on.
  const pageScope = isSinglePageExtract
    ? `You are reading page ${pageNum} of an auction run list PDF.`
    : `You are reading an auction run list PDF. Extract vehicles ONLY from page ${pageNum} — skip all other pages entirely.`;
  try {
    const content = await callGemini(
      `${pageScope} It may be from any auction house — Manheim, ADESA, CarMax Auctions, Americas Auto Auction, IAAI (Insurance Auto Auctions), or similar. ${vendorLine}

This PDF may use one of these common layouts:

1. MANHEIM/ADESA style — tabular columns: PHOTO | LANE/RUN | LOCATION | CR | ODO | COLOR | MMR | VIN | QR
   Example row: lane=4, run=64, year=2011, make=HONDA, model=ACCORD, trim=SEDAN EX-L, cr=2.0, mileage=145154, color=WHITE, mmr=4125, vin=5KBCP3F89BB002438

2. CARMAX AUCTIONS style — each vehicle on ONE line with this column order:
   RUN#  YEAR  MAKE  MODEL  TRIM  MILEAGE  DRIVE•TRANS•ENGINE  VIN  COLOR  LOCATION
   Where RUN# looks like "A/155" or "C/59" (letter/number).
   Example row: A/155 2003 Acura MDX Touring 167,519 4WD • Automatic • 3.5L 2HNYD186X3H510923 Blue Laurel
   In CarMax format there is NO cr_score and NO mmr_value — set those to null.
   The lane is the letter before the slash (e.g. "A"), run_order is the number after (e.g. 155).

3. AMERICAS AUTO AUCTION / generic presale style — tabular with columns like:
   Run Number | Year | Make | Model | Style (trim) | Odometer | Grade (CR numeric 1–5) | Lane | VIN | Announcements
   Run Number may look like "B-0001" — use only the integer part as run_order (e.g. 1). No price/MMR columns — set mmr_value=null.
   "Grade" is the numeric condition score. A separate "CR" column may be Yes/No — ignore it for cr_score.

4. IAAI / IAA (Insurance Auto Auctions) style — salvage/total-loss vehicles. Layout: each vehicle has a lot/stock number, year/make/model, mileage, condition info, and a location block that shows the lane and run number in format "B - #47" (lane=B, run_order=47) or "A - #45" (lane=A, run_order=45).
   No CR score — set cr_score=null. Map lot/stock number to lot_number (NOT run_order).
   Map "Primary Damage" to damage_location. Map "Loss Type" to damage_type (e.g. "Collision", "Other").
   Map "Title Type" to title_status (e.g. "Salvage", "Clear"). Map "Current Bid" to current_bid. Map "Buy Now" to buy_now. Map the retail/estimated value to price_estimate.
   Example row: lot_number="44401165", lane="B", run_order=47, year=2021, make=ACURA, model=ILX, trim=STANDARD, mileage=73181, damage_location="Left Side", damage_type="Collision", title_status="Salvage", buy_now=4350, price_estimate=17513, vin="19UDE2F32MA******"

For EACH vehicle row on this page, return a JSON object with:
- "lane": lane letter (e.g. "A", "B", "C") — extract from "X - #N" pattern; null if absent
- "run_order": run sequence number as integer (e.g. 47, 139) — extract from "X - #N" pattern; null if absent
- "lot_number": lot or stock number as string (e.g. "44401165" for IAAI) — null for non-IAAI
- "year": model year as integer (e.g. 2003)
- "make": manufacturer (e.g. "ACURA")
- "model": model name (e.g. "MDX")
- "trim": trim level (e.g. "Touring") — null if absent
- "mileage": odometer as integer, no commas (e.g. 167519)
- "cr_score": condition score as decimal or null (null for IAAI and CarMax)
- "mmr_value": MMR/wholesale value as integer or null (Manheim/ADESA only)
- "buy_now": Buy Now price as integer or null (IAAI)
- "current_bid": Current Bid as integer or null (IAAI)
- "price_estimate": estimated retail value as integer or null (IAAI Est. Retail Value)
- "vin": 17-character VIN
- "color": exterior color (e.g. "Blue") — null if absent
- "title_status": title type if present (e.g. "Salvage", "Clear") — null if absent
- "damage_location": primary damage location (e.g. "Front End", "Left Side", "Rear", "All Over") — null if absent
- "damage_type": damage cause (e.g. "Collision", "Other", "Normal Wear & Tear") — null if absent
- "drive_condition": drivability (e.g. "Run & Drive", "Starts", "No Start") — null if absent
- "body_condition": body/airbag state (e.g. "Intact", "Deployed") — null if absent
- "key_status": key presence (e.g. "Key Available", "No Key") — null if absent
- "condition_notes": brief summary of remaining announcements not captured above — null if absent

Return ONLY a valid JSON array. Do NOT include vehicles from other pages. Use null for missing fields. Extract ALL vehicles — do not skip any.`,
      base64, label,
    );
    const blocks = await extractVehiclesFromOcrContent(content, async () => {
      return await callGemini(
        `${pageScope} (Manheim, ADESA, CarMax, or IAAI). ${vendorLine}

Transcribe EVERY vehicle row as plain text — one vehicle per line:
LANE/RUN | YEAR MAKE MODEL TRIM | CR | MILEAGE | COLOR | MMR | VIN | TITLE

Manheim example: 4/64 | 2011 HONDA ACCORD SEDAN EX-L | 2.0 | 145154 | WHITE | 4125 | 5KBCP3F89BB002438 | null
CarMax example:  A/155 | 2003 ACURA MDX Touring | null | 167519 | Blue | null | 2HNYD186X3H510923 | null
IAAI example:    A/47 | 2019 FORD F-150 XLT | null | 45000 | null | 8500 | 1FTEW1E55KFA12345 | Salvage | lot=44789294

(CarMax and IAAI have no CR score — use null. IAAI: LANE is lane letter (A/B/C) or null, RUN is run sequence number or null; append lot=<Stock#>. TITLE = Title/Title Type, e.g. "Salvage" or "Clear". null if not shown.)

Do NOT skip any vehicle. Do NOT include vehicles from other pages.`,
        base64,
        `${label}-text-fallback`,
      );
    });
    console.log(`[parse-run-list] 📸 Gemini OCR ${label}: ${blocks.length} vehicles`);
    return blocks;
  } catch (err) {
    console.error(`[parse-run-list] 📸 Gemini OCR ${label} failed:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── AI text analysis (for text-based PDFs where regex fails) ────────────────

async function parseWithAIText(pdfText: string, vendorHint: PdfVendor): Promise<VehicleBlock[]> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    console.warn("[parse-run-list] ⚠️ GEMINI_API_KEY not configured — AI text parsing unavailable");
    return [];
  }

  const maxChunkChars = 24000;
  const overlapChars = 1500;
  const normalizedText = pdfText.replace(/\u0000/g, " ");
  const chunks: string[] = [];

  for (let start = 0; start < normalizedText.length; ) {
    let end = Math.min(start + maxChunkChars, normalizedText.length);
    if (end < normalizedText.length) {
      const candidateBreaks = [
        normalizedText.lastIndexOf("\n\n", end),
        normalizedText.lastIndexOf("\n", end),
        normalizedText.lastIndexOf(" VIN ", end),
      ];
      const bestBreak = Math.max(...candidateBreaks);
      if (bestBreak > start + Math.floor(maxChunkChars * 0.6)) {
        end = bestBreak;
      }
    }

    const chunk = normalizedText.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalizedText.length) break;
    start = Math.max(end - overlapChars, start + 1);
  }

  console.log(
    `[parse-run-list] 🤖 Gemini text parsing: ${normalizedText.length} chars across ${chunks.length} chunk(s)`,
  );

  const mergedBlocks: VehicleBlock[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    try {
      const content = await callGemini(
        `You are an expert auction run list parser. Extract ALL vehicles from this text segment (${index + 1}/${chunks.length}). Return ONLY a JSON array with these fields (use null if missing): lane, run_order, lot_number, year, make, model, trim, mileage, cr_score, mmr_value, buy_now, current_bid, price_estimate, vin, title_status, damage_location, damage_type, drive_condition, body_condition, key_status, condition_notes. The text may come from Manheim, ADESA, CarMax, Americas Auto Auction, IAAI/IAA, or any auction house. Likely source: ${vendorHint}. For IAAI: no cr_score; extract lane (e.g. "A","B","C") and run sequence number into lane/run_order if present (null if absent); map Stock# to lot_number (string); map Current Bid→current_bid, Buy Now→buy_now, Est. Retail Value→price_estimate; map Primary Damage→damage_location, Loss Type→damage_type, start/drive condition→drive_condition, airbag state→body_condition, keys→key_status; map "Title" or "Title Type"→title_status (e.g. "Salvage", "Clear").\n\nText:\n${chunk}`,
        undefined,
        `text-chunk-${index + 1}`,
        16000,
      );
      const blocks = parseOCRJsonToBlocks(content);
      for (const block of blocks) {
        const key = block.vin
          ? `vin:${block.vin}`
          : [
              block.lane ? `lane:${norm(block.lane)}` : "",
              block.run_order != null ? `run:${block.run_order}` : "",
              block.year != null ? `year:${block.year}` : "",
              block.make ? `make:${norm(block.make)}` : "",
              block.model ? `model:${norm(block.model)}` : "",
              block.mileage != null ? `mi:${block.mileage}` : "",
            ].filter(Boolean).join("|");

        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        mergedBlocks.push(block);
      }
    } catch (err) {
      console.error(
        `[parse-run-list] 🤖 Gemini text parsing chunk ${index + 1} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`[parse-run-list] 🤖 Gemini text parsing: ${mergedBlocks.length} vehicles extracted`);
  return mergedBlocks;
}

// ─── Manheim-style block parser ──────────────────────────────────────────────

interface VehicleBlock {
  lane: string | null; run_order: number | null; lot_number?: string | null;
  year: number | null; make: string | null; model: string | null; trim: string | null;
  mileage: number | null; cr_score: number | null; mmr_value: number | null;
  buy_now: number | null; current_bid: number | null; price_estimate?: number | null;
  vin: string | null; condition_notes: string | null; title_status?: string | null;
  damage_location?: string | null; damage_type?: string | null;
  drive_condition?: string | null; body_condition?: string | null; key_status?: string | null;
}

type PdfVendor = "manheim" | "adesa" | "carmax" | "iaai" | "unknown";

function parseYearMakeModel(raw: string): { year: number | null; make: string | null; model: string | null; trim: string | null } {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return { year: null, make: null, model: null, trim: null };

  const year = parseInt(yearMatch[0], 10);
  const afterYear = cleaned.slice(cleaned.indexOf(yearMatch[0]) + yearMatch[0].length).trim();
  const words = afterYear.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { year, make: null, model: null, trim: null };

  const make = words[0] ?? null;
  const remaining = words.slice(1);
  let model: string | null = null;
  let trim: string | null = null;

  if (remaining.length === 1) model = remaining[0];
  else if (remaining.length > 1) {
    trim = remaining[remaining.length - 1];
    model = remaining.slice(0, -1).join(" ") || remaining[0];
  }

  return { year, make, model, trim };
}

function normalizeAuctionVin(raw: unknown): string | null {
  const cleaned = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9*]/g, "");
  if (!cleaned) return null;
  const alphaNumLength = cleaned.replace(/\*/g, "").length;
  if (alphaNumLength < 10) return null;
  return cleaned.slice(0, 17);
}

function coerceVehicleBlock(entry: any): VehicleBlock | null {
  if (!entry || typeof entry !== "object") return null;

  const descriptor = [entry.vehicle, entry.description, entry.title, entry.name, entry.vehicle_name]
    .find((value: unknown) => typeof value === "string" && value.trim()) as string | undefined;
  const parsedDescriptor = descriptor
    ? parseYearMakeModel(descriptor)
    : { year: null, make: null, model: null, trim: null };

  const laneRunRaw = [entry.lane_run, entry.laneRun, entry["lane/run"], entry["LANE/RUN"], entry.run, entry.lane_run_number]
    .find((value: unknown) => typeof value === "string" && value.trim()) as string | undefined;
  const laneRunMatch = laneRunRaw?.match(/(\d{1,3})\s*\/\s*(\d{1,4})/);

  const year = parseInt(String(entry.year ?? entry.model_year ?? entry.Year ?? entry.YEAR ?? parsedDescriptor.year ?? ""), 10) || null;
  const make = String(entry.make ?? entry.manufacturer ?? entry.Make ?? entry.MAKE ?? parsedDescriptor.make ?? "").trim() || null;
  const model = String(entry.model ?? entry.Model ?? entry.MODEL ?? parsedDescriptor.model ?? "").trim() || null;
  const trim = String(entry.trim ?? entry.series ?? entry.Trim ?? entry.TRIM ?? entry.body_style ?? entry.bodyStyle ?? parsedDescriptor.trim ?? "").trim() || null;
  const lane = String(entry.lane ?? entry.lane_number ?? entry.laneNumber ?? entry.Lane ?? entry.LANE ?? laneRunMatch?.[1] ?? "").trim() || null;
  const runOrder = parseInt(String(entry.run_order ?? entry.runOrder ?? entry.run_number ?? entry.runNumber ?? entry.Run ?? entry.RUN ?? laneRunMatch?.[2] ?? ""), 10) || null;
  const mileage = parseInt(String(entry.mileage ?? entry.odometer ?? entry.miles ?? entry.odo ?? entry.Mileage ?? entry.ODO ?? entry.Odometer ?? "").replace(/[^0-9]/g, ""), 10) || null;
  const crScore = parseFloat(String(entry.cr_score ?? entry.cr ?? entry.CR ?? entry.condition_report ?? entry.condition ?? entry.grade ?? "").replace(/[^0-9.]/g, "")) || null;
  const mmrValue = parseFloat(String(entry.mmr_value ?? entry.mmr ?? entry.MMR ?? entry.price ?? entry.value ?? "").replace(/[^0-9.]/g, "")) || null;
  const buyNow = parseFloat(String(entry.buy_now ?? entry.buyNow ?? entry.buy_now_price ?? entry.buyNowPrice ?? entry.buy_it_now ?? entry.buyItNow ?? "").replace(/[^0-9.]/g, "")) || null;
  const currentBid = parseFloat(String(entry.current_bid ?? entry.currentBid ?? entry.current_bid_amount ?? entry.currentBidAmount ?? entry.bid ?? "").replace(/[^0-9.]/g, "")) || null;
  const priceEstimate = parseFloat(String(entry.price_estimate ?? entry.priceEstimate ?? entry.estimated_retail_value ?? entry.estimatedRetailValue ?? entry.estimated_value ?? "").replace(/[^0-9.]/g, "")) || null;
  const vin = normalizeAuctionVin(entry.vin ?? entry.VIN ?? entry.vehicle_vin ?? entry.vin_number);

  // Accept if we have at least year+make, or a VIN
  if (!year && !make && !vin) return null;
  if (!year && !vin) return null;

  const lotNumber = String(entry.lot_number ?? entry.lotNumber ?? entry.lot_num ?? entry.lotNum ?? entry.lot ?? entry.Lot ?? entry.stock_number ?? entry.stockNumber ?? entry.stock ?? entry.Stock ?? "").trim() || null;
  const conditionNotes = String(entry.condition_notes ?? entry.announcements ?? entry.notes ?? "").trim() || null;
  const titleStatus = String(entry.title_status ?? entry.titleStatus ?? entry.title_type ?? entry.titleType ?? entry.title ?? entry.Title ?? "").trim() || null;
  const damageLocation = String(entry.damage_location ?? entry.damageLocation ?? entry.primary_damage ?? entry.primaryDamage ?? entry.damage ?? "").trim() || null;
  const damageType = String(entry.damage_type ?? entry.damageType ?? entry.loss_type ?? entry.lossType ?? "").trim() || null;
  const driveCondition = String(entry.drive_condition ?? entry.driveCondition ?? entry.starts ?? entry.start_code ?? entry.startCode ?? "").trim() || null;
  const bodyCondition = String(entry.body_condition ?? entry.bodyCondition ?? entry.airbags ?? "").trim() || null;
  const keyStatus = String(entry.key_status ?? entry.keyStatus ?? entry.keys ?? entry.key_available ?? entry.keyAvailable ?? "").trim() || null;

  return {
    lane,
    run_order: runOrder,
    ...(lotNumber ? { lot_number: lotNumber } : {}),
    year,
    make,
    model,
    trim,
    mileage,
    cr_score: crScore,
    mmr_value: mmrValue,
    buy_now: buyNow,
    current_bid: currentBid,
    price_estimate: priceEstimate,
    vin,
    condition_notes: conditionNotes,
    ...(titleStatus ? { title_status: titleStatus } : {}),
    ...(damageLocation ? { damage_location: damageLocation } : {}),
    ...(damageType ? { damage_type: damageType } : {}),
    ...(driveCondition ? { drive_condition: driveCondition } : {}),
    ...(bodyCondition ? { body_condition: bodyCondition } : {}),
    ...(keyStatus ? { key_status: keyStatus } : {}),
  };
}

function detectPdfVendor(pdfText: string, rawLatin1: string, filePath?: string): PdfVendor {
  const lowerPath = (filePath ?? "").toLowerCase();
  const lowerText = `${pdfText}\n${rawLatin1}`.toLowerCase();

  if (lowerPath.includes("carmax") || lowerText.includes("carmax")) return "carmax";
  if (lowerPath.includes("manheim") || lowerText.includes("manheim")) return "manheim";
  if (lowerPath.includes("adesa") || lowerText.includes("adesa")) return "adesa";
  if (
    lowerPath.includes("iaai") || lowerPath.includes("iaa") ||
    lowerText.includes("insurance auto") || lowerText.includes("iaai") ||
    lowerText.includes("iaa.com") || lowerText.includes("loss type") ||
    lowerText.includes("primary damage") || lowerText.includes("sale list for") ||
    // IAA sale list PDFs often have these structural keywords
    (lowerText.includes("buy now") && lowerText.includes("salvage")) ||
    (lowerText.includes("buy now") && lowerText.includes("loss type")) ||
    (lowerText.includes("buy now") && (lowerPath.includes("iaa") || lowerPath.includes("sales list")))
  ) return "iaai";
  return "unknown";
}

function parseLaneRunToken(text: string): { lane: string | null; run_order: number | null } {
  const patterns: Array<{ regex: RegExp; laneIndex: number; runIndex: number }> = [
    { regex: /\blane\s*([A-Z0-9]{1,3})\s*(?:run|r)\s*(\d{1,4})\b/i, laneIndex: 1, runIndex: 2 },
    { regex: /\b(?:run|r)\s*(\d{1,4})\s*lane\s*([A-Z0-9]{1,3})\b/i, laneIndex: 2, runIndex: 1 },
    // IAA format: "B - #47" (lane letter, dash, hash, run number)
    { regex: /\b([A-Z])\s*-\s*#(\d{1,4})\b/, laneIndex: 1, runIndex: 2 },
    { regex: /\b([A-Z])\s*[\/-]\s*(\d{1,4})\b/, laneIndex: 1, runIndex: 2 },
    { regex: /\b(\d{1,3})\s*[\/-]\s*(\d{1,4})\b/, laneIndex: 1, runIndex: 2 },
  ];

  for (const { regex, laneIndex, runIndex } of patterns) {
    const match = text.match(regex);
    if (!match) continue;
    const lane = match[laneIndex]?.trim() ?? null;
    const run = parseInt(match[runIndex] ?? "", 10);
    return {
      lane: lane || null,
      run_order: Number.isFinite(run) ? run : null,
    };
  }

  return { lane: null, run_order: null };
}

function parseIaaSaleListBlocks(text: string): VehicleBlock[] {
  const lower = text.toLowerCase();
  // More flexible IAA signal detection — look for any combination of known IAA patterns
  const iaaSignals =
    (lower.includes("sale list for") && lower.includes("iaa")) ||
    lower.includes("iaa united states") ||
    lower.includes("insurance auto auction") ||
    lower.includes("insurance auto auctions") ||
    (lower.includes("buy now") && lower.includes("pre-bid")) ||
    (lower.includes("buy now") && lower.includes("salvage")) ||
    (lower.includes("buy now") && lower.includes("loss type")) ||
    (lower.includes("primary damage") && lower.includes("lot")) ||
    (lower.includes("run & drive") && lower.includes("lot")) ||
    (lower.includes("key available") && (lower.includes("salvage") || lower.includes("lot")));
  if (!iaaSignals) return [];

  const lines = text
    .replace(/\u0000/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    // IAA image alt-text occasionally gets concatenated onto the vehicle header line
    // e.g. "Vehicle image 2008 CHEVROLET IMPALA LTZ" — strip the prefix so the header matches
    .map((line) => line.replace(/^Vehicle image\s+/i, ""))
    .filter(Boolean);

  // Case-insensitive header pattern — IAA PDF text extraction may yield mixed case
  const headerPattern = /^(19|20)\d{2}\s+[A-Za-z0-9][A-Za-z0-9&().\/-]*(?:\s+[A-Za-z0-9][A-Za-z0-9&().\/-]*)+$/;
  const titlePattern = /^(salvage|clear|certificate of destruction|rebuilt|parts only|non[-\s]?repairable|flood|junk)$/i;
  const damageTypePattern = /^(collision|other|normal wear(?:\s*&\s*tear)?|biohazard|fire|flood|hail|mechanical|minor dent\/scratches|theft|water\/flood)$/i;
  const drivePattern = /^(run\s*&\s*drive|run and drive|starts|stationary|not run|no start)$/i;
  const bodyPattern = /^(intact|deployed|none)$/i;
  const keyPattern = /^(key available|keys available|no key)$/i;
  const noisePattern = /^(view all images|iaa united states|pre-bid|or|cdt|va|\*+|join auction|add to my calendar)$/i;

  const vehicles: VehicleBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const headerLine = lines[i];
    if (!headerPattern.test(headerLine)) continue;

    const parsed = parseYearMakeModel(headerLine);
    if (!parsed.year || !parsed.make) continue;

    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (headerPattern.test(lines[j])) {
        end = j;
        break;
      }
    }
    const blockLines = lines.slice(i, end);
    const blockText = blockLines.join("\n");

    const lotNumber = blockLines.find((line) => /^\d{6,9}$/.test(line)) ?? null;
    const laneRun = parseLaneRunToken(blockText);

    const mileageMatch = blockText.match(/\b(\d{1,3}(?:,\d{3})+|\d{4,7})\s*mi\b/i);
    const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, ""), 10) || null : null;

    const vinCandidates = blockText.match(/\b[A-HJ-NPR-Z0-9*]{11,17}\b/gi) ?? [];
    const vin = vinCandidates.map((candidate) => normalizeAuctionVin(candidate)).find(Boolean) ?? null;

    const buyNowMatch = blockText.match(/buy\s*now\s*\$\s*([\d,]+)/i);
    const currentBidMatch = blockText.match(/current\s*bid\s*\$\s*([\d,]+)/i);
    const buyNow = buyNowMatch ? parseInt(buyNowMatch[1].replace(/,/g, ""), 10) || null : null;
    const currentBid = currentBidMatch ? parseInt(currentBidMatch[1].replace(/,/g, ""), 10) || null : null;

    const usdValues = [...blockText.matchAll(/\$\s*([\d,]+)\s*USD/gi)]
      .map((match) => parseInt(match[1].replace(/,/g, ""), 10))
      .filter((value) => Number.isFinite(value));
    const priceEstimate = usdValues.length > 0 ? Math.max(...usdValues) : null;

    const statusTitle = blockLines.find((line) => titlePattern.test(line)) ?? null;
    const damageType = blockLines.find((line) => damageTypePattern.test(line)) ?? null;
    const driveCondition = blockLines.find((line) => drivePattern.test(line)) ?? null;
    const bodyCondition = blockLines.find((line) => bodyPattern.test(line)) ?? null;
    const keyStatus = blockLines.find((line) => keyPattern.test(line)) ?? null;

    const statusCandidates = blockLines.filter((line) => {
      if (line === headerLine || noisePattern.test(line)) return false;
      if (/^\d{6,9}$/.test(line)) return false;
      if (/^\$/.test(line) || /\bUSD\b/i.test(line)) return false;
      if (/\b(19|20)\d{2}\b/.test(line)) return false;
      if (/\b\d{1,3}(?:,\d{3})+\s*mi\b/i.test(line)) return false;
      if (/\b[A-HJ-NPR-Z0-9*]{11,17}\b/i.test(line)) return false;
      if (/\b(?:Tue|Mon|Wed|Thu|Fri|Sat|Sun)\b/i.test(line)) return false;
      return true;
    });

    const damageLocation = statusCandidates.find((line) => {
      if (line === statusTitle || line === damageType || line === driveCondition || line === bodyCondition || line === keyStatus) return false;
      return line.length >= 3 && line.length <= 40;
    }) ?? null;

    if (!parsed.year || !parsed.make) continue;
    // Accept if we have either a lot number OR a VIN (IAA may have partial VINs with ***)
    if (!lotNumber && (!vin || vin.length < 10)) continue;

    vehicles.push({
      lane: laneRun.lane,
      run_order: laneRun.run_order,
      ...(lotNumber ? { lot_number: lotNumber } : {}),
      year: parsed.year,
      make: parsed.make,
      model: parsed.model,
      trim: parsed.trim,
      mileage,
      cr_score: null,
      mmr_value: null,
      buy_now: buyNow,
      current_bid: currentBid,
      price_estimate: priceEstimate,
      vin,
      condition_notes: null,
      ...(statusTitle ? { title_status: statusTitle } : {}),
      ...(damageLocation ? { damage_location: damageLocation } : {}),
      ...(damageType ? { damage_type: damageType } : {}),
      ...(driveCondition ? { drive_condition: driveCondition } : {}),
      ...(bodyCondition ? { body_condition: bodyCondition } : {}),
      ...(keyStatus ? { key_status: keyStatus } : {}),
    });

    i = end - 1;
  }

  if (vehicles.length > 0) {
    console.log(`[parse-run-list] 📊 IAA sale-list parser: ${vehicles.length} vehicles`);
  }

  return vehicles;
}

function parseAdesaBlocks(text: string): VehicleBlock[] {
  // ADESA run lists are tabular with each vehicle on one line:
  //   "F 1   08   DODGE   CHARGER BASE   4   4DR   5.7L V8   32276 M   WHITE   2B3KA43H18H298663   GTB"
  // Year can be 2-digit (08 → 2008) or 4-digit (2008). Long model names sometimes wrap to a 2nd line,
  // so the VIN-bearing line can be missing the header — we pre-index headers and link each VIN to the
  // most recent header within a larger window.
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const vehicles: VehicleBlock[] = [];
  const seenVins = new Set<string>();

  const skipRe = /^(OPTIONS|ANOUNCEMENT|ANNOUNCEMENT|ALTERED|Printed On|Run\s*#|LOCATION|AUCTION DATE|Auction Type|Total Vehicles|Run Lists are)/i;
  const vinRegex = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
  // Multi-space separated header — accepts both 2-digit and 4-digit years:
  // "[Lane] [Run]   [YY or YYYY]   [MAKE]   [Model...]"
  const headerRe = /^([A-Z])\s+(\d{1,4})\s+((?:19|20)?\d{2})\s+([A-Z][A-Z0-9&.\-]*)\s+(.+?)(?=\s{2,}[A-Z0-9]|\s+\d{1,3}(?:,\d{3})*\s*M)/i;
  // Single-space variant for tight layouts
  const headerReCompact = /^([A-Z])\s+(\d{1,4})\s+((?:19|20)?\d{2})\s+([A-Z][A-Z0-9&.\-]*)\s+([A-Z0-9 ./\-]+?)(?=\s+\d+(?:DR|WD)|\s+\d{1,3}(?:,\d{3})*\s*M\b|$)/i;

  type AdesaHeader = { idx: number; lane: string; run_order: number; year: number; make: string; model: string };
  const headers: AdesaHeader[] = [];

  lines.forEach((line, idx) => {
    if (skipRe.test(line)) return;
    let m = line.match(headerRe);
    if (!m) m = line.match(headerReCompact);
    if (!m) return;
    const yearRaw = parseInt(m[3], 10);
    // Normalise: if 2-digit, infer century; if 4-digit, use as-is
    let year: number;
    if (yearRaw >= 1900) {
      year = yearRaw; // already a 4-digit year
    } else if (yearRaw <= 30) {
      year = 2000 + yearRaw;
    } else {
      year = 1900 + yearRaw;
    }
    headers.push({
      idx,
      lane: m[1],
      run_order: parseInt(m[2], 10),
      year,
      make: m[4],
      model: m[5].trim().replace(/\s+/g, " "),
    });
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (skipRe.test(line)) continue;
    const vm = line.match(vinRegex);
    if (!vm) continue;
    const vin = vm[1].toUpperCase();
    if (seenVins.has(vin)) continue;
    seenVins.add(vin);

    // Most recent header at or above this line, within 10 lines (handles model-wrap + whitespace lines)
    let header: AdesaHeader | null = null;
    for (let h = headers.length - 1; h >= 0; h--) {
      if (headers[h].idx <= i && i - headers[h].idx <= 10) { header = headers[h]; break; }
    }

    // Mileage: accept both "32,276 M" and "32276" near an "M" or "mi" suffix
    const miM = line.match(/\b(\d{1,3}(?:,\d{3})+|\d{4,7})\s*(?:M|mi\b)/i);
    // Also try extracting mileage from context lines if header is on a different line
    let mileage: number | null = miM ? parseInt(miM[1].replace(/,/g, ""), 10) || null : null;
    if (mileage == null && header) {
      // Search 3 lines around the VIN line
      for (let k = Math.max(0, i - 2); k <= Math.min(lines.length - 1, i + 2); k++) {
        const m2 = lines[k].match(/\b(\d{1,3}(?:,\d{3})+|\d{4,7})\s*(?:M|mi\b)/i);
        if (m2) { mileage = parseInt(m2[1].replace(/,/g, ""), 10) || null; break; }
      }
    }

    vehicles.push({
      lane: header?.lane ?? null,
      run_order: header?.run_order ?? null,
      year: header?.year ?? null,
      make: header?.make ?? null,
      model: header?.model ?? null,
      trim: null,
      mileage,
      cr_score: null,
      mmr_value: null,
      buy_now: null,
      current_bid: null,
      price_estimate: null,
      vin,
      condition_notes: null,
    });
  }

  console.log(`[parse-run-list] 📊 ADESA parser: ${vehicles.length} vehicles`);
  return vehicles;
}

function parseVinLineBlocks(text: string): VehicleBlock[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const vehicles: VehicleBlock[] = [];
  const seenVins = new Set<string>();

  for (const line of lines) {
    const vinMatch = line.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
    if (!vinMatch) continue;
    const vin = vinMatch[1].toUpperCase();
    if (seenVins.has(vin)) continue;
    seenVins.add(vin);

    const parsed = parseYearMakeModel(line);
    if (!parsed.year) continue;

    const laneRun = parseLaneRunToken(line);
    const mileageMatch = line.match(/(\d{1,3}(?:,\d{3})+)\s*MI\b/i) || line.match(/\b(\d{4,7})\b(?=.*(?:MI|mile|odo))/i);
    const crMatch = line.match(/\b([1-5](?:\.\d)?)\b/);
    const mmrMatch = line.match(/\$\s*([\d,]+)/);

    vehicles.push({
      lane: laneRun.lane,
      run_order: laneRun.run_order,
      year: parsed.year,
      make: parsed.make,
      model: parsed.model,
      trim: parsed.trim,
      mileage: mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, ""), 10) || null : null,
      cr_score: crMatch ? parseFloat(crMatch[1]) || null : null,
      mmr_value: mmrMatch ? parseFloat(mmrMatch[1].replace(/,/g, "")) || null : null,
      buy_now: null,
      current_bid: null,
      price_estimate: null,
      vin,
      condition_notes: null,
    });
  }

  if (vehicles.length > 0) {
    console.log(`[parse-run-list] 📊 VIN line parser: ${vehicles.length} vehicles`);
  }

  return vehicles;
}

function parseOCRTextRowsToBlocks(content: string): VehicleBlock[] {
  const iaaBlocks = parseIaaSaleListBlocks(content);
  if (iaaBlocks.length > 0) return iaaBlocks;

  const lines = content
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const parsedRows: VehicleBlock[] = [];

  for (const line of lines) {
    // Must have a year; lane/run is optional
    if (!/(19|20)\d{2}/.test(line)) continue;
    // Skip header-like or meta lines
    if (/^(PHOTO|LANE|#|Page|Total|Vehicle)/i.test(line)) continue;

    const hasPipe = line.includes("|");
    const segments = hasPipe
      ? line.split("|").map(segment => segment.trim()).filter(Boolean)
      : [line];

    // Try lane/run from anywhere in line
    const laneRun = parseLaneRunToken(line);

    // Parse year/make/model from the segment containing the year, or full line
    const yearSegment = segments.find(s => /(19|20)\d{2}/.test(s)) || line;
    const parsed = parseYearMakeModel(yearSegment);
    if (!parsed.year) continue;

    const mileageMatch = line.match(/(\d{1,3}(?:,\d{3})+)\s*MI\b/i) || line.match(/\b(\d{4,7})\b(?=.*(?:MI|mile|odo))/i);
    const crMatch = line.match(/\b([1-5](?:\.\d)?)\b/);
    const mmrMatch = line.match(/\$\s*([\d,]+)/);
    const vinMatch = line.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
    // For pipe-delimited, try to get mileage from a numeric-only segment
    const mileageFromSegment = !mileageMatch && hasPipe
      ? segments.find(s => /^\d{4,7}$/.test(s.replace(/,/g, "")))
      : null;
    // lot= annotation appended by text-fallback prompt for IAAI vehicles (e.g. "lot=44789294")
    const lotAnnotation = hasPipe
      ? (segments.find(s => /^lot=\S+/i.test(s.trim()))?.replace(/^lot=/i, "").trim() ?? null)
      : null;
    // Title from last segment if it matches known values (e.g. "Salvage", "Clear")
    const lastSeg = hasPipe ? (segments.at(-1) ?? "").trim() : "";
    const titleFromSeg = /^(salvage|clear|certificate of destruction|rebuilt|flood)/i.test(lastSeg) && !/\b(19|20)\d{2}\b/.test(lastSeg)
      ? lastSeg
      : null;

    parsedRows.push({
      lane: laneRun.lane,
      run_order: laneRun.run_order,
      ...(lotAnnotation ? { lot_number: lotAnnotation } : {}),
      year: parsed.year,
      make: parsed.make,
      model: parsed.model,
      trim: parsed.trim,
      mileage: mileageMatch
        ? parseInt(mileageMatch[1].replace(/,/g, ""), 10) || null
        : mileageFromSegment ? parseInt(mileageFromSegment.replace(/,/g, ""), 10) || null : null,
      cr_score: crMatch ? parseFloat(crMatch[1]) || null : null,
      mmr_value: mmrMatch ? parseFloat(mmrMatch[1].replace(/,/g, "")) || null : null,
      buy_now: null,
      current_bid: null,
      price_estimate: null,
      vin: vinMatch ? vinMatch[1].toUpperCase() : null,
      condition_notes: null,
      ...(titleFromSeg ? { title_status: titleFromSeg } : {}),
    });
  }

  if (parsedRows.length > 0) {
    console.log(`[parse-run-list] 📸 OCR text-row parser: ${parsedRows.length} vehicles`);
    return parsedRows;
  }

  const manheimBlocks = parseManheimBlocks(content);
  if (manheimBlocks.length > 0) return manheimBlocks;

  return parseGenericVehicleBlocks(content);
}

function parseManheimBlocks(text: string): VehicleBlock[] {
  // Pre-normalize: collapse spaces within what looks like lane/run tokens so "4 64" → "4/64"
  // This handles cases where the PDF text extractor strips the slash separator.
  const normalized = text
    .replace(/\b(\d{1,3})\s+(\d{1,4})\b(?=[\s\S]{0,50}(?:19|20)\d{2})/g, (_, lane, run) => `${lane}/${run}`)
  const lines = normalized.split("\n").flatMap(l => l.split(/\s{3,}/));
  const allLines: string[] = [];
  for (const l of lines) {
    const subLines = l.split(/(?=\d{1,3}\/\d{1,4}\b)/);
    for (const sl of subLines) {
      const trimmed = sl.trim();
      if (trimmed) allLines.push(trimmed);
    }
  }

  const vehicles: VehicleBlock[] = [];
  const laneRunPattern = /^(\d{1,3})\/(\d{1,4})\b/;
  const yearPattern = /\b(19|20)\d{2}\b/;
  // Accept mileage with or without "MI" suffix — Manheim sometimes omits it
  const mileagePattern = /(\d[\d,]+)\s*(?:MI\b|miles?\b)/i;
  const mileagePatternFallback = /\b(\d{4,6})\b/; // large standalone number as mileage fallback
  const crPattern = /\b(\d\.\d)\b/;
  const mmrPattern = /\$\s*([\d,]+)/;
  const vinPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/i;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    const lrMatch = line.match(laneRunPattern);
    if (!lrMatch) continue;

    const blockLines = [line];
    // Expanded window: 25 lines (Manheim blocks can be spread across more lines)
    for (let j = i + 1; j < Math.min(i + 25, allLines.length); j++) {
      if (allLines[j].match(laneRunPattern)) break;
      blockLines.push(allLines[j]);
    }

    const blockText = blockLines.join(" ");
    const vehicle: VehicleBlock = {
      lane: lrMatch[1], run_order: parseInt(lrMatch[2], 10),
      year: null, make: null, model: null, trim: null,
      mileage: null, cr_score: null, mmr_value: null, buy_now: null, current_bid: null, vin: null, condition_notes: null,
      price_estimate: null,
    };

    const yearMatch = blockText.match(yearPattern);
    if (yearMatch) {
      vehicle.year = parseInt(yearMatch[0], 10);
      const afterYear = blockText.substring(blockText.indexOf(yearMatch[0]) + yearMatch[0].length).trim();
      const words = afterYear.split(/\s+/);
      const vehicleWords: string[] = [];
      for (const w of words) {
        if (/^\d{1,2}\/\d{1,2}/.test(w) || /^\d{5,}$/.test(w)) break;
        if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(w)) break;
        if (/\d{1,2}:\d{2}/.test(w) || vehicleWords.length >= 6) break;
        vehicleWords.push(w);
      }
      if (vehicleWords.length >= 1) vehicle.make = vehicleWords[0];
      if (vehicleWords.length >= 2) vehicle.model = vehicleWords.slice(1, -1).join(" ") || vehicleWords[1];
      if (vehicleWords.length >= 3) vehicle.trim = vehicleWords[vehicleWords.length - 1];
    }

    const crMatch = blockText.match(crPattern);
    if (crMatch) {
      const score = parseFloat(crMatch[1]);
      if (score >= 1.0 && score <= 5.0) vehicle.cr_score = score;
    }

    const miMatch = blockText.match(mileagePattern);
    if (miMatch) {
      vehicle.mileage = parseInt(miMatch[1].replace(/,/g, ""), 10);
    } else if (!vehicle.mileage && vehicle.year) {
      // Fallback: look for a large standalone number that could be mileage (3-6 digits, not year, not $)
      const fallbackMi = blockText.replace(/\$[\d,]+/g, "").match(mileagePatternFallback);
      if (fallbackMi) {
        const candidate = parseInt(fallbackMi[1], 10);
        // Reject if it looks like a year or a price (>150k)
        if (candidate > 999 && candidate < 400000 && !/^(19|20)\d{2}$/.test(fallbackMi[1])) {
          vehicle.mileage = candidate;
        }
      }
    }

    const mmrMatch = blockText.match(mmrPattern);
    if (mmrMatch) vehicle.mmr_value = parseInt(mmrMatch[1].replace(/,/g, ""), 10);

    const vinMatch = blockText.match(vinPattern);
    if (vinMatch) vehicle.vin = vinMatch[1].toUpperCase();

    if (vehicle.year && vehicle.make) vehicles.push(vehicle);
  }

  console.log(`[parse-run-list] 📊 Block parser: ${vehicles.length} vehicles`);
  return vehicles;
}

function parseCarMaxBlocks(text: string): VehicleBlock[] {
  const normalized = text
    .replace(/[|•·]/g, ' ')
    // Normalize slash-space in run tokens: "A/ 155" → "A/155"
    .replace(/([A-Z])\s*\/\s*(\d{1,4})/g, '$1/$2')
    .replace(/\s+/g, ' ')
    .trim();
  const vehicles: VehicleBlock[] = [];
  const seenVins = new Set<string>();
  // Lenient CarMax regex: drivetrain token is optional, mileage can be with or without commas
  const entryPattern = /([A-Z]\/\d{1,4})\s+((?:19|20)\d{2})\s+([A-Za-z][A-Za-z0-9&.-]*)\s+(.+?)\s+(\d{1,3}(?:,\d{3})*|\d{3,7})\s+(?:(?:2WD|4WD|AWD|FWD|RWD|4x4|All\s*Wheel|Front\s*Wheel|Rear\s*Wheel)\s+)?.*?\s+([A-HJ-NPR-Z0-9]{17})\s+([A-Za-z-]+)\s+([A-Za-z-]+)(.*?)(?=(?:[A-Z]\/\d{1,4})\s+(?:19|20)\d{2}\s|$)/gi;

  let match;
  while ((match = entryPattern.exec(normalized)) !== null) {
    const runToken = match[1];
    const year = parseInt(match[2], 10);
    const make = match[3].toUpperCase();
    const descriptor = match[4].trim();
    const mileage = parseInt(match[5].replace(/,/g, ''), 10);
    const vin = match[6].toUpperCase();
    const trailingNotes = (match[9] || '').trim();

    if (seenVins.has(vin)) continue;
    seenVins.add(vin);

    const descriptorWords = descriptor.split(/\s+/).filter(Boolean);
    let model: string | null = null;
    let trim: string | null = null;

    if (descriptorWords.length === 1) {
      model = descriptorWords[0];
    } else if (descriptorWords.length > 1) {
      model = descriptorWords.slice(0, -1).join(' ');
      trim = descriptorWords[descriptorWords.length - 1];
    }

    const [lane, runOrderRaw] = runToken.split('/');
    const conditionNotes = trailingNotes
      .replace(/\s+/g, ' ')
      .replace(/^\s*Page:\s*\d+\s+of\s+\d+\s*/i, '')
      .trim();

    vehicles.push({
      lane: lane || null,
      run_order: runOrderRaw ? parseInt(runOrderRaw, 10) || null : null,
      year: Number.isFinite(year) ? year : null,
      make,
      model,
      trim,
      mileage: Number.isFinite(mileage) ? mileage : null,
      cr_score: null,
      mmr_value: null,
      buy_now: null,
      current_bid: null,
      price_estimate: null,
      vin,
      condition_notes: conditionNotes || null,
    });
  }

  console.log(`[parse-run-list] 📊 CarMax parser: ${vehicles.length} vehicles`);
  return vehicles;
}

// ─── Generic VIN-based parser (fallback for non-Manheim formats) ────────────

function parseGenericVehicleBlocks(text: string): VehicleBlock[] {
  const vinPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;
  const yearPattern = /\b(19|20)\d{2}\b/g;
  const vehicles: VehicleBlock[] = [];
  const seenVins = new Set<string>();

  // Find all VINs and extract surrounding context
  let match;
  while ((match = vinPattern.exec(text)) !== null) {
    const vin = match[1].toUpperCase();
    if (seenVins.has(vin)) continue;
    seenVins.add(vin);

    // Get context: ~200 chars before and after the VIN
    const start = Math.max(0, match.index - 200);
    const end = Math.min(text.length, match.index + 17 + 200);
    const context = text.substring(start, end);

    const vehicle: VehicleBlock = {
      lane: null, run_order: null, year: null, make: null, model: null, trim: null,
      mileage: null, cr_score: null, mmr_value: null, buy_now: null, current_bid: null, vin, condition_notes: null,
      price_estimate: null,
    };

    // Extract year from context
    const yearMatch = context.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) vehicle.year = parseInt(yearMatch[0], 10);

    // Extract mileage
    const miMatch = context.match(/(\d[\d,]+)\s*(?:MI|miles?|mi\.?)\b/i);
    if (miMatch) vehicle.mileage = parseInt(miMatch[1].replace(/,/g, ""), 10);

    // Extract MMR/price
    const mmrMatch = context.match(/\$\s*([\d,]+)/);
    if (mmrMatch) vehicle.mmr_value = parseInt(mmrMatch[1].replace(/,/g, ""), 10);

    // CR score
    const crMatch = context.match(/\b(\d\.\d)\b/);
    if (crMatch) {
      const score = parseFloat(crMatch[1]);
      if (score >= 1.0 && score <= 5.0) vehicle.cr_score = score;
    }

    vehicles.push(vehicle);
  }

  console.log(`[parse-run-list] 📊 Generic VIN parser: ${vehicles.length} vehicles`);
  return vehicles;
}

// Try to repair and parse a potentially truncated JSON array from Gemini.
// Gemini may cut off mid-array when token limits are hit.
// Strategy: extract all complete {...} objects from the string and parse each one.
function repairAndParseJsonArray(raw: string): any[] {
  const results: any[] = [];
  // Match complete JSON objects (balanced braces)
  let depth = 0;
  let start = -1;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const objStr = raw.slice(start, i + 1);
        try {
          results.push(JSON.parse(objStr));
        } catch { /* skip malformed objects */ }
        start = -1;
      }
    }
  }
  return results;
}

function parseOCRJsonToBlocks(content: string): VehicleBlock[] {
  try {
    const sanitized = content
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    let parsed: any = null;

    // Try direct JSON.parse first (happy path)
    try {
      parsed = JSON.parse(sanitized);
    } catch {
      // Try to find a JSON object wrapper
      const objectMatch = sanitized.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        try {
          parsed = JSON.parse(objectMatch[0]);
        } catch {
          parsed = null;
        }
      }

      // Try to find a JSON array
      if (!parsed) {
        const jsonMatch = sanitized.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            // JSON array is truncated — repair by extracting complete objects
            console.log("[parse-run-list] 🔧 JSON array appears truncated, attempting repair...");
            const repaired = repairAndParseJsonArray(jsonMatch[0]);
            if (repaired.length > 0) {
              console.log(`[parse-run-list] 🔧 Repaired ${repaired.length} objects from truncated JSON`);
              parsed = repaired;
            }
          }
        }
      }

      // Last resort: repair from entire sanitized string
      if (!parsed) {
        const repaired = repairAndParseJsonArray(sanitized);
        if (repaired.length > 0) {
          console.log(`[parse-run-list] 🔧 Last-resort repair: ${repaired.length} objects`);
          parsed = repaired;
        }
      }
    }

    if (!parsed) return [];

    const arr = Array.isArray(parsed)
      ? parsed
      : parsed?.vehicles ?? parsed?.rows ?? parsed?.items ?? parsed?.results ?? parsed?.data ?? null;

    if (!Array.isArray(arr)) return [];
    return arr.map(coerceVehicleBlock).filter(Boolean);
  } catch { return []; }
}

async function extractVehiclesFromOcrContent(content: string, fallbackPromptFactory?: () => Promise<string>): Promise<VehicleBlock[]> {
  console.log(`[parse-run-list] 🔍 extractVehicles: input ${content.length} chars`);

  let blocks = parseOCRJsonToBlocks(content);
  console.log(`[parse-run-list] 🔍 extractVehicles: JSON parser → ${blocks.length} vehicles`);
  if (blocks.length > 0) return blocks;

  blocks = parseOCRTextRowsToBlocks(content);
  console.log(`[parse-run-list] 🔍 extractVehicles: text-row parser → ${blocks.length} vehicles`);
  if (blocks.length > 0) return blocks;

  if (!fallbackPromptFactory) {
    console.log(`[parse-run-list] 🔍 extractVehicles: no fallback factory, returning 0`);
    return [];
  }

  console.log(`[parse-run-list] 🔍 extractVehicles: trying text fallback prompt...`);
  const fallbackContent = await fallbackPromptFactory();

  blocks = parseOCRJsonToBlocks(fallbackContent);
  console.log(`[parse-run-list] 🔍 extractVehicles: fallback JSON parser → ${blocks.length} vehicles`);
  if (blocks.length > 0) return blocks;

  blocks = parseOCRTextRowsToBlocks(fallbackContent);
  console.log(`[parse-run-list] 🔍 extractVehicles: fallback text-row parser → ${blocks.length} vehicles`);
  return blocks;
}

// ─── Vehicle blocks to DB rows ──────────────────────────────────────────────

function blocksToRows(blocks: VehicleBlock[], runListId: string, orgId: string): Record<string, unknown>[] {
  return blocks.map(v => {
    const row: Record<string, unknown> = { run_list_id: runListId, organization_id: orgId };
    if (v.vin) row.vin = v.vin;
    if (v.year) row.year = v.year;
    if (v.make) row.make = v.make;
    if (v.model) row.model = v.model;
    if (v.trim) row.trim = v.trim;
    if (v.mileage != null) row.mileage = v.mileage;
    if (v.lane) row.lane = v.lane;
    if (v.run_order != null) row.run_order = v.run_order;
    if (v.lot_number) row.lot_number = v.lot_number;
    if (v.cr_score != null) { row.cr_score = v.cr_score; row.has_cr = true; }
    if (v.mmr_value != null) row.mmr_value = v.mmr_value;
    if (v.buy_now != null) row.buy_now = v.buy_now;
    if (v.current_bid != null) row.current_bid = v.current_bid;
    if (v.price_estimate != null) row.price_estimate = v.price_estimate;
    if (v.condition_notes) row.condition_notes = v.condition_notes;
    if (v.title_status) row.title_status = v.title_status;
    if (v.damage_location) row.damage_location = v.damage_location;
    if (v.damage_type) row.damage_type = v.damage_type;
    if (v.drive_condition) row.drive_condition = v.drive_condition;
    if (v.body_condition) row.body_condition = v.body_condition;
    if (v.key_status) row.key_status = v.key_status;
    return row;
  });
}

function backfillPricingFields(row: Record<string, unknown>): Record<string, unknown> {
  // IAA/IAAI rows often provide Estimated Retail Value (price_estimate), which is NOT
  // an acquisition price. Do not backfill MMR/current_bid/buy_now from it.
  const hasIaaSignals = Boolean(
    (typeof row.lot_number === "string" && row.lot_number.trim()) &&
    (
      (typeof row.title_status === "string" && row.title_status.trim()) ||
      (typeof row.damage_location === "string" && row.damage_location.trim()) ||
      (typeof row.damage_type === "string" && row.damage_type.trim()) ||
      (typeof row.drive_condition === "string" && row.drive_condition.trim()) ||
      (typeof row.body_condition === "string" && row.body_condition.trim()) ||
      (typeof row.key_status === "string" && row.key_status.trim())
    )
  );
  if (hasIaaSignals) return row;

  const price = typeof row.price_estimate === "number" && row.price_estimate > 0
    ? row.price_estimate
    : null;
  if (price == null) return row;

  if (row.mmr_value == null) row.mmr_value = price;
  if (row.current_bid == null) row.current_bid = price;
  if (row.buy_now == null) row.buy_now = price;
  return row;
}

// ─── Insert vehicles in batches ─────────────────────────────────────────────

async function insertAuctionVehicles(
  supabase: ReturnType<typeof createClient>,
  runListId: string,
  vehicles: Record<string, unknown>[],
): Promise<number> {
  const normalizedVehicles = vehicles.map(backfillPricingFields);
  console.log(`[parse-run-list] 🧱 Insert started for ${normalizedVehicles.length} vehicles`);
  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < normalizedVehicles.length; i += batchSize) {
    const batch = normalizedVehicles.slice(i, i + batchSize);
    const { error: insErr } = await supabase.from("auction_vehicles").insert(batch);
    if (insErr) throw new Error(`Insert batch failed: ${insErr.message}`);
    inserted += batch.length;
  }
  console.log(`[parse-run-list] 🧱 Insert completed: ${inserted}`);
  return inserted;
}

// ─── PDF → vehicles (text-based + small inline OCR) ─────────────────────────

async function parsePDFInline(
  pdfBytes: Uint8Array,
  runListId: string,
  orgId: string,
  filePath?: string,
): Promise<Record<string, unknown>[]> {
  const pdfText = await extractPDFTextRaw(pdfBytes);
  const meaningfulChars = pdfText.replace(/\s/g, "").length;
  // Some auction PDFs (e.g. CarMax, IAA) use font encodings our extractor can't decode.
  const rawLatin1 = new TextDecoder("latin1").decode(pdfBytes);
  const vinLikePatterns = (pdfText.match(/[A-HJ-NPR-Z0-9]{17}/g) ?? []).length;
  const isImageBased = meaningfulChars < 100 && vinLikePatterns < 5;
  const vendorHint = detectPdfVendor(pdfText, rawLatin1, filePath);

  console.log(`[parse-run-list] 📄 PDF inline: ${isImageBased ? "IMAGE-BASED" : "TEXT-BASED"} (meaningfulChars=${meaningfulChars}, vinLike=${vinLikePatterns})`);

  let blocks: VehicleBlock[] = [];

  if (!isImageBased) {
    if (vendorHint === "carmax") {
      blocks = parseCarMaxBlocks(pdfText.length > 100 ? pdfText : rawLatin1);
    } else if (vendorHint === "iaai") {
      blocks = parseIaaSaleListBlocks(pdfText.length > 100 ? pdfText : rawLatin1);
    } else if (vendorHint === "adesa") {
      blocks = parseAdesaBlocks(pdfText);
    } else {
      blocks = parseManheimBlocks(pdfText);
    }

    // Try CarMax parser if: few results AND text hints at CarMax or VIN patterns found
    if (blocks.length < 5 && (vendorHint === "carmax" || /carmax/i.test(pdfText) || vinLikePatterns >= 5)) {
      console.log(`[parse-run-list] 🚗 Primary parser found ${blocks.length}, trying CarMax parser...`);
      const carMaxBlocks = parseCarMaxBlocks(pdfText.length > 100 ? pdfText : rawLatin1);
      if (carMaxBlocks.length > blocks.length) blocks = carMaxBlocks;
    }

    if (blocks.length < 5) {
      const vinLineBlocks = parseVinLineBlocks(pdfText);
      if (vinLineBlocks.length > blocks.length) blocks = vinLineBlocks;
    }

    if (blocks.length < 5 && pdfText.length > 200) {
      console.log(`[parse-run-list] 🤖 Regex found ${blocks.length}, trying generic VIN parser...`);
      const genericBlocks = parseGenericVehicleBlocks(pdfText);
      if (genericBlocks.length > blocks.length) blocks = genericBlocks;
    }

    if (blocks.length < 5 && pdfText.length > 200) {
      console.log(`[parse-run-list] 🤖 Still only ${blocks.length}, trying AI text fallback...`);
      const aiBlocks = await parseWithAIText(pdfText, vendorHint);
      if (aiBlocks.length > blocks.length) blocks = aiBlocks;
    }
  }

  // Quality check: if the regex parsers found blocks but they look like junk
  // (no VINs and no valid year+make on > 70% of them), discard and try OCR.
  const hasGoodBlocks = blocks.length > 0 && (() => {
    const goodCount = blocks.filter(b =>
      (b.vin && b.vin.length >= 10) ||
      (b.year && b.year >= 1980 && b.make && b.make.trim().length > 1)
    ).length;
    return goodCount / blocks.length >= 0.3;
  })();

  // For image-based PDFs OR when text parsing yielded too few / low-quality results, try OCR
  if (blocks.length < 3 || !hasGoodBlocks) {
    const reason = !hasGoodBlocks ? `low quality (${blocks.length} blocks but most look invalid)` : `too few blocks (${blocks.length})`;
    console.log(`[parse-run-list] 📸 Attempting inline OCR of full PDF (${(pdfBytes.length / 1024 / 1024).toFixed(1)}MB) — reason: ${reason}...`);
    try {
      const ocrBlocks = await ocrSinglePagePdf(pdfBytes, "full PDF", vendorHint);
      if (ocrBlocks.length > blocks.length) blocks = ocrBlocks;
    } catch (ocrErr) {
      console.error(`[parse-run-list] 📸 Inline OCR failed:`, ocrErr instanceof Error ? ocrErr.message : ocrErr);
    }
  }

  if (blocks.length === 0) {
    throw new Error("Could not extract any vehicles from this PDF. The file may be scanned/image-based, password-protected, or in an unsupported format. Try converting to CSV first.");
  }

  const rows = blocksToRows(blocks, runListId, orgId);
  const deduped = dedupeVehicleRows(rows);
  if (deduped.length < rows.length) {
    console.log(`[parse-run-list] 🔄 PDF dedup: ${rows.length} → ${deduped.length} rows`);
  }
  return deduped;
}

// extractSinglePage removed — no longer needed, we pass page number to OCR directly

// ─── Main handler ────────────────────────────────────────────────────────────

