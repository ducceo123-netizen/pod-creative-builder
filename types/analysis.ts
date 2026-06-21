export type ScoreLevel = "low" | "medium" | "high";
export type DifficultyLevel = "easy" | "medium" | "hard";

export type ProductBreakdown = {
  productType: string;
  coreBuyer: string;
  coreOccasion: string;
  coreEmotion: string;
  visualMechanism: string;
  personalizationLogic: string;
  likelyPurchaseReason: string;
};

export type CustomField = {
  name: string;
  example: string;
  emotionalValue: ScoreLevel;
  difficulty: DifficultyLevel;
  recommended: boolean;
  shopifyOptionLabel?: string;
};

export type ProductScores = {
  customDepth: ScoreLevel;
  adsPotential: ScoreLevel;
  productionDifficulty: DifficultyLevel;
  copyRisk: ScoreLevel;
};

export type InspirationRules = {
  keepAsInspiration: string[];
  doNotCopy: string[];
  safeTransformationDirections: string[];
};

export type Analysis = {
  id: string;
  projectId: string;
  productBreakdown: ProductBreakdown;
  customFields: CustomField[];
  inspirationRules: InspirationRules;
  improvementOpportunities: string[];
  scores: ProductScores;
};
