# Client Supabase — Handover Checklist

Each section below is one change. When handing off to the client, go through these in order.
Every DB change is a SQL paste into **Supabase → SQL Editor → New query → Run**.
Every function change is a redeploy of the named edge function.

---

## 1. Fix `apply_vehicle_scoring` staying stuck on Pass

**Type:** SQL (run once)
**Why:** Buy-list regeneration was skipping vehicles already marked `Pass`, so `ai_recommendation` stayed stale.

<details>
<summary>SQL to paste</summary>

```sql
CREATE OR REPLACE FUNCTION public.apply_vehicle_scoring(p_run_list_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_prefs record;
  v_has_prefs boolean := false;
  v_pref_brands text[];
  v_pref_models text[];
  v_min_cr numeric;
  v_max_mileage integer;
  v_max_recon numeric;
  v_allow_salvage boolean;
  v_allow_frame boolean;
  v_focus_on text;
begin
  select dp.*
  into v_prefs
  from public.dealer_preferences dp
  join public.auction_run_lists rl
    on rl.organization_id = dp.organization_id
  where rl.id = p_run_list_id
  limit 1;

  v_has_prefs := found;

  if v_has_prefs then
    v_pref_brands   := coalesce(v_prefs.preferred_brands, '{}');
    v_pref_models   := coalesce(v_prefs.preferred_models, '{}');
    v_min_cr        := coalesce(v_prefs.min_cr_score, 0);
    v_max_mileage   := coalesce(v_prefs.max_mileage, 999999);
    v_max_recon     := coalesce(v_prefs.max_recon_cost, 999999);
    v_allow_salvage := coalesce(v_prefs.allow_salvage, false);
    v_allow_frame   := coalesce(v_prefs.allow_frame_damage, false);
    v_focus_on      := coalesce(v_prefs.focus_on, 'both');
  else
    v_pref_brands   := '{}';
    v_pref_models   := '{}';
    v_min_cr        := 0;
    v_max_mileage   := 999999;
    v_max_recon     := 999999;
    v_allow_salvage := false;
    v_allow_frame   := false;
    v_focus_on      := 'both';
  end if;

  update public.auction_vehicles av
  set
    scoring_reasons = array_remove(array[
      case when av.profit_score >= 100 then 'Meets target profit' end,
      case when av.profit_score >= 75 and av.profit_score < 100 then 'Strong projected margin' end,
      case when av.profit_score >= 50 and av.profit_score < 75 then 'Moderate projected margin' end,
      case when coalesce(av.estimated_profit, 0) < 0 then 'Negative estimated profit' end,
      case when coalesce(av.mileage, 0) <= v_max_mileage then 'Mileage within preferred range' end,
      case when coalesce(av.mileage, 0) > v_max_mileage then 'Higher mileage unit' end,
      case when coalesce(av.title_status, '') ilike '%clean%' then 'Clean title' end,
      case when coalesce(av.title_status, '') <> '' and coalesce(av.title_status, '') not ilike '%clean%' then 'Title requires review' end,
      case when array_length(v_pref_brands, 1) > 0
           and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 'Preferred brand match' end,
      case when array_length(v_pref_models, 1) > 0
           and upper(av.model) = any(select upper(unnest(v_pref_models))) then 'Preferred model match' end,
      case when av.cr_score is not null
           and av.cr_score >= v_min_cr then 'CR score meets minimum' end,
      case when v_focus_on in ('days_to_sell', 'both')
           and av.avg_days_to_sell is not null
           and av.avg_days_to_sell <= 20 then 'Fast-moving inventory (< 20 days to sell)' end,
      case when v_focus_on in ('days_to_sell', 'both')
           and av.avg_days_to_sell is not null
           and av.avg_days_to_sell > 20 and av.avg_days_to_sell <= 45 then 'Average market velocity (' || round(av.avg_days_to_sell) || ' days to sell)' end,
      case when v_focus_on in ('days_to_sell', 'both')
           and av.avg_days_to_sell is not null
           and av.avg_days_to_sell > 45 then 'Slow-moving inventory (' || round(av.avg_days_to_sell) || ' days to sell)' end,
      case when v_focus_on in ('mds', 'both')
           and av.market_day_supply is not null
           and av.market_day_supply <= 30 then 'Low market day supply (high demand)' end,
      case when v_focus_on in ('mds', 'both')
           and av.market_day_supply is not null
           and av.market_day_supply > 60 then 'High market day supply (slow demand)' end
    ], null),
    risk_flags = array_remove(array[
      case when coalesce(av.mileage, 0) > v_max_mileage then 'High mileage' end,
      case when coalesce(av.title_status, '') <> '' and coalesce(av.title_status, '') not ilike '%clean%' then 'Title risk' end,
      case when coalesce(av.estimated_profit, 0) < 0 then 'Negative profit' end,
      case when coalesce(av.estimated_profit, 0) >= 0 and coalesce(av.estimated_profit, 0) < 1500 then 'Low margin' end,
      case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 'Exceeds recon tolerance' end,
      case when not v_allow_salvage
           and coalesce(av.title_status, '') ilike '%salvage%' then 'Salvage title not allowed' end,
      case when av.cr_score is not null
           and v_min_cr > 0
           and av.cr_score < v_min_cr then 'CR below minimum' end,
      case when v_focus_on in ('days_to_sell', 'both')
           and av.avg_days_to_sell is not null
           and av.avg_days_to_sell > 60 then 'Slow mover (>' || round(av.avg_days_to_sell) || ' days avg)' end
    ], null),
    profit_score = greatest(0, least(100,
      av.profit_score
      + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end
      + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end
      + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end
      + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end
      + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end
      - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end
      - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end
      - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end
      - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end
      - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end
    )),
    ai_recommendation =
      case
        when coalesce(av.estimated_profit, 0) < 0 then 'Pass'
        when greatest(0, least(100, av.profit_score + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end)) >= 85 then 'Strong Buy'
        when greatest(0, least(100, av.profit_score + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end)) >= 70 then 'Buy'
        when greatest(0, least(100, av.profit_score + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end)) >= 50 then 'Possible Buy'
        else 'Pass'
      end,
    ai_summary =
      case
        when coalesce(av.estimated_profit, 0) < 0 then 'Negative estimated profit — this vehicle would lose money at current valuations.'
        when greatest(0, least(100, av.profit_score + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end)) >= 85 then 'Strong margin opportunity matching your dealership preferences.'
        when greatest(0, least(100, av.profit_score + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end)) >= 70 then 'Solid candidate aligned with your buying strategy.'
        when greatest(0, least(100, av.profit_score + case when array_length(v_pref_brands, 1) > 0 and upper(av.make) = any(select upper(unnest(v_pref_brands))) then 10 else 0 end + case when array_length(v_pref_models, 1) > 0 and upper(av.model) = any(select upper(unnest(v_pref_models))) then 5 else 0 end + case when coalesce(av.dealer_demand_score, 0) > 0 then 5 else 0 end + case when v_focus_on in ('days_to_sell', 'both') and av.avg_days_to_sell is not null then case when av.avg_days_to_sell <= 15 then 15 when av.avg_days_to_sell <= 20 then 10 when av.avg_days_to_sell <= 30 then 5 when av.avg_days_to_sell <= 45 then 0 when av.avg_days_to_sell <= 60 then -5 else -12 end else 0 end + case when v_focus_on in ('mds', 'both') and av.market_day_supply is not null then case when av.market_day_supply <= 20 then 10 when av.market_day_supply <= 30 then 5 when av.market_day_supply <= 45 then 0 when av.market_day_supply <= 60 then -5 else -10 end else 0 end - case when not v_allow_salvage and coalesce(av.title_status, '') ilike '%salvage%' then 50 else 0 end - case when av.cr_score is not null and v_min_cr > 0 and av.cr_score < v_min_cr then 25 else 0 end - case when coalesce(av.mileage, 0) > v_max_mileage then 15 else 0 end - case when coalesce(av.estimated_recon_cost, 0) > v_max_recon then 15 else 0 end - case when coalesce(av.estimated_profit, 0) < 0 then 40 else 0 end)) >= 50 then 'Worth reviewing, but does not fully match your preferred buying criteria.'
        else 'Does not align with your dealership buying strategy.'
      end
  where av.run_list_id = p_run_list_id;
end;
$function$;
```

