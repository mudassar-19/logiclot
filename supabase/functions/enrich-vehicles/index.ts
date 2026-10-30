// @ts-nocheck — Deno edge function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const allowedOrigins = [
  "http://localhost:8080",
  "https://logiclot.vercel.app",
];

function buildCorsHeaders(requestOrigin: string | null) {
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : "https://logiclot.vercel.app";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

// ── NHTSA vPIC batch decode ───────────────────────────────────────────────────
// Up to 50 VINs per request — free, no API key needed
async function decodeVinsBatch(vins: string[]): Promise<Map<string, Record<string, string>>> {
  const results = new Map<string, Record<string, string>>();
  if (vins.length === 0) return results;

  const batches: string[][] = [];
  for (let i = 0; i < vins.length; i += 50) {
    batches.push(vins.slice(i, i + 50));
  }

  for (const batch of batches) {
    try {
      const body = `DATA=${batch.join(";")}&format=json`;
      const res = await fetch(
        "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!res.ok) {
        console.warn(`[enrich-vehicles] NHTSA batch ${res.status}`);
        continue;
      }
      const json = await res.json();
      const items: Record<string, string>[] = json?.Results ?? [];
      for (const item of items) {
        const vin = (item.VIN ?? "").toUpperCase();
        if (vin) results.set(vin, item);
      }
    } catch (err) {
      console.warn("[enrich-vehicles] NHTSA batch error:", err);
    }
  }
  return results;
}

function normalizeBodyStyle(nhtsa: string): string | null {
  if (!nhtsa) return null;
  const s = nhtsa.toLowerCase();
  if (s.includes("sedan") || s.includes("saloon")) return "Sedan";
  if (s.includes("pickup") || s.includes("truck")) return "Truck";
  if (s.includes("sport utility") || s.includes("suv")) return "SUV";
  if (s.includes("van") || s.includes("minivan")) return "Van";
  if (s.includes("coupe") || s.includes("convertible") || s.includes("roadster")) return "Coupe";
  if (s.includes("hatchback") || s.includes("wagon") || s.includes("estate")) return "Hatchback";
  return nhtsa.trim() || null;
}

function normalizeDrivetrain(nhtsa: string): string | null {
  if (!nhtsa) return null;
  const s = nhtsa.toLowerCase();
  if (s.includes("4wd") || s.includes("4x4") || s.includes("four-wheel")) return "4WD";
  if (s.includes("awd") || s.includes("all-wheel")) return "AWD";
  if (s.includes("rwd") || s.includes("rear-wheel")) return "RWD";
  if (s.includes("fwd") || s.includes("front-wheel")) return "FWD";
  return nhtsa.trim() || null;
}

function normalizeFuelType(nhtsa: string): string | null {
  if (!nhtsa) return null;
  const s = nhtsa.toLowerCase();
  if (s.includes("electric") && !s.includes("hybrid")) return "Electric";
  if (s.includes("hybrid")) return "Hybrid";
  if (s.includes("diesel")) return "Diesel";
  if (s.includes("flex") || s.includes("ethanol")) return "Flex";
  if (s.includes("gasoline") || s.includes("gas") || s.includes("petrol")) return "Gasoline";
  if (s.includes("natural gas") || s.includes("cng")) return "CNG";
  return null;
}

function buildEngineDescription(data: Record<string, string>): string | null {
  const displacement = data.DisplacementL ? parseFloat(data.DisplacementL) : null;
  const cylinders = data.EngineCylinders ?? "";
  const hp = data.EngineHP ? Math.round(parseFloat(data.EngineHP)) : null;
  const config = data.EngineConfiguration ?? "";

  const parts: string[] = [];
  if (displacement && !isNaN(displacement)) parts.push(`${displacement.toFixed(1)}L`);
  if (cylinders) parts.push(`${cylinders}-cyl`);
  if (config && !config.includes("Not Applicable")) parts.push(config);
  if (hp) parts.push(`${hp}hp`);

  return parts.length > 0 ? parts.join(" ") : null;
}

// ── CarQuery — supplementary spec lookup for missing engine/drivetrain/body ──
const carQueryCache = new Map<string, Record<string, string> | null>();

async function fetchCarQuerySpecs(
  year: number,
  make: string,
  model: string,
): Promise<Record<string, string> | null> {
  const key = `${year}|${make.toLowerCase().trim()}|${model.toLowerCase().trim()}`;
  if (carQueryCache.has(key)) return carQueryCache.get(key)!;

  try {
    const params = new URLSearchParams({
      cmd: "getTrims",
      make: make.toLowerCase().trim(),
      model: model.toLowerCase().trim(),
      year: String(year),
      sold_in_us: "1",
    });
    const res = await fetch(
      `https://www.carqueryapi.com/api/0.3/?${params}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!res.ok) {
      carQueryCache.set(key, null);
      return null;
    }
    // Handle JSONP response — strip callback wrapper if present
    let text = await res.text();
    text = text.trim();
    if (text.startsWith("?") || text.includes("(")) {
      const match = text.match(/\((\{[\s\S]*\})\)/);
      text = match ? match[1] : text;
    }
    const json = JSON.parse(text);
    const trims: Record<string, string>[] = json?.Trims ?? [];
    if (trims.length === 0) {
      carQueryCache.set(key, null);
      return null;
    }
    // Use the first trim as representative
    const first = trims[0];
    carQueryCache.set(key, first);
    return first;
  } catch {
    carQueryCache.set(key, null);
    return null;
  }
}

// ── Confidence score ──────────────────────────────────────────────────────────
// 0-100 based on which fields are populated
function computeConfidence(v: {
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  engine?: string | null;
  drivetrain?: string | null;
  fuel_type?: string | null;
  body_style?: string | null;
  mileage?: number | null;
  cr_score?: number | null;
  vin_decoded?: boolean;
}): number {
  let score = 0;
  if (v.vin && isValidVin(v.vin))              score += 10;
  if (v.vin_decoded)                           score += 10;
  if (v.year && v.make && v.model)             score += 10;
  if (v.trim)                                  score += 15;
  if (v.engine)                                score += 10;
  if (v.drivetrain)                            score += 10;
  if (v.fuel_type)                             score += 10;
  if (v.body_style)                            score += 5;
  if (v.mileage != null)                       score += 15;
  if (v.cr_score != null)                      score += 10;
  return Math.min(100, score);
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const runListId: string | undefined = body?.run_list_id;

    if (!runListId) {
      return new Response(JSON.stringify({ error: "run_list_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[enrich-vehicles] Starting enrichment for run_list_id: ${runListId}`);

    // Fetch all vehicles (paginated)
    let vehicles: Record<string, any>[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error: fetchErr } = await supabase
        .from("auction_vehicles")
        .select("id,vin,year,make,model,trim,mileage,cr_score,vehicle_type,engine,drivetrain,fuel_type,body_style,run_list_id,organization_id")
        .eq("run_list_id", runListId)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchErr) {
        console.warn("[enrich-vehicles] Fetch error:", fetchErr.message);
        break;
      }
      if (!data || data.length === 0) {
        break;
      }
      vehicles = vehicles.concat(data);
      if (data.length < pageSize) {
        break;
      }
      page++;
    }

    if (!vehicles.length) {
      return new Response(JSON.stringify({ enriched: 0, skipped: "no vehicles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[enrich-vehicles] ${vehicles.length} vehicles to enrich`);

    // Filter to valid VINs for NHTSA decode
    const validVinVehicles = vehicles.filter((v) => v.vin && isValidVin(v.vin));
    const vins = validVinVehicles.map((v) => v.vin.toUpperCase());

    // Batch decode with NHTSA vPIC
    const nhtsaResults = await decodeVinsBatch(vins);
    console.log(`[enrich-vehicles] NHTSA decoded ${nhtsaResults.size} VINs`);

    // Pre-identify unique year|make|model combinations requiring CarQuery spec enrichment
    const neededKeys = new Set<string>();
    const neededList: Array<{ year: number; make: string; model: string }> = [];

    for (const v of vehicles) {
      const vin = (v.vin ?? "").toUpperCase();
      const nhtsa = nhtsaResults.get(vin);
      
      let year = v.year;
      let make = v.make;
      let model = v.model;
      let engine = v.engine;
      let drivetrain = v.drivetrain;
      let bodyStyle = v.body_style;
      
      if (nhtsa) {
        const nhtsaError = (nhtsa.ErrorCode ?? "0").trim();
        const decodeOk = nhtsaError === "0" || nhtsaError.startsWith("0 -");

        if (decodeOk) {
          if (!year && nhtsa.ModelYear) {
            const y = parseInt(nhtsa.ModelYear, 10);
            if (y >= 1900 && y <= 2100) year = y;
          }
          if (!make && nhtsa.Make) make = nhtsa.Make;
          if (!model && nhtsa.Model) model = nhtsa.Model;
          if (!engine) {
            const eng = buildEngineDescription(nhtsa);
            if (eng) engine = eng;
          }
          if (!drivetrain) {
            drivetrain = normalizeDrivetrain(nhtsa.DriveType ?? "");
          }
          if (!bodyStyle) {
            bodyStyle = normalizeBodyStyle(nhtsa.BodyClass ?? "");
          }
        }
      }
      
      if (year && make && model && (!engine || !drivetrain || !bodyStyle)) {
        const key = `${year}|${make.toLowerCase().trim()}|${model.toLowerCase().trim()}`;
        if (!neededKeys.has(key)) {
          neededKeys.add(key);
          neededList.push({ year, make, model });
        }
      }
    }

    if (neededList.length > 0) {
      console.log(`[enrich-vehicles] Pre-fetching CarQuery specs for ${neededList.length} unique models in parallel batches of 10`);
      const concurrencyLimit = 10;
      for (let i = 0; i < neededList.length; i += concurrencyLimit) {
        const batch = neededList.slice(i, i + concurrencyLimit);
        await Promise.all(
          batch.map(async (item) => {
            await fetchCarQuerySpecs(item.year, item.make, item.model);
          })
        );
      }
      console.log(`[enrich-vehicles] Finished pre-fetching CarQuery specs`);
    }

    const updates: Array<Record<string, unknown>> = [];

    for (const v of vehicles) {
      const vin = (v.vin ?? "").toUpperCase();
      const nhtsa = nhtsaResults.get(vin);
      const sources: string[] = [];
      const update: Record<string, unknown> = {
        id: v.id,
        run_list_id: v.run_list_id,
        organization_id: v.organization_id,
      };

      let year   = v.year;
      let make   = v.make;
      let model  = v.model;
      let trim   = v.trim;
      let engine  = v.engine;
      let drivetrain = v.drivetrain;
      let fuelType   = v.fuel_type;
      let bodyStyle  = v.body_style;
      let vinDecoded = false;

      // Apply NHTSA data — only overwrite if field is currently blank
      if (nhtsa) {
        const nhtsaError = (nhtsa.ErrorCode ?? "0").trim();
        const decodeOk = nhtsaError === "0" || nhtsaError.startsWith("0 -");

        if (decodeOk) {
          vinDecoded = true;
          sources.push("nhtsa_vpic");

          if (!year && nhtsa.ModelYear) {
            const y = parseInt(nhtsa.ModelYear, 10);
            if (y >= 1900 && y <= 2100) year = y;
          }
          if (!make && nhtsa.Make)  make  = nhtsa.Make;
          if (!model && nhtsa.Model) model = nhtsa.Model;
          if (!trim && nhtsa.Trim)  trim  = nhtsa.Trim;

          if (!engine) {
            const eng = buildEngineDescription(nhtsa);
            if (eng) engine = eng;
          }
          if (!drivetrain) {
            drivetrain = normalizeDrivetrain(nhtsa.DriveType ?? "");
          }
          if (!fuelType) {
            fuelType = normalizeFuelType(nhtsa.FuelTypePrimary ?? "");
          }
          if (!bodyStyle) {
            bodyStyle = normalizeBodyStyle(nhtsa.BodyClass ?? "");
          }
        }
      }

      // CarQuery fallback: use if engine/drivetrain/body still missing
      if (year && make && model && (!engine || !drivetrain || !bodyStyle)) {
        const cq = await fetchCarQuerySpecs(year, make, model);
        if (cq) {
          sources.push("carquery");
          if (!engine && cq.model_engine_l) {
            const cyl = cq.model_engine_cyl ?? "";
            const disp = parseFloat(cq.model_engine_l);
            const parts: string[] = [];
            if (!isNaN(disp)) parts.push(`${disp.toFixed(1)}L`);
            if (cyl) parts.push(`${cyl}-cyl`);
            if (parts.length > 0) engine = parts.join(" ");
          }
          if (!drivetrain && cq.model_drive) {
            drivetrain = normalizeDrivetrain(cq.model_drive);
          }
          if (!fuelType && cq.model_engine_fuel_id) {
            fuelType = normalizeFuelType(cq.model_engine_fuel_id);
          }
          if (!bodyStyle && cq.model_body) {
            bodyStyle = normalizeBodyStyle(cq.model_body);
          }
          if (!trim && cq.model_trim) {
            trim = cq.model_trim;
          }
        }
      }

      // Assign enriched fields
      if (year !== v.year)           update.year            = year;
      if (make && make !== v.make)   update.make            = make;
      if (model && model !== v.model) update.model          = model;
      if (trim !== v.trim)           update.trim            = trim;
      if (engine !== v.engine)       update.engine          = engine;
      if (drivetrain !== v.drivetrain) update.drivetrain    = drivetrain;
      if (fuelType !== v.fuel_type)  update.fuel_type       = fuelType;
      if (bodyStyle !== v.body_style) update.body_style     = bodyStyle;
      update.vin_decoded          = vinDecoded;
      update.enrichment_sources   = sources;

      // Compute confidence score from enriched state
      update.data_confidence_score = computeConfidence({
        vin,
        year: year ?? v.year,
        make: make ?? v.make,
        model: model ?? v.model,
        trim,
        engine,
        drivetrain,
        fuel_type: fuelType,
        body_style: bodyStyle,
        mileage: v.mileage,
        cr_score: v.cr_score,
        vin_decoded: vinDecoded,
      });

      updates.push(update);
    }

    // Batch upsert in chunks of 50
    let updatedCount = 0;
    const CHUNK = 50;
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK);
      const { error: upsertErr } = await supabase
        .from("auction_vehicles")
        .upsert(chunk, { onConflict: "id" });
      if (upsertErr) {
        console.error("[enrich-vehicles] Upsert error:", upsertErr.message);
      } else {
        updatedCount += chunk.length;
      }
    }

    const avgConfidence = updates.length > 0
      ? Math.round(updates.reduce((s, u) => s + (u.data_confidence_score as number ?? 0), 0) / updates.length)
      : 0;

    console.log(`[enrich-vehicles] Done: ${updatedCount} vehicles enriched, avg confidence ${avgConfidence}/100`);

    return new Response(
      JSON.stringify({
        enriched: updatedCount,
        nhtsa_decoded: nhtsaResults.size,
        avg_confidence: avgConfidence,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[enrich-vehicles] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
