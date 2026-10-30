// Generates 150 realistic demo auction vehicles for onboarding
// Distribution: SUVs 40%, Sedans 30%, Trucks 20%, Other 10%

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SUV_MODELS: [string, string, string[]][] = [
  ['Toyota', 'RAV4', ['LE', 'XLE', 'Limited', 'Adventure']],
  ['Toyota', 'Highlander', ['LE', 'XLE', 'Limited', 'Platinum']],
  ['Honda', 'CR-V', ['LX', 'EX', 'EX-L', 'Touring']],
  ['Honda', 'Pilot', ['Sport', 'EX-L', 'TrailSport', 'Touring']],
  ['Ford', 'Explorer', ['Base', 'XLT', 'Limited', 'ST']],
  ['Ford', 'Escape', ['S', 'SE', 'SEL', 'Titanium']],
  ['Chevrolet', 'Equinox', ['LS', 'LT', 'RS', 'Premier']],
  ['Chevrolet', 'Tahoe', ['LS', 'LT', 'Z71', 'Premier']],
  ['Hyundai', 'Tucson', ['SE', 'SEL', 'N Line', 'Limited']],
  ['Kia', 'Telluride', ['LX', 'S', 'EX', 'SX']],
  ['Kia', 'Sportage', ['LX', 'EX', 'SX', 'SX Prestige']],
  ['Nissan', 'Rogue', ['S', 'SV', 'SL', 'Platinum']],
  ['Jeep', 'Grand Cherokee', ['Laredo', 'Limited', 'Overland', 'Summit']],
  ['Jeep', 'Wrangler', ['Sport', 'Sahara', 'Rubicon']],
  ['BMW', 'X3', ['sDrive30i', 'xDrive30i', 'M40i']],
  ['Lexus', 'RX', ['350', '350 F Sport', '500h']],
  ['Subaru', 'Outback', ['Base', 'Premium', 'Limited', 'Touring']],
  ['Subaru', 'Forester', ['Base', 'Premium', 'Sport', 'Touring']],
  ['Mazda', 'CX-5', ['S', 'Select', 'Preferred', 'Turbo']],
  ['Volkswagen', 'Tiguan', ['S', 'SE', 'SE R-Line', 'SEL']],
];

const SEDAN_MODELS: [string, string, string[]][] = [
  ['Toyota', 'Camry', ['LE', 'SE', 'XLE', 'XSE', 'TRD']],
  ['Toyota', 'Corolla', ['L', 'LE', 'SE', 'XSE']],
  ['Honda', 'Accord', ['LX', 'Sport', 'EX-L', 'Touring']],
  ['Honda', 'Civic', ['LX', 'Sport', 'EX', 'Touring']],
  ['Hyundai', 'Elantra', ['SE', 'SEL', 'N Line', 'Limited']],
  ['Nissan', 'Altima', ['S', 'SV', 'SR', 'SL']],
  ['Mazda', 'Mazda3', ['S', 'Select', 'Preferred', 'Turbo']],
  ['Kia', 'K5', ['LX', 'LXS', 'GT-Line', 'EX']],
  ['Lexus', 'ES', ['250', '350', '350 F Sport']],
  ['BMW', '3 Series', ['330i', '330i xDrive', 'M340i']],
];

const TRUCK_MODELS: [string, string, string[]][] = [
  ['Ford', 'F-150', ['XL', 'XLT', 'Lariat', 'King Ranch', 'Platinum']],
  ['Chevrolet', 'Silverado 1500', ['WT', 'Custom', 'LT', 'LTZ', 'High Country']],
  ['Toyota', 'Tacoma', ['SR', 'SR5', 'TRD Sport', 'TRD Off-Road']],
  ['GMC', 'Sierra 1500', ['SLE', 'SLT', 'AT4', 'Denali']],
  ['RAM', '1500', ['Tradesman', 'Big Horn', 'Laramie', 'Limited']],
];

const OTHER_MODELS: [string, string, string[]][] = [
  ['Honda', 'Odyssey', ['LX', 'EX', 'EX-L', 'Touring']],
  ['Toyota', 'Sienna', ['LE', 'XLE', 'Limited', 'Platinum']],
  ['Ford', 'Mustang', ['EcoBoost', 'GT', 'Mach 1']],
  ['Chevrolet', 'Camaro', ['1LT', '2LT', '1SS', '2SS']],
];

const RISK_FLAGS_POOL = ['TMU', 'Salvage Title', 'Frame Damage', 'Flood', 'No CR Available', 'High Mileage'];

function generateVin(rng: () => number): string {
  const chars = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';
  let vin = '';
  for (let i = 0; i < 17; i++) vin += chars[Math.floor(rng() * chars.length)];
  return vin;
}

