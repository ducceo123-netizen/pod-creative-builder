import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";
import type { TeeinbluePackageSync } from "@/types/designPackage";

async function upsert(path: string, rows: unknown[]) {
  if (!rows.length) return;
  const response = await supabaseRest(path, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { draftId?: string; packages?: TeeinbluePackageSync[] };
    if (!body.draftId || !Array.isArray(body.packages)) {
      return NextResponse.json({ error: "draftId and packages are required." }, { status: 400 });
    }

    const packages = body.packages;
    const assetSlotRows = packages.flatMap((item) =>
      item.assetSlots.map((slot) => ({
        id: slot.id,
        draft_id: body.draftId,
        project_id: slot.projectId,
        generation_id: slot.generationId || null,
        concept_id: slot.conceptId,
        slot_key: slot.slotKey,
        title: slot.title,
        description: slot.description,
        asset_type: slot.assetType,
        required: slot.required,
        recommended_format: slot.recommendedFormat,
        recommended_size: slot.recommendedSize || null,
        prompt: slot.prompt,
        uploaded_asset_url: slot.uploadedAssetUrl || null,
        status: slot.status,
        slot: slot,
        created_at: slot.createdAt,
        updated_at: slot.updatedAt,
      })),
    );

    const layoutRows = packages.map((item) => ({
      id: item.layoutPlan.id,
      draft_id: body.draftId,
      project_id: item.projectId,
      generation_id: item.generationId || null,
      concept_id: item.conceptId,
      concept_name: item.conceptName,
      product_type: item.productType,
      canvas: item.layoutPlan.canvas,
      print_area: item.layoutPlan.printArea,
      layout: item.layoutPlan,
      manifest: item.manifest,
      setup_guide: item.setupGuide,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    }));

    const layerRows = packages.flatMap((item) =>
      item.layoutPlan.layers.map((layer) => ({
        id: layer.id,
        layout_id: item.layoutPlan.id,
        draft_id: body.draftId,
        concept_id: item.conceptId,
        slot_key: layer.slotKey,
        name: layer.name,
        type: layer.type,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation || 0,
        z_index: layer.zIndex,
        teeinblue_role: layer.teeinblueRole,
        visible_on: layer.visibleOn,
        layer: layer,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
    );

    const uploadedAssetRows = packages.flatMap((item) =>
      item.uploadedAssets.map((asset) => ({
        id: asset.id,
        draft_id: body.draftId,
        asset_slot_id: asset.slotId,
        artwork_asset_id: asset.artworkAssetId,
        concept_id: asset.conceptId,
        filename: asset.filename,
        content_type: asset.contentType || null,
        storage_url: asset.url,
        local_preview: asset.localPreview,
        metadata: asset,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
    );

    await upsert("asset_slots?on_conflict=id", assetSlotRows);
    await upsert("layout_plans?on_conflict=id", layoutRows);
    await upsert("design_layer_plans?on_conflict=id", layerRows);
    await upsert("uploaded_assets?on_conflict=id", uploadedAssetRows);

    return NextResponse.json({
      source: "supabase",
      saved: {
        packages: packages.length,
        assetSlots: assetSlotRows.length,
        layoutPlans: layoutRows.length,
        layers: layerRows.length,
        uploadedAssets: uploadedAssetRows.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Design package could not be saved to Supabase.",
      },
      { status: 200 },
    );
  }
}
