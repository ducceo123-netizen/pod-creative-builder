import { z } from "zod";

const ScoreLevelSchema = z.enum(["low", "medium", "high"]);
const DifficultyLevelSchema = z.enum(["easy", "medium", "hard"]);
const StringArraySchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
  if (typeof value === "string") {
    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
  }
  if (value == null) return [];
  return [String(value)];
}, z.array(z.string()));
const StringValueSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n");
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}, z.string());

export const ProductScoresSchema = z.object({
  customDepth: ScoreLevelSchema,
  adsPotential: ScoreLevelSchema,
  productionDifficulty: DifficultyLevelSchema,
  copyRisk: ScoreLevelSchema,
});

export const CustomFieldSchema = z.object({
  name: StringValueSchema,
  example: StringValueSchema,
  emotionalValue: ScoreLevelSchema,
  difficulty: DifficultyLevelSchema,
  recommended: z.boolean(),
  shopifyOptionLabel: StringValueSchema.optional(),
});

export const AnalysisSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  productBreakdown: z.object({
    productType: StringValueSchema,
    coreBuyer: StringValueSchema,
    coreOccasion: StringValueSchema,
    coreEmotion: StringValueSchema,
    visualMechanism: StringValueSchema,
    personalizationLogic: StringValueSchema,
    likelyPurchaseReason: StringValueSchema,
  }),
  customFields: z.array(CustomFieldSchema),
  inspirationRules: z.object({
    keepAsInspiration: StringArraySchema,
    doNotCopy: StringArraySchema,
    safeTransformationDirections: StringArraySchema,
  }),
  improvementOpportunities: StringArraySchema,
  scores: ProductScoresSchema,
});

export const ConceptSchema = z.object({
  id: StringValueSchema,
  projectId: StringValueSchema,
  name: StringValueSchema,
  oneLineIdea: StringValueSchema,
  buyer: StringValueSchema,
  occasion: StringValueSchema,
  emotion: StringValueSchema,
  customFields: StringArraySchema,
  designDirection: StringValueSchema,
  mockupDirection: StringValueSchema,
  adHook: StringValueSchema,
  selected: z.boolean().default(false),
  scores: ProductScoresSchema,
});

export const PromptPackSchema = z.object({
  id: StringValueSchema,
  conceptId: StringValueSchema,
  designPrompt: StringValueSchema,
  lifestyleMockupPrompt: StringValueSchema,
  banner21x9Prompt: StringValueSchema,
  showcase16x9Prompt: StringValueSchema,
  product468x598Prompt: StringValueSchema,
  square1x1Prompt: StringValueSchema,
  reel9x16Prompt: StringValueSchema,
});

export const CopyPackSchema = z.object({
  id: StringValueSchema,
  conceptId: StringValueSchema,
  shopifyTitles: StringArraySchema,
  shortDescription: StringValueSchema,
  fullDescription: StringValueSchema,
  bulletBenefits: StringArraySchema,
  personalizationInstructions: StringValueSchema,
  trustNotes: StringArraySchema,
  faqs: z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === "string") return { question: item, answer: "" };
        return item;
      });
    }
    if (typeof value === "string") return [{ question: value, answer: "" }];
    return [];
  }, z.array(z.object({ question: StringValueSchema, answer: StringValueSchema }))),
  tags: StringArraySchema,
  metaHooks: StringArraySchema,
  primaryTexts: StringArraySchema,
  headlines: StringArraySchema,
  ugcScriptIdea: StringValueSchema,
  testingPlan: StringArraySchema,
});

const DesignComponentSchema = z.object({
  id: StringValueSchema,
  name: StringValueSchema,
  componentType: z.enum([
    "uploaded_photo",
    "clipart",
    "character_body",
    "face_cutout",
    "typography",
    "quote_text",
    "name_text",
    "date_text",
    "badge",
    "frame",
    "background",
    "pattern",
    "product_base",
    "material_effect",
    "print_area",
    "mockup_context",
    "personalization_option",
    "decorative_element",
  ]),
  role: z.enum(["customer_input", "ai_generated_asset", "template_asset", "manual_design_layer", "product_material", "mockup_scene", "production_layer"]),
  description: StringValueSchema,
  sourceFromCompetitor: StringValueSchema,
  shouldKeepAsMechanism: z.boolean(),
  shouldChangeForOriginality: z.boolean(),
  copyRisk: z.enum(["Low", "Medium", "High"]),
  suggestedReplacement: StringValueSchema.optional(),
  generationPrompt: StringValueSchema.optional(),
  materialNotes: StringValueSchema.optional(),
  teeinblueLayerSuggestion: StringValueSchema.optional(),
});

const PersonalizationItemSchema = z.object({
  id: StringValueSchema,
  label: StringValueSchema,
  inputType: z.enum(["photo_upload", "text", "dropdown", "color", "number", "date", "checkbox"]),
  examples: StringArraySchema,
  required: z.boolean(),
  mapsToComponentId: StringValueSchema,
  teeinblueFieldType: z.enum(["photo", "text", "dropdown", "checkbox", "color"]).optional(),
  customerFacingLabel: StringValueSchema,
  productionNote: StringValueSchema,
});

const ComponentAssetPlanSchema = z.object({
  id: StringValueSchema,
  componentId: StringValueSchema,
  assetName: StringValueSchema,
  assetPurpose: StringValueSchema,
  assetSource: z.enum(["customer_upload", "ai_generated", "manual_design", "fixed_template", "mockup_context"]),
  required: z.boolean(),
  priority: z.enum(["Must Have", "Should Have", "Optional"]),
  recommendedFormat: z.enum(["PNG transparent", "PNG", "JPG", "SVG", "PSD", "Text layer", "Prompt only"]),
  recommendedTool: z.enum(["ChatGPT", "Ideogram", "Midjourney", "Figma", "Photoshop", "Teeinblue", "Any"]),
  suggestedSize: StringValueSchema.optional(),
  prompt: StringValueSchema,
  status: z.enum(["Not Started", "Prompt Copied", "Generated", "Uploaded", "Approved", "Needs Revision"]),
});

const SafeTransformationPlanSchema = z.object({
  keep: StringArraySchema,
  change: StringArraySchema,
  avoid: StringArraySchema,
  originalityMoves: StringArraySchema,
  copyRisk: z.enum(["Low", "Medium", "High"]),
});

export const StrategyResponseSchema = z.object({
  analysis: AnalysisSchema,
  concepts: z.array(ConceptSchema).min(1),
  promptPacks: z.record(z.string(), PromptPackSchema),
  copyPacks: z.record(z.string(), CopyPackSchema),
  designComponents: z.array(DesignComponentSchema).optional(),
  personalizationMap: z.array(PersonalizationItemSchema).optional(),
  componentAssetPlan: z.array(ComponentAssetPlanSchema).optional(),
  materialNotes: StringArraySchema.optional(),
  safeTransformationPlan: SafeTransformationPlanSchema.optional(),
});
