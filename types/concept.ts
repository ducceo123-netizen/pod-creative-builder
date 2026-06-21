import type { ProductScores } from "./analysis";

export type Concept = {
  id: string;
  projectId: string;
  name: string;
  oneLineIdea: string;
  buyer: string;
  occasion: string;
  emotion: string;
  customFields: string[];
  designDirection: string;
  mockupDirection: string;
  adHook: string;
  selected: boolean;
  scores: ProductScores;
};
