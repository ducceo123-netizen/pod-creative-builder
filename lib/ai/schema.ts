import { z } from "zod";

const ScoreLevelSchema = z.enum(["low", "medium", "high"]);
const DifficultyLevelSchema = z.enum(["easy", "medium", "hard"]);

export const ProductScoresSchema = z.object({
  customDepth: ScoreLevelSchema,
  adsPotential: ScoreLevelSchema,
  productionDifficulty: DifficultyLevelSchema,
  copyRisk: ScoreLevelSchema,
});

export const CustomFieldSchema = z.object({
  name: z.string(),
  example: z.string(),
  emotionalValue: ScoreLevelSchema,
  difficulty: DifficultyLevelSchema,
  recommended: z.boolean(),
  shopifyOptionLabel: z.string().optional(),
});

export const AnalysisSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  productBreakdown: z.object({
    productType: z.string(),
    coreBuyer: z.string(),
    coreOccasion: z.string(),
    coreEmotion: z.string(),
    visualMechanism: z.string(),
    personalizationLogic: z.string(),
    likelyPurchaseReason: z.string(),
  }),
  customFields: z.array(CustomFieldSchema),
  inspirationRules: z.object({
    keepAsInspiration: z.array(z.string()),
    doNotCopy: z.array(z.string()),
    safeTransformationDirections: z.array(z.string()),
  }),
  improvementOpportunities: z.array(z.string()),
  scores: ProductScoresSchema,
});

export const ConceptSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  oneLineIdea: z.string(),
  buyer: z.string(),
  occasion: z.string(),
  emotion: z.string(),
  customFields: z.array(z.string()),
  designDirection: z.string(),
  mockupDirection: z.string(),
  adHook: z.string(),
  selected: z.boolean().default(false),
  scores: ProductScoresSchema,
});

export const PromptPackSchema = z.object({
  id: z.string(),
  conceptId: z.string(),
  designPrompt: z.string(),
  lifestyleMockupPrompt: z.string(),
  banner21x9Prompt: z.string(),
  showcase16x9Prompt: z.string(),
  product468x598Prompt: z.string(),
  square1x1Prompt: z.string(),
  reel9x16Prompt: z.string(),
});

export const CopyPackSchema = z.object({
  id: z.string(),
  conceptId: z.string(),
  shopifyTitles: z.array(z.string()),
  shortDescription: z.string(),
  fullDescription: z.string(),
  bulletBenefits: z.array(z.string()),
  personalizationInstructions: z.string(),
  trustNotes: z.array(z.string()),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
  tags: z.array(z.string()),
  metaHooks: z.array(z.string()),
  primaryTexts: z.array(z.string()),
  headlines: z.array(z.string()),
  ugcScriptIdea: z.string(),
  testingPlan: z.array(z.string()),
});

export const StrategyResponseSchema = z.object({
  analysis: AnalysisSchema,
  concepts: z.array(ConceptSchema).min(1),
  promptPacks: z.record(z.string(), PromptPackSchema),
  copyPacks: z.record(z.string(), CopyPackSchema),
});
