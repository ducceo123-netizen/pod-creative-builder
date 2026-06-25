import type { ArtworkAsset, ArtworkAssetType } from "@/types/artworkAsset";
import type { Concept } from "@/types/concept";
import type { AssetSlot, DesignLayoutPlan, DesignLayerPlan, TeeinbluePackageSync } from "@/types/designPackage";
import type { Project } from "@/types/project";

function fileSafe(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "asset";
}

function layerName(asset: ArtworkAsset) {
  if (asset.assetType === "face_integration") return "CUSTOM_PHOTO";
  if (asset.assetType === "typography" || asset.assetType === "quote_layout") return "CUSTOM_QUOTE";
  if (asset.assetType === "name_layout") return "CUSTOM_NAME";
  if (asset.assetType === "character_clipart" || asset.assetType === "main_artwork") return "ARTWORK_BASE";
  if (asset.assetType === "product_structure") return "ORDER_GUIDE_DO_NOT_PRINT";
  if (asset.assetType === "material_detail") return "PREVIEW_MATERIAL_DETAIL";
  if (asset.assetGroup === "Mockup Assets") return "MOCKUP_PREVIEW_ONLY";
  return asset.title.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function mapAssetType(assetType: ArtworkAssetType): AssetSlot["assetType"] {
  if (assetType === "face_integration") return "face_photo";
  if (assetType === "background_pattern") return "pattern";
  if (assetType === "lifestyle_scene") return "lifestyle_context";
  if (assetType === "shopify_hero" || assetType === "product_mockup") return "mockup_base";
  if (assetType === "meta_ad_scene" || assetType === "ugc_reel_frame" || assetType === "before_after" || assetType === "gif_frame_sequence") return "ad_creative";
  if (assetType === "print_composition") return "main_artwork";
  return assetType;
}

function statusForSlot(asset: ArtworkAsset): AssetSlot["status"] {
  if (asset.status === "Approved") return "Approved";
  if (asset.status === "Needs Revision") return "Needs Revision";
  if (asset.uploadedAssetUrl || asset.status === "Uploaded") return "Uploaded";
  if (asset.status === "Copied" || asset.status === "Generated Externally") return "Prompt Copied";
  return "Missing";
}

function recommendedFormat(asset: ArtworkAsset): AssetSlot["recommendedFormat"] {
  if (asset.outputFormat === "PNG transparent") return "PNG transparent";
  if (asset.outputFormat === "JPG mockup") return "JPG";
  if (asset.outputFormat === "SVG/vector reference") return "SVG";
  return "Prompt only";
}

export function getTeeinblueCanvas(productType: string) {
  const product = productType.toLowerCase();
  if (product.includes("shirt") || product.includes("hoodie") || product.includes("sweatshirt")) {
    return { width: 4500, height: 5400, safeMargin: 180, printAreaName: "Front" };
  }
  if (product.includes("mug")) {
    return { width: 2700, height: 1125, safeMargin: 90, printAreaName: "Wrap" };
  }
  return { width: 3000, height: 3000, safeMargin: 120, printAreaName: "Main" };
}

export function buildAssetSlots(project: Project, concept: Concept, assets: ArtworkAsset[]): AssetSlot[] {
  const canvas = getTeeinblueCanvas(project.productType || "Custom POD Product");
  return assets.map((asset) => ({
    id: `slot-${asset.id}`,
    projectId: project.id,
    generationId: asset.generationId || "",
    conceptId: concept.id,
    slotKey: layerName(asset),
    title: asset.title,
    description: asset.purpose,
    assetType: mapAssetType(asset.assetType),
    required: asset.priority === "Must Have",
    recommendedFormat: recommendedFormat(asset),
    recommendedSize: asset.assetGroup === "Product Design Assets" ? { width: canvas.width, height: canvas.height } : undefined,
    prompt: asset.prompt,
    uploadedAssetUrl: asset.uploadedAssetUrl,
    status: statusForSlot(asset),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }));
}

function roleForLayer(asset: ArtworkAsset): DesignLayerPlan["teeinblueRole"] {
  if (asset.assetType === "face_integration") return "personalization_photo";
  if (asset.assetType === "typography" || asset.assetType === "quote_layout" || asset.assetType === "name_layout") return "personalization_text";
  if (asset.assetType === "product_structure") return "guide_do_not_print";
  if (asset.assetGroup === "Mockup Assets" || asset.assetGroup === "Ad Creative Assets") return "preview_only";
  return "base_artwork";
}

function layerBox(asset: ArtworkAsset, canvas: ReturnType<typeof getTeeinblueCanvas>, index: number) {
  const w = canvas.width;
  const h = canvas.height;
  if (asset.assetType === "face_integration") return { x: w * 0.36, y: h * 0.14, width: w * 0.28, height: h * 0.2 };
  if (asset.assetType === "typography" || asset.assetType === "quote_layout") return { x: w * 0.18, y: h * 0.05, width: w * 0.64, height: h * 0.14 };
  if (asset.assetType === "name_layout") return { x: w * 0.18, y: h * 0.78, width: w * 0.64, height: h * 0.12 };
  if (asset.assetType === "product_structure") return { x: canvas.safeMargin, y: canvas.safeMargin, width: w - canvas.safeMargin * 2, height: h - canvas.safeMargin * 2 };
  if (asset.assetGroup === "Mockup Assets" || asset.assetGroup === "Ad Creative Assets") return { x: w * 0.68, y: h * (0.1 + index * 0.06), width: w * 0.22, height: h * 0.16 };
  return { x: w * 0.2, y: h * 0.18, width: w * 0.6, height: h * 0.58 };
}

export function buildDesignLayoutPlan(project: Project, concept: Concept, assets: ArtworkAsset[]): DesignLayoutPlan {
  const canvas = getTeeinblueCanvas(project.productType || "Custom POD Product");
  const printableAssets = assets.filter((asset) => asset.assetGroup !== "Ad Creative Assets");
  return {
    id: `layout-${concept.id}`,
    projectId: project.id,
    generationId: assets[0]?.generationId || "",
    conceptId: concept.id,
    canvas: { width: canvas.width, height: canvas.height, unit: "px", background: "transparent" },
    printArea: { name: canvas.printAreaName, width: canvas.width, height: canvas.height, safeMargin: canvas.safeMargin },
    layers: printableAssets.map((asset, index) => {
      const box = layerBox(asset, canvas, index);
      return {
        id: `layer-${asset.id}`,
        name: layerName(asset),
        slotKey: layerName(asset),
        type: asset.uploadedAssetUrl ? "image" : "placeholder",
        ...box,
        zIndex: index + 1,
        teeinblueRole: roleForLayer(asset),
        visibleOn: roleForLayer(asset) === "preview_only" ? "mockup_only" : roleForLayer(asset) === "guide_do_not_print" ? "order_only" : "mockup_and_order",
      };
    }),
  };
}

export function buildTeeinblueManifest(project: Project, concept: Concept, assets: ArtworkAsset[]) {
  const layout = buildDesignLayoutPlan(project, concept, assets);
  const slots = buildAssetSlots(project, concept, assets);
  return {
    skuName: concept.name,
    productType: project.productType || "Custom POD Product",
    printAreas: [
      {
        name: layout.printArea.name,
        canvasWidth: layout.canvas.width,
        canvasHeight: layout.canvas.height,
        safeMargin: layout.printArea.safeMargin,
      },
    ],
    layers: layout.layers.map((layer) => ({
      name: layer.name,
      assetFile: `${fileSafe(layer.name)}.${layer.name.includes("TEXT") || layer.name.includes("QUOTE") || layer.name.includes("NAME") ? "txt" : "png"}`,
      role: layer.teeinblueRole,
      visibleOn: layer.visibleOn,
      required: slots.find((slot) => slot.slotKey === layer.slotKey)?.required || false,
    })),
    personalizationFields: slots
      .filter((slot) => slot.slotKey.startsWith("CUSTOM_"))
      .map((slot) => ({
        label: slot.title,
        type: slot.assetType === "face_photo" ? "photo" : "text",
        mapsToLayer: slot.slotKey,
      })),
  };
}

export function formatTeeinblueSetupGuide(project: Project, concept: Concept, assets: ArtworkAsset[]) {
  const layout = buildDesignLayoutPlan(project, concept, assets);
  const slots = buildAssetSlots(project, concept, assets);
  const manifest = buildTeeinblueManifest(project, concept, assets);
  return `# Teeinblue Setup Guide

## 1. Product Overview
- SKU: ${concept.name}
- Product type: ${project.productType || "Custom POD Product"}
- Buyer / occasion: ${concept.buyer} / ${concept.occasion}

## 2. Canvas And Print Area
- Print area: ${layout.printArea.name}
- Canvas: ${layout.canvas.width} x ${layout.canvas.height} px
- Safe margin: ${layout.printArea.safeMargin}px
- Background: ${layout.canvas.background}

## 3. Required Artwork Layers
${slots.filter((slot) => slot.required).map((slot) => `- ${slot.slotKey}: ${slot.title} (${slot.status})`).join("\n") || "- No required layers generated."}

## 4. Personalization Fields
${manifest.personalizationFields.map((field) => `- ${field.label}: ${field.type}, maps to ${field.mapsToLayer}`).join("\n") || "- No personalization layers detected."}

## 5. Preview Vs Order Design Layers
${layout.layers.map((layer) => `- ${layer.name}: ${layer.teeinblueRole}, ${layer.visibleOn}`).join("\n")}

## 6. Recommended Upload Order
${layout.layers.map((layer, index) => `${index + 1}. ${layer.name}`).join("\n")}

## 7. QA Checklist Before Listing
- Confirm every required slot is uploaded or intentionally prompt-only.
- Confirm text layers are readable at product thumbnail size.
- Confirm photo upload fields map to the correct personalization layer.
- Confirm guide layers are hidden or marked as do-not-print.
- Confirm order design layers match the buyer-facing preview.
`;
}

export function buildTeeinbluePackageSync(draftId: string, project: Project, concept: Concept, assets: ArtworkAsset[]): TeeinbluePackageSync {
  const now = new Date().toISOString();
  const assetSlots = buildAssetSlots(project, concept, assets);
  const layoutPlan = buildDesignLayoutPlan(project, concept, assets);
  const manifest = buildTeeinblueManifest(project, concept, assets);
  const setupGuide = formatTeeinblueSetupGuide(project, concept, assets);

  return {
    id: `teeinblue-package-${concept.id}`,
    draftId,
    projectId: project.id,
    generationId: assets[0]?.generationId || "",
    conceptId: concept.id,
    conceptName: concept.name,
    productType: project.productType || "Custom POD Product",
    assetSlots,
    layoutPlan,
    manifest,
    setupGuide,
    uploadedAssets: assets
      .filter((asset) => asset.uploadedAssetUrl)
      .map((asset) => {
        const slot = assetSlots.find((item) => item.slotKey === layerName(asset));
        return {
          id: `uploaded-${asset.id}`,
          artworkAssetId: asset.id,
          slotId: slot?.id || `slot-${asset.id}`,
          conceptId: concept.id,
          filename: asset.uploadedAssetName || `${fileSafe(asset.title)}.png`,
          contentType: asset.uploadedAssetType,
          url: asset.uploadedAssetUrl || "",
          localPreview: asset.uploadedAssetSource !== "supabase-storage",
        };
      }),
    createdAt: now,
    updatedAt: now,
  };
}