</details>

---

## 2. Add damage & condition fields to auction_vehicles

**Type:** SQL (run once)
**Why:** New columns for `damage_location`, `damage_type`, `drive_condition`, `body_condition`, `key_status` were added to capture IAA/salvage vehicle condition data.

```sql
ALTER TABLE public.auction_vehicles
  ADD COLUMN IF NOT EXISTS damage_location text,
  ADD COLUMN IF NOT EXISTS damage_type text,
  ADD COLUMN IF NOT EXISTS drive_condition text,
  ADD COLUMN IF NOT EXISTS body_condition text,
  ADD COLUMN IF NOT EXISTS key_status text;
```

---

## 3. Damage recon adjustment in profit engine

**Type:** SQL (run once)
**Why:** Recon cost estimate now factors in damage severity from `damage_location` and `damage_type`.

> Paste contents of `supabase/migrations/20260605010000_add_damage_recon_adjustment.sql`

---

## 4. Fix IAA title_status showing as "clean" for salvage vehicles

**Type:** SQL + Edge Function redeploy
**Why:** Two separate issues: (a) the `title_status` column defaulted to `'clean'` so any vehicle where title wasn't extracted got falsely marked clean; (b) the `parse-run-list` function had 4 gaps where IAA title was not extracted.

**4a — Remove false default (SQL):**
```sql
ALTER TABLE public.auction_vehicles ALTER COLUMN title_status DROP DEFAULT;
```