export interface DemoVehicle {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  mileage: number;
  lane: string;
  run_order: number;
  cr_score: number | null;
  has_cr: boolean;
  estimated_retail_value: number;
  estimated_recon_cost: number;
  estimated_profit: number;
  recommended_max_bid: number;
  ai_recommendation: string;
  ai_summary: string;
  scoring_reasons: string[];
  risk_flags: string[];
  profit_score: number;
  mmr_value: number | null;
  current_bid: number | null;
  buy_now: number | null;
  price_estimate: number | null;
  seller_type: string;
  title_status: string;
  condition_notes: string | null;
  recommendation_reason: string;
  vehicle_type: string;
  estimated_transport_cost: number;
  estimated_auction_fee: number;
  total_estimated_cost: number;
  recon_base: number;
  recon_cr_adj: number;
  recon_age_adj: number;
  recon_mileage_adj: number;
  recon_type_adj: number;
  recon_brand_adj: number;
  recon_risk_adj: number;
  recon_override: number | null;
  retail_base_market_value: number;
  retail_cr_adjustment: number;
  retail_mileage_adjustment: number;
  retail_dealer_margin: number;
  retail_market_position: 'Above Market' | 'At Market' | 'Below Market';
}

function pickVehicleSpec(rng: () => number): { make: string; model: string; trim: string; vType: string } {
  const roll = rng();
  let pool: [string, string, string[]][];
  let vType: string;

  if (roll < 0.40) {        // 40% SUV
    pool = SUV_MODELS; vType = 'SUV';
  } else if (roll < 0.70) { // 30% Sedan
    pool = SEDAN_MODELS; vType = 'Sedan';
  } else if (roll < 0.90) { // 20% Truck
    pool = TRUCK_MODELS; vType = 'Truck';
  } else {                   // 10% Other
    pool = OTHER_MODELS;
    vType = rng() > 0.5 ? 'Van' : 'Coupe';
  }

  const entry = pool[Math.floor(rng() * pool.length)];
  return {
    make: entry[0],
    model: entry[1],
    trim: entry[2][Math.floor(rng() * entry[2].length)],
    vType,
  };
}

