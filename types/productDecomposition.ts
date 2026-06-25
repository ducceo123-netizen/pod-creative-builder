export type DesignComponent = {
  id: string;
  name: string;
  componentType:
    | "uploaded_photo"
    | "clipart"
    | "character_body"
    | "face_cutout"
    | "typography"
    | "quote_text"
    | "name_text"
    | "date_text"
    | "badge"
    | "frame"
    | "background"
    | "pattern"
    | "product_base"
    | "material_effect"
    | "print_area"
    | "mockup_context"
    | "personalization_option"
    | "decorative_element";
  role:
    | "customer_input"
    | "ai_generated_asset"
    | "template_asset"
    | "manual_design_layer"
    | "product_material"
    | "mockup_scene"
    | "production_layer";
  description: string;
  sourceFromCompetitor: string;
  shouldKeepAsMechanism: boolean;
  shouldChangeForOriginality: boolean;
  copyRisk: "Low" | "Medium" | "High";
  suggestedReplacement?: string;
  generationPrompt?: string;
  materialNotes?: string;
  teeinblueLayerSuggestion?: string;
};

export type PersonalizationItem = {
  id: string;
  label: string;
  inputType: "photo_upload" | "text" | "dropdown" | "color" | "number" | "date" | "checkbox";
  examples: string[];
  required: boolean;
  mapsToComponentId: string;
  teeinblueFieldType?: "photo" | "text" | "dropdown" | "checkbox" | "color";
  customerFacingLabel: string;
  productionNote: string;
};

export type ComponentAssetPlan = {
  id: string;
  componentId: string;
  assetName: string;
  assetPurpose: string;
  assetSource: "customer_upload" | "ai_generated" | "manual_design" | "fixed_template" | "mockup_context";
  required: boolean;
  priority: "Must Have" | "Should Have" | "Optional";
  recommendedFormat: "PNG transparent" | "PNG" | "JPG" | "SVG" | "PSD" | "Text layer" | "Prompt only";
  recommendedTool: "ChatGPT" | "Ideogram" | "Midjourney" | "Figma" | "Photoshop" | "Teeinblue" | "Any";
  suggestedSize?: string;
  prompt: string;
  status: "Not Started" | "Prompt Copied" | "Generated" | "Uploaded" | "Approved" | "Needs Revision";
};

export type SafeTransformationPlan = {
  keep: string[];
  change: string[];
  avoid: string[];
  originalityMoves: string[];
  copyRisk: "Low" | "Medium" | "High";
};

export type ProductDecomposition = {
  designComponents: DesignComponent[];
  personalizationMap: PersonalizationItem[];
  componentAssetPlan: ComponentAssetPlan[];
  materialNotes: string[];
  safeTransformationPlan: SafeTransformationPlan;
};