**4b — Redeploy `parse-run-list` edge function.**
The function now correctly extracts title from IAA PDFs and CSVs across all parsing paths (OCR JSON, OCR text-fallback, AI text parser, and the JSON coercion layer).

---

## 5. Fix IAA duplicate vehicles on upload

**Type:** Edge Function redeploy only (no SQL)
**Why:** When an IAA PDF was parsed, every vehicle appeared twice. The `dedupeVehicleRows` helper was only applied to spreadsheet uploads, not PDF uploads. It is now applied to all PDF parsing as well.

**5a — Redeploy `parse-run-list` edge function** (same deploy as items 4b and 6b below).

---

## 6. Add `lot_number` column — separate IAA Lot # from Run #

**Type:** SQL + Edge Function redeploy
**Why:** IAA vehicles have a Lot # (e.g. "44789294") that was incorrectly stored in the `run_order` column. They are now stored separately: `run_order` stays for lane-sequence run numbers, `lot_number` holds the IAA/stock number. The UI now shows `Lot #` in the detail view and `lot_number ?? run_order` in the table.

**6a — Add column (SQL):**
```sql
ALTER TABLE public.auction_vehicles ADD COLUMN IF NOT EXISTS lot_number text;
```

**6b — Redeploy `parse-run-list` edge function.**
The parser now routes IAA "Stock #" → `lot_number` and leaves `run_order` and `lane` null for IAA vehicles (since they don't have a lane-based run order).

---

## 7. Fix "Clear" title being flagged as "Title risk"

**Type:** SQL (run once)
**Why:** IAA uses "Clear" to mean clean/unbranded title. The scoring function only matched `ilike '%clean%'`, so "Clear" vehicles were incorrectly getting a "Title risk" flag and "Title requires review" reason. Now both "Clean" and "Clear" are treated as clean titles.

> Paste contents of `supabase/migrations/20260606020000_fix_clear_title_scoring.sql`

After applying, hit **Regenerate** on any existing run list to re-score with the fix.

---

## How to deploy edge functions to client project

Run these commands with the client's access token and project ref:

```bash
npx supabase login --token <CLIENT_ACCESS_TOKEN>
npx supabase functions deploy parse-run-list enrich-vehicles update-retail-values generate-vehicle-insight --project-ref <CLIENT_PROJECT_REF> --use-api
```

> Items to ask the client for at handover time:
> - Supabase project ref (visible in their dashboard URL)
> - Personal access token (Supabase → Account → Access Tokens)

---

## Verification after applying all changes

Run in Supabase SQL Editor to confirm titles are being stored:

```sql
-- Check title_status distribution on latest run list
SELECT title_status, count(*)
FROM public.auction_vehicles
WHERE run_list_id = (SELECT id FROM auction_run_lists ORDER BY created_at DESC LIMIT 1)
GROUP BY title_status
ORDER BY count(*) DESC;

-- Confirm salvage vehicles are being flagged correctly
SELECT vin, make, model, year, title_status, estimated_profit, profit_score, ai_recommendation
FROM public.auction_vehicles
WHERE run_list_id = (SELECT id FROM auction_run_lists ORDER BY created_at DESC LIMIT 1)
  AND title_status ILIKE '%salvage%'
LIMIT 20;
```
