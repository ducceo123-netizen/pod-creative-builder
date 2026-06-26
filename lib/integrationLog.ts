import { supabaseRest } from "@/lib/supabaseRest";

export async function logIntegrationRun(input: {
  id: string;
  draftId?: string | null;
  integrationType: string;
  status: string;
  payload: unknown;
  response?: unknown;
}) {
  try {
    await supabaseRest("integration_runs?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: input.id,
        draft_id: input.draftId || null,
        integration_type: input.integrationType,
        status: input.status,
        payload: input.payload,
        response: input.response || null,
      }),
    });
  } catch {
    // Integration actions should not fail just because logging is unavailable.
  }
}
