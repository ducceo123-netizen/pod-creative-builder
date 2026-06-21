export type CopyPack = {
  id: string;
  conceptId: string;
  shopifyTitles: string[];
  shortDescription: string;
  fullDescription: string;
  bulletBenefits: string[];
  personalizationInstructions: string;
  trustNotes: string[];
  faqs: { question: string; answer: string }[];
  tags: string[];
  metaHooks: string[];
  primaryTexts: string[];
  headlines: string[];
  ugcScriptIdea: string;
  testingPlan: string[];
};
