// @ts-nocheck — Deno edge function; not checked by project TypeScript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const marketCheckApiKey = Deno.env.get("MARKETCHECK_API_KEY") ?? "";

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

interface Vehicle {
  id: string;
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  mmr_value: number | null;
  buy_now: number | null;
  price_estimate: number | null;
  current_bid: number | null;
  cr_score: number | null;
  retail_base_market_value: number | null;
  retail_cr_adjustment: number | null;
  retail_mileage_adjustment: number | null;
  retail_dealer_margin: number | null;
  data_confidence_score: number | null;
  estimated_recon_cost: number | null;
  estimated_auction_fee: number | null;
  vehicle_type: string | null;
  lot_number: string | null;
  title_status: string | null;
  damage_location: string | null;
  damage_type: string | null;
  drive_condition: string | null;
  run_list_id: string;
  organization_id: string;
}

interface MarketCheckListing {
  price?: number | null;
  miles?: number | null;
  dom?: number | null;
  dom_180?: number | null;
  list_date?: string | null;
}

/** Normalise a comp record to a common shape */
interface NormalisedComp {
  price: number | null;
  mileage: number | null;
  dom: number | null;
}

/** Fetch comparable listings from MarketCheck */
async function fetchMarketCheckListings(
  year: number,
  make: string,
  model: string,
  trim: string | null,
  zip: string,
  radius = 100,
): Promise<NormalisedComp[]> {
  if (!marketCheckApiKey) return [];

  const params = new URLSearchParams({
    api_key: marketCheckApiKey,
    year: String(year),
    make: make.toLowerCase(),
    model: model.toLowerCase(),
    zip,
    radius: String(radius),
    rows: "50",
    fl: "price,miles,dom,dom_180,list_date",
  });
  if (trim && trim.trim()) {
    params.append("trim", trim.trim().toLowerCase());
  }

  try {
    const res = await fetch(
      `https://mc-api.marketcheck.com/v2/search/car/active?${params}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      console.warn(`[update-retail-values] MarketCheck ${res.status} for ${year} ${make} ${model} ${trim || ""}`);
      return [];
    }
    const json = await res.json();
    const listings: MarketCheckListing[] = json?.listings ?? json?.data?.listings ?? [];
    return listings.map((l) => {
      let dom: number | null = l.dom ?? null;
      if (dom == null && l.list_date) {
        const ms = Date.parse(l.list_date);
        if (!isNaN(ms)) dom = Math.round((Date.now() - ms) / 86_400_000);
      }
      return { price: l.price ?? null, mileage: l.miles ?? null, dom };
    });
  } catch (err) {
    console.warn(`[update-retail-values] MarketCheck fetch error for ${year} ${make} ${model} ${trim || ""}:`, err);
    return [];
  }
}

function computeStdDev(values: number[], mean: number): number | null {
  if (values.length <= 1) return null;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeCompsStats(comps: NormalisedComp[], vehicleMileage: number) {
  const prices = comps.map(c => c.price).filter((p): p is number => p != null && p > 0);
  const doms = comps.map(c => c.dom).filter((d): d is number => d != null && d >= 0);
  const mileages = comps.map(c => c.mileage).filter((m): m is number => m != null && m >= 0);

  const priceMean = trimmedMean(prices, 0.15);
  const priceMedian = median(prices);
  const avgMileage = mileages.length > 0 ? Math.round(mileages.reduce((a, b) => a + b, 0) / mileages.length) : 0;
  const mileAdj = mileageAdjustment(vehicleMileage, avgMileage);

  let avgDaysToSell = null;
  if (doms.length > 0) {
    avgDaysToSell = Math.round(doms.reduce((a, b) => a + b, 0) / doms.length);
  }
  const marketDaySupply = avgDaysToSell ? Math.round(avgDaysToSell * 1.1) : null;

  return {
    priceMean,
    priceMedian,
    avgMileage,
    mileAdj,
    avgDaysToSell,
    marketDaySupply,
    numFound: comps.length
  };
}

/**
 * Fetch comparable listings — MarketCheck only.
 * Returns normalised comps or empty (no market data).
 */
async function fetchComps(
  year: number,
  make: string,
  model: string,
  trim: string | null,
  zip: string,
): Promise<{ comps: NormalisedComp[]; source: string }> {
  if (marketCheckApiKey) {
    const mc = await fetchMarketCheckListings(year, make, model, trim, zip);
    if (mc.length > 0) return { comps: mc, source: "marketcheck" };
  }
  return { comps: [], source: "none" };
}

// ── Segment-based retail estimator (fallback when no comps) ─────────────────
const SEGMENT_BASE_RETAIL: Record<string, number> = {
  Truck: 35000, SUV: 30000, Van: 25000, Sedan: 22000,
  Hybrid: 26000, Electric: 35000, Coupe: 24000, Other: 22000,
};
const MAKE_MODIFIER: Record<string, number> = {
  BMW: 1.6, 'MERCEDES-BENZ': 1.7, AUDI: 1.5, PORSCHE: 2.5,
  'LAND ROVER': 1.8, JAGUAR: 1.4, LEXUS: 1.3, ACURA: 1.1, INFINITI: 1.2,
  CADILLAC: 1.2, LINCOLN: 1.1, TOYOTA: 1.0, HONDA: 1.0, MAZDA: 0.95,
  FORD: 0.9, CHEVROLET: 0.9, CHEVY: 0.9, GMC: 0.95, RAM: 0.95, DODGE: 0.85,
  HYUNDAI: 0.85, KIA: 0.80, NISSAN: 0.85, VOLKSWAGEN: 0.88,
  SUBARU: 0.95, JEEP: 0.88, CHRYSLER: 0.80, BUICK: 0.88, MITSUBISHI: 0.80,
};

/**
 * For no-price run lists (e.g. CarMax PDF), estimate the assumed wholesale price
 * as a fraction of retail.  Cheaper vehicles trade at a much lower % of retail at
 * wholesale auctions, so a flat 78% overstates the cost basis and produces false-negative
 * profit forecasts.  These tiers are calibrated for typical US wholesale auction spreads.
 */
function wholesaleRatioForRetail(segRetail: number): number {
  if (segRetail >= 20000) return 0.76;
  if (segRetail >= 12000) return 0.70;
  if (segRetail >= 7000)  return 0.64;
  if (segRetail >= 4000)  return 0.58;
  return 0.52;
}

/**
 * For IAA rows with no bid price, estimate what the car will hammer for at auction.
 * IAA price_estimate is the ACV/Estimated Retail Value — not the acquisition cost.
 * Fractions by drive condition: Run & Drive 40%, Starts 25%, No Start/Stationary 15%, unknown 30%.
 */
function iaaAcquisitionCost(v: Vehicle): number {
  if (v.buy_now != null && v.buy_now > 0) return v.buy_now;
  if (v.current_bid != null && v.current_bid > 0) return v.current_bid;
  const acv = v.price_estimate ?? v.mmr_value ?? 0;
  if (!acv) return 0;
  const dc = (v.drive_condition ?? "").toLowerCase();
  if (dc.includes("run") && dc.includes("drive")) return Math.round(acv * 0.40);
  if (dc.includes("start") && !dc.includes("no start")) return Math.round(acv * 0.25);
  if (dc.includes("no start") || dc.includes("stationary") || dc.includes("not run")) return Math.round(acv * 0.15);
  return Math.round(acv * 0.30);
}

/** Median of an array (handles even/odd length) */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Remove the top and bottom 15% of values, then return the mean */
function trimmedMean(values: number[], trim = 0.15): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * trim);
  const trimmed = sorted.slice(cut, sorted.length - cut);
  if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
  return Math.round(trimmed.reduce((acc, v) => acc + v, 0) / trimmed.length);
}

/** Mileage adjustment: $0.10 per mile below/above market average (capped at ±$4,000) */
function mileageAdjustment(vehicleMileage: number, marketAvgMileage: number): number {
  const diff = vehicleMileage - marketAvgMileage;
  const adj = Math.round(-diff * 0.10);
  return Math.max(-4000, Math.min(4000, adj));
}

/**
 * Segment + make + age based retail estimate for vehicles with no run-list price.
 * Used when IAA (or any auction) provides no price estimate (e.g. "******").
 * Returns 0 when insufficient data (no year or make).
 */
function computeSegmentBase(year: number | null, make: string | null, vehicleType: string | null): number {
  if (!year || !make) return 0;
  const currentYear = new Date().getFullYear();
  const segRetail = SEGMENT_BASE_RETAIL[vehicleType ?? "Other"] ?? SEGMENT_BASE_RETAIL["Other"];
  const makeMod = MAKE_MODIFIER[(make).toUpperCase()] ?? 1.0;
  const age = Math.max(0, currentYear - year);
  // 6.5% annual depreciation, floor at 22% of base (very old/cheap vehicles)
  const ageFactor = Math.max(0.22, 1.0 - age * 0.065);
  return Math.round(segRetail * makeMod * ageFactor);
}

interface MarketCheckPrediction {
  marketcheck_price: number | null;
  mean: number | null;
  median: number | null;
  std_dev: number | null;
  num_found: number | null;
  avg_days_to_sell: number | null;
  market_day_supply: number | null;
  avg_mileage: number | null;
}

async function fetchMarketCheckPrediction(
  vin: string,
  miles: number,
  zip: string,
): Promise<MarketCheckPrediction | null> {
  if (!marketCheckApiKey) return null;

  const params = new URLSearchParams({
    api_key: marketCheckApiKey,
    vin: vin,
    miles: String(miles),
    dealer_type: "independent",
    zip: zip,
    is_certified: "false"
  });

  const url = `https://api.marketcheck.com/v2/predict/car/us/marketcheck_price/comparables?${params}`;

  const fetchWithTimeout = async (timeoutMs: number) => {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  };

  let res;
  try {
    res = await fetchWithTimeout(5000);
  } catch (err) {
    console.warn(`[update-retail-values] First attempt failed for VIN: ${vin}. Retrying in 2s...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      res = await fetchWithTimeout(5000);
    } catch (retryErr) {
      console.warn(`[update-retail-values] Second attempt failed for VIN: ${vin}`, retryErr);
      return null;
    }
  }

  if (!res.ok) {
    console.warn(`[update-retail-values] MarketCheck Predict returned status ${res.status} for VIN: ${vin}`);
    return null;
  }

  try {
    const json = await res.json();
    const marketcheck_price = json?.marketcheck_price ?? null;
    const priceStats = json?.comparables?.stats?.price ?? {};
    const domStats = json?.comparables?.stats?.dom ?? {};
    const milesStats = json?.comparables?.stats?.miles ?? {};
    const listings = json?.comparables?.listings ?? [];

    let domSum = 0;
    let domCount = 0;
    for (const l of listings) {
      if (l.dom != null) {
        domSum += l.dom;
        domCount++;
      }
    }
    const computedDomMean = domCount > 0 ? Math.round(domSum / domCount) : null;
    const avgDaysToSell = domStats.mean ?? computedDomMean;
    const marketDaySupply = avgDaysToSell ? Math.round(avgDaysToSell * 1.1) : null;

    return {
      marketcheck_price,
      mean: priceStats.mean ?? null,
      median: priceStats.median ?? null,
      std_dev: priceStats.std_dev ?? null,
      num_found: json?.comparables?.num_found ?? null,
      avg_days_to_sell: avgDaysToSell ?? null,
      market_day_supply: marketDaySupply ?? null,
      avg_mileage: milesStats.mean ?? null
    };
  } catch (err) {
    console.warn(`[update-retail-values] Error parsing MarketCheck Predict JSON for VIN: ${vin}`, err);
    return null;
  }
}

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

    console.log(`[update-retail-values] Starting for run_list_id: ${runListId}`);

    // ── Get dealer ZIP from dealer_preferences via the run list's org ──────────
    const { data: runList } = await supabase
      .from("auction_run_lists")
      .select("organization_id")
      .eq("id", runListId)
      .single();

    let dealerZip: string | null = null;

    if (runList?.organization_id) {
      const { data: prefs } = await supabase
        .from("dealer_preferences")
        .select("dealer_zip")
        .eq("organization_id", runList.organization_id)
        .maybeSingle();
      dealerZip = (prefs as any)?.dealer_zip ?? null;
    }

    // ── Fetch all vehicles for this run list (paginated) ───────────────────────
    let vehicles: Vehicle[] = [];
    let page = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error: fetchErr } = await supabase
        .from("auction_vehicles")
        .select("id,vin,year,make,model,trim,mileage,mmr_value,buy_now,price_estimate,current_bid,cr_score,retail_base_market_value,retail_cr_adjustment,retail_mileage_adjustment,retail_dealer_margin,data_confidence_score,estimated_recon_cost,estimated_auction_fee,vehicle_type,lot_number,title_status,damage_location,damage_type,drive_condition,run_list_id,organization_id")
        .eq("run_list_id", runListId)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchErr) {
        console.warn("[update-retail-values] Fetch error:", fetchErr.message);
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
      return new Response(JSON.stringify({ updated: 0, skipped: "no vehicles" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[update-retail-values] ${vehicles.length} vehicles to price`);

    // ─── Query cache and announcements ──────────────────────────────────────────
    const uniqueYears = Array.from(new Set(vehicles.map(v => v.year).filter((y): y is number => y != null)));
    const uniqueMakes = Array.from(new Set(vehicles.map(v => v.make).filter((m): m is string => typeof m === "string" && m.trim().length > 0)));
    const uniqueModels = Array.from(new Set(vehicles.map(v => v.model).filter((m): m is string => typeof m === "string" && m.trim().length > 0)));

    let cachedList: any[] = [];
    if (uniqueYears.length > 0 && uniqueMakes.length > 0 && uniqueModels.length > 0) {
      const { data, error: cacheErr } = await supabase
        .from("vehicle_retail_values")
        .select("*")
        .in("year", uniqueYears)
        .in("make", uniqueMakes)
        .in("model", uniqueModels)
        .gte("fetched_at", new Date(Date.now() - 48 * 3600 * 1000).toISOString());
      
      if (cacheErr) {
        console.warn("[update-retail-values] Cache query error:", cacheErr.message);
      } else if (data) {
        cachedList = data;
      }
    }

    const cacheMap = new Map<string, any>();
    for (const c of cachedList) {
      const y = c.year;
      const mk = (c.make ?? "").trim().toLowerCase();
      const md = (c.model ?? "").trim().toLowerCase();
      const tr = (c.trim ?? "").trim().toLowerCase();
      const mi = c.miles;
      const zp = (c.dealer_zip ?? "").trim().toLowerCase();
      
      const cacheKey = `${y}|${mk}|${md}|${tr}|${mi}|${zp}`;
      cacheMap.set(cacheKey, c);
    }

    const { data: announcementList } = await supabase
      .from("vehicle_announcements")
      .select("*")
      .eq("run_list_id", runListId);

    const announcementMap = new Map<string, {
      detected_flags: string[];
      confirmed_flags: string[];
      dismissed_flags: string[];
    }>();
    if (announcementList) {
      for (const ann of announcementList) {
        announcementMap.set(ann.vin.toUpperCase(), {
          detected_flags: ann.detected_flags ?? [],
          confirmed_flags: ann.confirmed_flags ?? [],
          dismissed_flags: ann.dismissed_flags ?? []
        });
      }
    }

    // ── Deduplicate lookups before calling MarketCheck ───────────────────────────
    const lookupsToPerform = new Map<string, {
      year: number;
      make: string;
      model: string;
      trim: string | null;
      mileage: number;
      dealerZip: string;
      representativeVin: string | null;
      vehicles: Vehicle[];
    }>();

    for (const v of vehicles) {
      if (!v.year || !v.make || !v.model) {
        continue;
      }
      const y = v.year;
      const mk = v.make.trim().toLowerCase();
      const md = v.model.trim().toLowerCase();
      const tr = (v.trim ?? "").trim().toLowerCase();
      const mi = v.mileage ?? 0;
      const zp = (dealerZip ?? "90210").trim().toLowerCase();

      const key = `${y}|${mk}|${md}|${tr}|${mi}|${zp}`;

      if (cacheMap.has(key)) {
        continue; // Cache hit
      }

      const vin = typeof v.vin === "string" ? v.vin.trim().toUpperCase() : "";
      const hasValidVin = vin.length === 17;

      if (lookupsToPerform.has(key)) {
        const existing = lookupsToPerform.get(key)!;
        existing.vehicles.push(v);
        if (!existing.representativeVin && hasValidVin) {
          existing.representativeVin = vin;
        }
      } else {
        lookupsToPerform.set(key, {
          year: y,
          make: v.make.trim(),
          model: v.model.trim(),
          trim: v.trim ? v.trim.trim() : null,
          mileage: mi,
          dealerZip: dealerZip ?? "90210",
          representativeVin: hasValidVin ? vin : null,
          vehicles: [v],
        });
      }
    }

    const lookupList = Array.from(lookupsToPerform.values());
    console.log(`[update-retail-values] Deduplicated cache misses to query: ${lookupList.length}`);

    const concurrency = 10;
    const resultsMap = new Map<string, any>();

    for (let i = 0; i < lookupList.length; i += concurrency) {
      const batch = lookupList.slice(i, i + concurrency);
      await Promise.all(batch.map(async (item) => {
        const key = `${item.year}|${item.make.toLowerCase()}|${item.model.toLowerCase()}|${(item.trim ?? "").toLowerCase()}|${item.mileage}|${item.dealerZip.toLowerCase()}`;
        
        let pred: any = null;

        // 1. Try Predict API if we have a representative VIN
        if (item.representativeVin) {
          console.log(`[update-retail-values] Querying Predict API for key ${key} using VIN ${item.representativeVin}`);
          pred = await fetchMarketCheckPrediction(item.representativeVin, item.mileage, item.dealerZip);
        }

        // 2. Fallback to active listings search
        if ((!pred || !pred.marketcheck_price || !pred.num_found)) {
          console.log(`[update-retail-values] Querying listings search for key ${key}`);
          let comps = await fetchMarketCheckListings(item.year, item.make, item.model, item.trim, item.dealerZip);
          if (comps.length === 0 && item.trim) {
            console.log(`[update-retail-values] No trim matches. Retrying listings search without trim for key ${key}`);
            comps = await fetchMarketCheckListings(item.year, item.make, item.model, null, item.dealerZip);
          }
          if (comps.length > 0) {
            const stats = computeCompsStats(comps, item.mileage);
            pred = {
              marketcheck_price: stats.priceMean ? Math.round(stats.priceMean + stats.mileAdj) : null,
              mean: stats.priceMean,
              median: stats.priceMedian,
              std_dev: stats.priceMean ? computeStdDev(comps.map(c => c.price).filter((p): p is number => p != null), stats.priceMean) : null,
              num_found: stats.numFound,
              avg_days_to_sell: stats.avgDaysToSell,
              market_day_supply: stats.marketDaySupply,
              avg_mileage: stats.avgMileage,
              api_status: stats.priceMean ? "success" : "no_data"
            };
          }
        }

        // Cache result in DB and in memory
        if (pred && pred.marketcheck_price) {
          resultsMap.set(key, pred);
          
          try {
            const cacheEntry = {
              vin: item.representativeVin ?? null,
              year: item.year,
              make: item.make,
              model: item.model,
              trim: item.trim,
              miles: item.mileage,
              marketcheck_price: pred.marketcheck_price,
              price_mean: pred.mean,
              price_median: pred.median,
              price_std_dev: pred.std_dev,
              comparables_count: pred.num_found,
              dealer_zip: item.dealerZip,
              api_status: "success",
              fetched_at: new Date().toISOString(),
              avg_days_to_sell: pred.avg_days_to_sell,
              market_day_supply: pred.market_day_supply
            };

            let query = supabase
              .from("vehicle_retail_values")
              .select("id")
              .eq("year", item.year)
              .eq("make", item.make)
              .eq("model", item.model)
              .eq("miles", item.mileage);

            if (item.trim == null) {
              query = query.is("trim", null);
            } else {
              query = query.eq("trim", item.trim);
            }

            if (item.dealerZip == null) {
              query = query.is("dealer_zip", null);
            } else {
              query = query.eq("dealer_zip", item.dealerZip);
            }

            const { data: existing } = await query.maybeSingle();

            if (existing?.id) {
              await supabase
                .from("vehicle_retail_values")
                .update(cacheEntry)
                .eq("id", existing.id);
            } else {
              await supabase
                .from("vehicle_retail_values")
                .insert(cacheEntry);
            }
          } catch (dbErr) {
            console.warn(`[update-retail-values] Error writing success cache for key ${key}:`, dbErr);
          }
        } else {
          const negResult = {
            marketcheck_price: null,
            api_status: pred?.api_status === "no_data" ? "no_data" : "error"
          };
          resultsMap.set(key, negResult);

          try {
            const cacheEntry = {
              vin: item.representativeVin ?? null,
              year: item.year,
              make: item.make,
              model: item.model,
              trim: item.trim,
              miles: item.mileage,
              marketcheck_price: null,
              price_mean: null,
              price_median: null,
              price_std_dev: null,
              comparables_count: null,
              dealer_zip: item.dealerZip,
              api_status: pred?.api_status === "no_data" ? "no_data" : "error",
              fetched_at: new Date().toISOString(),
              avg_days_to_sell: null,
              market_day_supply: null
            };

            let query = supabase
              .from("vehicle_retail_values")
              .select("id")
              .eq("year", item.year)
              .eq("make", item.make)
              .eq("model", item.model)
              .eq("miles", item.mileage);

            if (item.trim == null) {
              query = query.is("trim", null);
            } else {
              query = query.eq("trim", item.trim);
            }

            if (item.dealerZip == null) {
              query = query.is("dealer_zip", null);
            } else {
              query = query.eq("dealer_zip", item.dealerZip);
            }

            const { data: existing } = await query.maybeSingle();

            if (existing?.id) {
              await supabase
                .from("vehicle_retail_values")
                .update(cacheEntry)
                .eq("id", existing.id);
            } else {
              await supabase
                .from("vehicle_retail_values")
                .insert(cacheEntry);
            }
          } catch (dbErr) {
            console.warn(`[update-retail-values] Error writing negative cache for key ${key}:`, dbErr);
          }
        }
      }));
    }

    // ── Compute retail values and batch-update ─────────────────────────────────
    const noMarketDataUpdates: Array<any> = [];
    const updates: Array<any> = [];

    for (const v of vehicles as Vehicle[]) {
      const mmrBase = v.buy_now ?? v.current_bid ?? v.price_estimate ?? v.mmr_value ?? 0;
      const segmentBase = mmrBase <= 0 ? computeSegmentBase(v.year, v.make, v.vehicle_type) : 0;
      const effectiveBase = mmrBase > 0 ? mmrBase : segmentBase;

      let base: number | null = null;
      let retailDataSource = "none";
      let compCount: number | null = null;
      let priceMean: number | null = null;
      let priceMedian: number | null = null;
      let priceStdDev: number | null = null;
      let avgDaysToSell: number | null = null;
      let marketDaySupply: number | null = null;
      let avgMileage: number | null = null;
      let isInvalidVin = false;
      let isNoData = false;

      const vin = typeof v.vin === "string" ? v.vin.trim().toUpperCase() : "";
      const miles = v.mileage ?? 0;

      if (!v.year || !v.make || !v.model) {
        isNoData = true;
      } else {
        const y = v.year;
        const mk = v.make.trim().toLowerCase();
        const md = v.model.trim().toLowerCase();
        const tr = (v.trim ?? "").trim().toLowerCase();
        const mi = v.mileage ?? 0;
        const zp = (dealerZip ?? "90210").trim().toLowerCase();

        const key = `${y}|${mk}|${md}|${tr}|${mi}|${zp}`;

        let cached = cacheMap.get(key) ?? resultsMap.get(key);

        if (cached) {
          base = cached.marketcheck_price;
          compCount = cached.comparables_count ?? cached.num_found ?? null;
          priceMean = cached.price_mean ?? cached.mean ?? null;
          priceMedian = cached.price_median ?? cached.median ?? null;
          priceStdDev = cached.price_std_dev ? Number(cached.price_std_dev) : (cached.std_dev ? Number(cached.std_dev) : null);
          avgDaysToSell = cached.avg_days_to_sell ?? null;
          marketDaySupply = cached.market_day_supply ?? null;
          retailDataSource = base ? "marketcheck" : "none";
          if (cached.api_status === "no_data" || cached.api_status === "error") {
            isNoData = true;
          }
        } else {
          isNoData = true;
        }
      }

      if (vin && vin.length !== 17) {
        isInvalidVin = true;
      }

      // No price basis at all — MarketCheck ONLY (do not fallback to MMR/segment/15000)
      if (!base || base <= 0) {
        const sourceStr = isInvalidVin ? "invalid_vin" : isNoData ? "no_data" : "none";
        noMarketDataUpdates.push({
          id: v.id,
          run_list_id: v.run_list_id,
          organization_id: v.organization_id,
          retail_data_source: "none",
          estimated_retail_value: null,
          retail_base_market_value: null,
          retail_mileage_adjustment: null,
          retail_cr_adjustment: null,
          retail_dealer_margin: null,
          avg_days_to_sell: null,
          market_day_supply: null,
          ai_recommendation: "Pass",
          data_confidence_score: Math.min(v.data_confidence_score ?? 100, 50),
          recommended_max_bid: null,
          estimated_profit: 0,
          profit_score: 0,
          is_bank_lendable: false,
        });
        continue;
      }

      // CR adjustment (same logic as profit engine)
      let crAdj = 0;
      const cr = v.cr_score;
      if (cr == null) crAdj = -Math.round(base * 0.02);
      else if (cr >= 4.5) crAdj = Math.round(base * 0.04);
      else if (cr >= 4.0) crAdj = Math.round(base * 0.02);
      else if (cr >= 3.5) crAdj = 0;
      else if (cr >= 3.0) crAdj = -Math.round(base * 0.02);
      else crAdj = -Math.round(base * 0.04);

      // Mileage adjustment (comps handled by ML prediction model directly)
      const mileAdj = 0;

      // No dealer margin added on top of market comps (comps already include margin)
      const dealerMargin = 0;

      const computed = base + crAdj + mileAdj + dealerMargin;

      // Get announcements mapping
      const syntheticVinKey = (v.vin && v.vin.trim())
        ? v.vin.trim().toUpperCase()
        : `NO_VIN_${v.lot_number || v.id}`;
      const ann = announcementMap.get(syntheticVinKey);
      const confirmed = ann?.confirmed_flags ?? [];

      // Calculate confirmed flags penalty
      let titlePenalty = 0;
      if (confirmed.includes('salvage')) {
        titlePenalty = 0.30;
      } else if (confirmed.includes('rebuilt')) {
        titlePenalty = 0.25;
      }

      let stackablePenalty = 0;
      if (confirmed.includes('major_accident')) {
        stackablePenalty += 0.10;
      }
      if (confirmed.includes('lemon')) {
        stackablePenalty += 0.15;
      }
      if (confirmed.includes('tmu')) {
        stackablePenalty += 0.25;
      }

      const totalPenalty = titlePenalty + stackablePenalty;
      const adjustedComputed = Math.round(computed * (1 - totalPenalty));

      // Safety cap: 65%–140% of base
      const finalRetail = Math.max(Math.round(base * 0.65), Math.min(Math.round(base * 1.40), adjustedComputed));

      const ratio = finalRetail / (base || 1);
      const marketPosition = ratio > 1.15 ? "Above Market" : ratio < 0.90 ? "Below Market" : "At Market";

      // Recompute estimated_profit and recommended_max_bid using the real retail price.
      const isIaa = Boolean(
        v.lot_number &&
        (v.title_status != null || v.damage_location != null || v.damage_type != null || v.drive_condition != null),
      );
      const acquisitionCost = isIaa ? iaaAcquisitionCost(v) : mmrBase;
      const hasRunListPrice = mmrBase > 0;
      const segmentWholesale = Math.round(finalRetail * wholesaleRatioForRetail(finalRetail));
      let effectiveWholesale = acquisitionCost > 0
        ? acquisitionCost
        : hasRunListPrice ? mmrBase : segmentWholesale;
      if (hasRunListPrice && !isIaa && effectiveWholesale > segmentWholesale) {
        effectiveWholesale = segmentWholesale;
      }
      const estRecon = v.estimated_recon_cost ?? 1350;
      const estFee   = v.estimated_auction_fee ?? 500;
      const targetMargin = Math.round(finalRetail * 0.15);
      const updatedMaxBid  = Math.max(0, Math.round(finalRetail - targetMargin - estRecon - estFee));
      const updatedProfit = !hasRunListPrice
        ? (updatedMaxBid > 0 ? targetMargin : 0)
        : Math.max(0, Math.round(finalRetail - effectiveWholesale - estRecon - estFee));

      const profitRatio = finalRetail > 0 ? updatedProfit / finalRetail : 0;
      const computedProfitScore = updatedProfit < 0 ? 25
        : profitRatio >= 0.20 ? 100
        : profitRatio >= 0.15 ? 85
        : profitRatio >= 0.10 ? 70
        : profitRatio >= 0.00 ? 50
        : 25;

      // Recalculate title_status based on confirmed flags
      let titleStatus = v.title_status ?? 'clean';
      if (confirmed.includes('salvage')) {
        titleStatus = 'Salvage';
      } else if (confirmed.includes('rebuilt')) {
        titleStatus = 'Rebuilt';
      }

      // Calculate is_bank_lendable status
      const currentYear = new Date().getFullYear();
      const vehicleAge = v.year ? (currentYear - v.year) : 0;
      const vehicleMiles = v.mileage ?? 0;
      const hasFrameDamage = confirmed.includes('major_accident') || (v.damage_location && v.damage_location.toLowerCase().includes('frame'));

      let isLendable = true;
      if (titleStatus.toLowerCase().includes('salvage') || titleStatus.toLowerCase().includes('rebuilt') || titleStatus.toLowerCase().includes('other')) {
        isLendable = false;
      } else if (vehicleAge > 10) {
        isLendable = false;
      } else if (vehicleMiles > 150000) {
        isLendable = false;
      } else if (finalRetail < 4000) {
        isLendable = false;
      } else if (hasFrameDamage) {
        isLendable = false;
      }

      updates.push({
        id: v.id,
        run_list_id: v.run_list_id,
        organization_id: v.organization_id,
        estimated_retail_value: finalRetail,
        retail_base_market_value: base,
        retail_mileage_adjustment: mileAdj,
        retail_cr_adjustment: crAdj,
        retail_dealer_margin: dealerMargin,
        retail_market_position: marketPosition,
        retail_data_source: retailDataSource,
        market_comp_count: compCount,
        market_avg_price: priceMean,
        market_avg_mileage: avgMileage,
        avg_days_to_sell: avgDaysToSell,
        market_day_supply: marketDaySupply,
        dom_sample_count: compCount,
        estimated_profit: updatedProfit,
        profit_score: computedProfitScore,
        recommended_max_bid: updatedMaxBid > 0 ? updatedMaxBid : null,
        title_status: titleStatus,
        is_bank_lendable: isLendable,
        // Update wholesale reference when no run-list price, so UI shows sensible numbers
        ...(!hasRunListPrice ? { retail_base_market_value: effectiveWholesale } : {}),
      });
    }

    // Batch upsert in chunks of 200
    const BATCH = 200;
    let totalUpdated = 0;
    for (let i = 0; i < updates.length; i += BATCH) {
      const chunk = updates.slice(i, i + BATCH);
      const { error: upErr } = await supabase
        .from("auction_vehicles")
        .upsert(chunk, { onConflict: "id" });
      if (upErr) {
        console.error("[update-retail-values] Upsert error:", upErr.message);
      } else {
        totalUpdated += chunk.length;
      }
    }

    // Batch upsert no-market-data vehicles
    for (let i = 0; i < noMarketDataUpdates.length; i += BATCH) {
      const chunk = noMarketDataUpdates.slice(i, i + BATCH);
      const { error: nmErr } = await supabase
        .from("auction_vehicles")
        .upsert(chunk, { onConflict: "id" });
      if (nmErr) console.error("[update-retail-values] No-market-data upsert error:", nmErr.message);
    }

    const marketCompsCount = updates.length;
    console.log(
      `[update-retail-values] Done — ${totalUpdated} updated with market comps, ${noMarketDataUpdates.length} with no market data`,
    );

    return new Response(
      JSON.stringify({
        updated: totalUpdated,
        market_comps: marketCompsCount,
        mmr_fallback: 0,
        no_market_data: noMarketDataUpdates.length,
        dealer_zip: dealerZip,
        dom_calculated: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[update-retail-values] Fatal error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
