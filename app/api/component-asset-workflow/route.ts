import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";
import type { ComponentAssetPlan } from "@/types/productDecomposition";

type ComponentAssetWorkflowState = Record<
  string,
  {
    status: ComponentAssetPlan["status"];
    uploadedAssetUrl?: string;
    uploadedAssetName?: string;
    uploadedAssetType?: string;
    uploadedAssetSource?: "local" | "supabase-storage";
    uploadedAssetStoragePath?: string;
    updatedAt: string;
  }
>;

function rowId(draftId: string, assetId: string) {
  return `${draftId}:${assetId}`.replace(/[^a-zA-Z0-9:_-]/g, "-");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { draftId?: string; workflow?: ComponentAssetWorkflowState };
    if (!body.draftId || !body.workflow || typeof body.workflow !== "object") {
      return NextResponse.json({ error: "draftId and workflow are required." }, { status: 400 });
    }

    const rows = Object.entries(body.workflow).map(([assetId, entry]) => ({
      id: rowId(body.draftId || "", assetId),
      draft_id: body.draftId,
      asset_id: assetId,
      status: entry.status,
      uploaded_asset_url: entry.uploadedAssetUrl || null,
      uploaded_asset_name: entry.uploadedAssetName || null,
      uploaded_asset_type: entry.uploadedAssetType || null,
      uploaded_asset_source: entry.uploadedAssetSource || null,
      uploaded_asset_storage_path: entry.uploadedAssetStoragePath || null,
      workflow: entry,
      updated_at: entry.updatedAt,
    }));

    if (!rows.length) return NextResponse.json({ source: "supabase", saved: 0 });

    const response = await supabaseRest("component_asset_workflow?on_conflict=id", {
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
        error: error instanceof Error ? error.message : "Component asset workflow could not be saved to Supabase.",
      },
      { status: 200 },
    );
  }
}
