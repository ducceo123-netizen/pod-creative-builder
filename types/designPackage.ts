export type AssetSlot = {
  id: string;
  projectId: string;
  generationId: string;
  conceptId: string;
  slotKey: string;
  title: string;
  description: string;
  assetType:
    | "main_artwork"
    | "character_clipart"
    | "face_photo"
    | "typography"
    | "quote_layout"
    | "name_layout"
    | "background_shape"
    | "pattern"
    | "frame"
    | "material_detail"
    | "product_structure"
    | "mockup_base"
    | "lifestyle_context"
    | "ad_creative";
  required: boolean;
  recommendedFormat: "PNG transparent" | "PNG" | "JPG" | "SVG" | "PSD" | "Prompt only";
  recommendedSize?: {
    width: number;
    height: number;
  };
  prompt: string;
  uploadedAssetUrl?: string;
  status: "Missing" | "Prompt Copied" | "Uploaded" | "Approved" | "Needs Revision";
  createdAt: string;
  updatedAt: string;
};

export type DesignLayoutPlan = {
  id: string;
  projectId: string;
  generationId: string;
  conceptId: string;
  canvas: {
    width: number;
    height: number;
    unit: "px";
    background: "transparent" | "white" | "custom";
  };
  printArea: {
    name: string;
    width: number;
    height: number;
    safeMargin: number;
  };
  layers: DesignLayerPlan[];
};

export type DesignLayerPlan = {
  id: string;
  name: string;
  slotKey: string;
  type: "image" | "text" | "guide" | "placeholder";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  teeinblueRole:
    | "base_artwork"
    | "personalization_photo"
    | "personalization_text"
    | "option_layer"
    | "preview_only"
    | "order_design_only"
    | "guide_do_not_print";
  visibleOn: "mockup_and_order" | "mockup_only" | "order_only";
};