export function generateDemoBuyListVehicles(count = 150): DemoVehicle[] {
  const rng = seededRng(42_007);
  const r = (min: number, max: number) => Math.round(min + rng() * (max - min));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const vehicles: DemoVehicle[] = [];

  for (let i = 0; i < count; i++) {
    const { make, model, trim, vType } = pickVehicleSpec(rng);
    // Years: 2020–2024 mix
    const year = r(2020, 2024);
    // Mileage: 5k–120k realistic spread
    const mileage = r(5000, 120000);
    // CR: mix of high, medium, low, missing (~15% missing)
    const crPresent = rng() > 0.15;
    const cr = crPresent ? Math.round((2.0 + rng() * 3.0) * 10) / 10 : null;
    const laneNum = r(1, 8);
    const runOrder = r(1, 40);

    // ── BASE VALUE (MMR proxy) based on type, year, mileage ──
    let baseValue: number;
    if (vType === 'Truck') {
      baseValue = year >= 2022 ? r(32000, 55000) : r(22000, 40000);
    } else if (vType === 'SUV') {
      baseValue = year >= 2022 ? r(28000, 50000) : r(18000, 35000);
    } else if (vType === 'Sedan') {
      baseValue = year >= 2022 ? r(22000, 38000) : r(14000, 28000);
    } else {
      baseValue = year >= 2022 ? r(20000, 42000) : r(12000, 30000);
    }
    // Mileage impact on base
    if (mileage > 90000) baseValue = Math.round(baseValue * 0.85);
    else if (mileage > 60000) baseValue = Math.round(baseValue * 0.92);
    else if (mileage < 20000) baseValue = Math.round(baseValue * 1.05);

    // ── CONDITION ADJUSTMENT ──
    let condAdj: number;
    if (cr == null) { condAdj = -1500; }
    else if (cr >= 4.5) { condAdj = 1000; }
    else if (cr >= 4.0) { condAdj = 500; }
    else { condAdj = -1000; }

    // ── MILEAGE ADJUSTMENT ──
    let mileAdj: number;
    if (mileage < 30000) { mileAdj = 1000; }
    else if (mileage < 60000) { mileAdj = 500; }
    else if (mileage < 90000) { mileAdj = -500; }
    else { mileAdj = -1500; }

    // ── MARKET ESTIMATE ──
    const marketEstimate = baseValue + condAdj + mileAdj;

    // ── RETAIL VALUE = market_estimate + 12-15% dealer margin ──
    const marginPct = 0.12 + rng() * 0.03;
    const dealerMargin = Math.round(marketEstimate * marginPct);
    const rawRetail = marketEstimate + dealerMargin;
    // Safety cap: 135% of base
    const maxCap = Math.round(baseValue * 1.35);
    const retailValue = Math.max(Math.round(baseValue * 0.65), Math.min(maxCap, rawRetail));

    // Market position
    const ratio = retailValue / baseValue;
    const marketPosition: 'Above Market' | 'At Market' | 'Below Market' =
      ratio > 1.15 ? 'Above Market' : ratio < 0.90 ? 'Below Market' : 'At Market';

    // ── RECON ESTIMATE (new formula: CR + Mileage + Age + Brand + Type + $400 fixed buffer) ──
    // No multipliers. Each component is a direct dollar add.

    // 1. Fixed risk buffer
    const reconBase = 400;

    // 2. CR adjustment
    let reconCrAdj: number;
    if (cr == null)        { reconCrAdj = 350; }
    else if (cr >= 4.5)    { reconCrAdj = 100; }
    else if (cr >= 4.0)    { reconCrAdj = 250; }
    else if (cr >= 3.5)    { reconCrAdj = 600; }
    else if (cr >= 3.0)    { reconCrAdj = 1000; }
    else                   { reconCrAdj = 1500; }

    // 3. Mileage adjustment
    let reconMileAdj: number;
    if      (mileage <  40000) { reconMileAdj = 100; }
    else if (mileage <  60000) { reconMileAdj = 250; }
    else if (mileage <  80000) { reconMileAdj = 400; }
    else if (mileage < 100000) { reconMileAdj = 600; }
    else if (mileage < 200000) { reconMileAdj = 1000; }
    else                       { reconMileAdj = 1500; }

    // 4. Age adjustment (~60% — does not overpower mileage or CR)
    const age = new Date().getFullYear() - year;
    let reconAgeAdj: number;
    if      (age <= 3)  { reconAgeAdj = 50; }
    else if (age <= 6)  { reconAgeAdj = 150; }
    else if (age <= 10) { reconAgeAdj = 300; }
    else                { reconAgeAdj = 500; }

    // 5. Brand reliability (controlled — not deal-blocking)
    let reconBrandAdj: number;
    if      (['Toyota', 'Honda', 'Mazda'].includes(make))                                           { reconBrandAdj = 0; }
    else if (['Ford', 'Chevrolet', 'Nissan', 'Dodge', 'Hyundai', 'Kia', 'Subaru'].includes(make))  { reconBrandAdj = 300; }
    else if (['Jeep', 'Volkswagen', 'RAM', 'GMC', 'Buick', 'Chrysler', 'Lincoln', 'Cadillac', 'Volvo', 'Genesis', 'Infiniti', 'Acura', 'Mitsubishi'].includes(make)) { reconBrandAdj = 400; }
    else if (['BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Land Rover', 'Porsche', 'Jaguar', 'Maserati', 'Bentley', 'Rolls-Royce', 'Alfa Romeo', 'Lexus'].includes(make)) { reconBrandAdj = 1000; }
    else                                                                                            { reconBrandAdj = 200; }

    // 6. Vehicle type adjustment
    let reconTypeAdj: number;
    const perfModels = ['Mustang', 'Camaro', 'Corvette', 'Challenger', 'Charger', '911', '718', 'GR86', 'BRZ', 'Supra', 'MX-5', 'Miata', 'Z', '370Z', '350Z'];
    const luxuryMakes = ['BMW', 'Mercedes-Benz', 'Mercedes', 'Audi', 'Land Rover', 'Porsche', 'Jaguar', 'Maserati', 'Bentley', 'Rolls-Royce', 'Alfa Romeo'];
    if      (perfModels.includes(model) || luxuryMakes.includes(make)) { reconTypeAdj = 300; }
    else if (vType === 'Truck')                                         { reconTypeAdj = 300; }
    else if (vType === 'SUV' || vType === 'Van')                        { reconTypeAdj = 200; }
    else if (vType === 'Sedan')                                         { reconTypeAdj = 0; }
    else                                                                { reconTypeAdj = 100; }

    // 7. Risk adjustment (only for severe conditions — rare in demo)
    const reconRiskAdj = rng() > 0.96 ? 4000 : 0; // ~4% chance of salvage-level risk

    const estimatedRecon = reconBase + reconCrAdj + reconMileAdj + reconAgeAdj + reconBrandAdj + reconTypeAdj + reconRiskAdj;

    // ── WHOLESALE (what you'd pay at auction) ──
    const wholesale = Math.round(baseValue * (0.72 + rng() * 0.12));

    // ── FEES (tiered auction fee, no transport per updated formula) ──
    const transport = 0;
    const auctionFee = baseValue >= 50000 ? 900 : baseValue >= 20000 ? 600 : baseValue >= 3000 ? 500 : baseValue >= 1000 ? 300 : 100;

    // ── PROFIT = retail - wholesale - recon - fees ──
    const profit = Math.round(retailValue - wholesale - estimatedRecon - auctionFee);

    // ── MAX BID = retail - recon - target_profit(15% of retail) - fees ──
    const targetProfit = r(2000, 4000);
    const maxBid = Math.round(retailValue - estimatedRecon - targetProfit - auctionFee);

    const profitScore = Math.max(0, Math.min(100, Math.round(profit / 80)));

    // ── AI RECOMMENDATION ──
    let rec: string;
    if (cr == null && profit < 2000) { rec = 'Possible Buy'; }
    else if (profit > 3500) { rec = 'Strong Buy'; }
    else if (profit >= 2000) { rec = 'Buy'; }
    else if (profit >= 500) { rec = 'Possible Buy'; }
    else { rec = 'Pass'; }

    // ── RISK FLAGS ──
    const riskFlags: string[] = [];
    if (!crPresent) riskFlags.push('No CR Available');
    if (mileage > 100000) riskFlags.push('High Mileage');
    if (rng() > 0.96) riskFlags.push(pick(['TMU', 'Salvage Title']));
    if (profit < 0) riskFlags.push('Negative Profit');
    if (estimatedRecon > 3000) riskFlags.push('High Recon');

    // ── SCORING REASONS ──
    const scoringReasons: string[] = [];
    if (profit > 3000) scoringReasons.push('Strong profit potential');
    if (cr != null && cr >= 4.0) scoringReasons.push('Good condition');
    if (mileage < 50000) scoringReasons.push('Low mileage');
    if (['Toyota', 'Honda'].includes(make)) scoringReasons.push('High-demand brand');
    if (profitScore > 70) scoringReasons.push('High profit score');
    if (profit < 0) scoringReasons.push('Negative margin — avoid');

    const summary = `${year} ${make} ${model} ${trim} — ${
      profit > 3500 ? 'Strong opportunity' : profit > 1500 ? 'Solid deal' : profit > 0 ? 'Review carefully' : 'Would lose money'
    }. ${cr != null ? `CR ${cr.toFixed(1)}` : 'No CR available'}. ${mileage.toLocaleString()} miles. Est. profit ${
      profit > 0 ? `$${profit.toLocaleString()}` : `−$${Math.abs(profit).toLocaleString()}`
    }.`;

    vehicles.push({
      id: `demo-${i.toString().padStart(3, '0')}`,
      vin: generateVin(rng),
      year, make, model, trim, mileage,
      lane: `${laneNum}`,
      run_order: runOrder,
      cr_score: cr,
      has_cr: crPresent,
      estimated_retail_value: retailValue,
      estimated_recon_cost: estimatedRecon,
      estimated_profit: profit,
      recommended_max_bid: maxBid,
      ai_recommendation: rec,
      ai_summary: summary,
      scoring_reasons: scoringReasons,
      risk_flags: riskFlags,
      profit_score: profitScore,
      mmr_value: rng() > 0.3 ? wholesale + r(-500, 500) : null,
      current_bid: rng() > 0.5 ? wholesale - r(500, 2000) : null,
      buy_now: rng() > 0.6 ? wholesale + r(0, 1500) : null,
      price_estimate: wholesale,
      seller_type: pick(['Dealer', 'Fleet', 'Lease Return', 'Repo']),
      title_status: rng() > 0.95 ? 'salvage' : 'clean',
      condition_notes: rng() > 0.7 ? pick(['Minor scratches on bumper', 'Interior wear on driver seat', 'Tires at 50%', 'Clean overall', 'Needs new brakes']) : null,
      recommendation_reason: `Projected ${profit > 0 ? `$${profit.toLocaleString()} profit` : 'loss'} after recon and fees.`,
      vehicle_type: vType,
      estimated_transport_cost: transport,
      estimated_auction_fee: auctionFee,
      total_estimated_cost: wholesale + estimatedRecon + auctionFee,
      recon_base: reconBase,
      recon_cr_adj: reconCrAdj,
      recon_age_adj: reconAgeAdj,
      recon_mileage_adj: reconMileAdj,
      recon_type_adj: reconTypeAdj,
      recon_brand_adj: reconBrandAdj,
      recon_risk_adj: reconRiskAdj,
      recon_override: null,
      retail_base_market_value: baseValue,
      retail_cr_adjustment: condAdj,
      retail_mileage_adjustment: mileAdj,
      retail_dealer_margin: dealerMargin,
      retail_market_position: marketPosition,
    });
  }

  // Sort: profitable first, but keep some bad deals visible
  return vehicles.sort((a, b) => b.estimated_profit - a.estimated_profit);
}
