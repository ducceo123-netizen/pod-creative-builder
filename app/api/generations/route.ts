import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";

export async function POST(request: Request) {
  try {
    const version = await request.json();
    if (!version?.id || !version?.draftId) {
      return NextResponse.json({ error: "Generation version id and draftId are required." }, { status: 400 });
    }

    const response = await supabaseRest("generation_versions?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          id: version.id,
          draft_id: version.draftId,
          label: version.label || "Generation",
          source: version.generationMeta?.generationSource || null,
          model: version.generationMeta?.model || null,
          fallback_used: Boolean(version.generationMeta?.fallbackUsed),
          fallback_reason: version.generationMeta?.fallbackReason || null,
          version,
          created_at: version.createdAt || new Date().toISOString(),
        },
      ]),
    });

    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ source: "supabase", version });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Generation version could not be saved to Supabase.",
      },
      { status: 200 },
    );
  }
}
