import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";
import type { ArtworkAsset } from "@/types/artworkAsset";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { draftId?: string; assets?: ArtworkAsset[] };
    if (!body.draftId || !Array.isArray(body.assets)) {
      return NextResponse.json({ error: "draftId and assets are required." }, { status: 400 });
    }

    const rows = body.assets.map((asset) => ({
      id: asset.id,
      draft_id: body.draftId,
      generation_id: asset.generationId || null,
      concept_id: asset.conceptId,
      concept_name: asset.conceptName,
      asset_group: asset.assetGroup,
      asset_type: asset.assetType,
      title: asset.title,
      purpose: asset.purpose,
      prompt: asset.prompt,
      recommended_tool: asset.recommendedTool,
      recommended_ratio: asset.recommendedRatio || null,
      output_format: asset.outputFormat || null,
      priority: asset.priority,
      status: asset.status,
      asset,
      created_at: asset.createdAt,
      updated_at: asset.updatedAt,
    }));

    if (!rows.length) return NextResponse.json({ source: "supabase", saved: 0 });

    const response = await supabaseRest("artwork_assets?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });

    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ source: "supabase", saved: rows.length });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Artwork assets could not be saved to Supabase.",
      },
      { status: 200 },
    );
  }
}
