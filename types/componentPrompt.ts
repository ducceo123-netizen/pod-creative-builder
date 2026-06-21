export type ComponentPromptType =
  | "clipart"
  | "face_integration"
  | "material_detail"
  | "product_structure"
  | "text_quote"
  | "assembly"
  | "background"
  | "lifestyle_context"
  | "meta_ad"
  | "ugc_reel";

export type ComponentPrompt = {
  id: string;
  conceptId: string;
  conceptName: string;
  promptType: ComponentPromptType;
  title: string;
  prompt: string;
  recommendedTool: string;
  recommendedRatio: string;
  recommendedUse: string;
  copyLabel: string;
};

export type ComponentPromptPack = {
  id: string;
  conceptId: string;
  conceptName: string;
  recommendedBuildOrder: string[];
  prompts: ComponentPrompt[];
};
