export type ArtworkAssetType =
  | "main_artwork"
  | "character_clipart"
  | "face_integration"
  | "typography"
  | "quote_layout"
  | "name_layout"
  | "background_pattern"
  | "material_detail"
  | "product_structure"
  | "print_composition"
  | "product_mockup"
  | "lifestyle_scene"
  | "meta_ad_scene"
  | "ugc_reel_frame"
  | "shopify_hero"
  | "before_after"
  | "gif_frame_sequence";

export type ArtworkAssetGroup = "Product Design Assets" | "Material / Structure Assets" | "Mockup Assets" | "Ad Creative Assets";

export type ArtworkAsset = {
  id: string;
  projectId?: string;
  generationId?: string;
  conceptId: string;
  conceptName: string;
  assetGroup: ArtworkAssetGroup;
  assetType: ArtworkAssetType;
  title: string;
  purpose: string;
  prompt: string;
  recommendedTool: "ChatGPT" | "Midjourney" | "Ideogram" | "Figma" | "Any";
  recommendedRatio?: string;
  outputFormat?: "PNG transparent" | "JPG mockup" | "SVG/vector reference" | "Prompt only";
  priority: "Must Have" | "Good To Have" | "Optional";
  status: "Not Started" | "Copied" | "Generated Externally" | "Approved" | "Needs Revision";
  createdAt: string;
  updatedAt: string;
};
