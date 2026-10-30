import { supabase } from '@/integrations/supabase/client';

export type ScoringPipelineStepError = {
  step: string;
  message: string;
  fatal: boolean;
};

export type ScoringPipelineResult = {
  ok: boolean;
  errors: ScoringPipelineStepError[];
};

export type RunListScoringPipelineOptions = {
  /** Reset recommendations before rescoring (regenerate flow). */
  resetRecommendations?: boolean;
};

/**
 * Single source of truth for run-list scoring after parse/upload.
 * Used by initial upload (ProcessingScreen) and Buy List regenerate so every
 * auction format — ADESA, Manheim, CarMax, IAA, CSV, Excel — gets the same pipeline.
 */
export async function runRunListScoringPipeline(
  runListId: string,
  options: RunListScoringPipelineOptions = {},
): Promise<ScoringPipelineResult> {
  const errors: ScoringPipelineStepError[] = [];

  const runRpc = async (
    step: string,
    rpc: () => PromiseLike<{ error: { message: string } | null }>,
    fatal = true,
  ): Promise<boolean> => {
    const { error } = await rpc();
    if (error) {
      errors.push({ step, message: error.message, fatal });
      return !fatal;
    }
    return true;
  };

  if (options.resetRecommendations) {
    const { error } = await supabase
      .from('auction_vehicles')
      .update({ ai_recommendation: null, ai_summary: null })
      .eq('run_list_id', runListId);
    if (error) {
      errors.push({ step: 'reset_recommendations', message: error.message, fatal: false });
    }
  }

  await runRpc('infer_vehicle_types', () =>
    supabase.rpc('infer_vehicle_types', { p_run_list_id: runListId }),
  false);

  if (!(await runRpc('calculate_run_list_profit_engine', () =>
    supabase.rpc('calculate_run_list_profit_engine', { p_run_list_id: runListId }),
  ))) {
    return { ok: false, errors };
  }

  const { error: mktErr } = await supabase.functions.invoke('update-retail-values', {
    body: { run_list_id: runListId },
  });
  if (mktErr) {
    errors.push({ step: 'update_retail_values', message: mktErr.message, fatal: false });
  }

  // Do NOT re-run profit engine here — it would overwrite market-comp retail/profit
  // values that update-retail-values just computed.

  // Bundled DB step: demand scoring → vehicle scoring → hard filters →
  // ai_recommendation assignment → recommendation reasons.
  const finalizeResult = await supabase.rpc('finalize_run_list_scoring', { p_run_list_id: runListId });
  if (finalizeResult.error) {
    const missingFn = /finalize_run_list_scoring/i.test(finalizeResult.error.message);
    if (missingFn) {
      const legacySteps: Array<{ step: string; rpc: () => ReturnType<typeof supabase.rpc>; fatal?: boolean }> = [
        { step: 'apply_dealer_demand_scoring', rpc: () => supabase.rpc('apply_dealer_demand_scoring', { p_run_list_id: runListId }) },
        { step: 'apply_vehicle_scoring', rpc: () => supabase.rpc('apply_vehicle_scoring', { p_run_list_id: runListId }) },
        { step: 'apply_hard_preference_filters', rpc: () => supabase.rpc('apply_hard_preference_filters', { p_run_list_id: runListId }), fatal: false },
        { step: 'apply_recommendation_from_score', rpc: () => supabase.rpc('apply_recommendation_from_score', { p_run_list_id: runListId }) },
        { step: 'generate_vehicle_recommendation_reason', rpc: () => supabase.rpc('generate_vehicle_recommendation_reason', { p_run_list_id: runListId }) },
      ];
      for (const { step, rpc, fatal = true } of legacySteps) {
        if (!(await runRpc(step, rpc, fatal))) {
          return { ok: false, errors };
        }
      }
    } else {
      errors.push({ step: 'finalize_run_list_scoring', message: finalizeResult.error.message, fatal: true });
      return { ok: false, errors };
    }
  }

  return { ok: errors.every((e) => !e.fatal), errors };
}

export function firstFatalScoringError(result: ScoringPipelineResult): string | null {
  return result.errors.find((e) => e.fatal)?.message ?? null;
}

export function scoringWarnings(result: ScoringPipelineResult): string[] {
  return result.errors.filter((e) => !e.fatal).map((e) => `${e.step}: ${e.message}`);
}
