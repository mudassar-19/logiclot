// @ts-nocheck — Deno edge function
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { vehicle_id } = await req.json();
    if (!vehicle_id) {
      return new Response(JSON.stringify({ error: "vehicle_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch vehicle data
    const { data: v, error: fetchErr } = await supabase
      .from("auction_vehicles")
      .select(`
        id, vin, year, make, model, trim, mileage, cr_score,
        estimated_profit, estimated_retail_value, estimated_recon_cost,
        estimated_auction_fee, recommended_max_bid,
        ai_recommendation, risk_flags, scoring_reasons,
        mmr_value, buy_now, price_estimate, current_bid,
        avg_days_to_sell, market_day_supply, retail_data_source,
        market_comp_count, market_avg_price,
        title_status, vehicle_type, condition_notes,
        ai_insight
      `)
      .eq("id", vehicle_id)
      .single();

    if (fetchErr || !v) {
      return new Response(JSON.stringify({ error: "Vehicle not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return cached insight if already generated
    if (v.ai_insight) {
      return new Response(JSON.stringify({ insight: v.ai_insight, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a rich prompt
    const wholesaleRef = v.buy_now ?? v.current_bid ?? v.price_estimate ?? v.mmr_value;
    const riskList = (v.risk_flags ?? []).join(", ") || "none";
    const scoringList = (v.scoring_reasons ?? []).join(", ") || "none";
    const daysToSell = v.avg_days_to_sell != null ? `${Math.round(v.avg_days_to_sell)} days` : "unknown";
    const mds = v.market_day_supply != null ? `${Math.round(v.market_day_supply)} days` : "unknown";
    const compCount = v.market_comp_count != null ? `${v.market_comp_count} comparable listings` : "no market comp data";
    const dataSource = v.retail_data_source === "marketcheck" ? "live MarketCheck comps" : v.retail_data_source === "mmr_estimate" ? "MMR-based estimate (no live comps)" : v.retail_data_source ?? "unknown";

    const prompt = `You are an expert auto dealer analyst. A dealer is reviewing a vehicle at auction and wants your professional opinion.

Vehicle: ${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}
VIN: ${v.vin ?? "unavailable"}
Mileage: ${v.mileage?.toLocaleString() ?? "unknown"} miles
CR Score: ${v.cr_score != null ? v.cr_score.toFixed(1) + " / 5.0" : "No condition report"}
Title: ${v.title_status ?? "Clean"}
Vehicle Type: ${v.vehicle_type ?? "unknown"}
${v.condition_notes ? `Condition Notes: ${v.condition_notes}` : ""}

Financials:
- Wholesale Reference (MMR): ${wholesaleRef ? "$" + wholesaleRef.toLocaleString() : "unavailable"}
- Est. Retail Value: ${v.estimated_retail_value ? "$" + v.estimated_retail_value.toLocaleString() : "unavailable"} (source: ${dataSource})
- Est. Recon Cost: ${v.estimated_recon_cost ? "$" + v.estimated_recon_cost.toLocaleString() : "unknown"}
- Est. Auction Fee: ${v.estimated_auction_fee ? "$" + v.estimated_auction_fee.toLocaleString() : "$500"}
- Est. Profit: ${v.estimated_profit != null ? "$" + v.estimated_profit.toLocaleString() : "unknown"}
- Recommended Max Bid: ${v.recommended_max_bid ? "$" + v.recommended_max_bid.toLocaleString() : "unknown"}

Market Data (${compCount}):
- Avg Days to Sell: ${daysToSell}
- Est. Market Supply: ${mds}

System Recommendation: ${v.ai_recommendation ?? "unknown"}
Risk Flags: ${riskList}
Scoring Highlights: ${scoringList}

Write a 3–4 sentence dealer insight. Be direct and professional — like an experienced buyer advisor talking to a dealer. Cover: (1) whether this is a good deal and why, (2) any notable risks or opportunities, (3) a specific action recommendation (bid aggressively / bid cautiously / pass). Do not use bullet points. Do not repeat the vehicle name in every sentence.`;

    const resp = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 450 },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let geminiStatus = resp.status;
      let geminiMsg = errText.substring(0, 500);
      console.error(`[generate-vehicle-insight] Gemini ${geminiStatus}:`, geminiMsg);
      // Parse structured error if available
      try {
        const errJson = JSON.parse(errText);
        geminiMsg = errJson?.error?.message ?? geminiMsg;
        geminiStatus = errJson?.error?.code ?? geminiStatus;
      } catch {}
      return new Response(JSON.stringify({ error: `Gemini error ${geminiStatus}: ${geminiMsg}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const insight: string = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!insight || insight.length < 80) {
      return new Response(JSON.stringify({ error: "Gemini returned incomplete response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache in DB so we never call Gemini again for this vehicle
    await supabase
      .from("auction_vehicles")
      .update({ ai_insight: insight })
      .eq("id", vehicle_id);

    return new Response(JSON.stringify({ insight, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-vehicle-insight] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
