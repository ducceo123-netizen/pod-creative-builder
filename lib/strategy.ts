import { generateAnalysis, generateConcepts, generateCopyPack, generatePromptPack } from "@/lib/generate";
import type { Analysis } from "@/types/analysis";
import type { Concept } from "@/types/concept";
import type { CopyPack } from "@/types/copyPack";
import type { Project } from "@/types/project";
import type { PromptPack } from "@/types/promptPack";

export type GenerateStrategyRequest = {
  project: Project;
  screenshotBase64?: string | null;
};

export type GenerateStrategyResponse = {
  analysis: Analysis;
  concepts: Concept[];
  promptPacks: Record<string, PromptPack>;
  copyPacks: Record<string, CopyPack>;
};

export function buildLocalStrategy(project: Project): GenerateStrategyResponse {
  const analysis = generateAnalysis(project);
  const concepts = generateConcepts(project, analysis);
  const promptPacks: Record<string, PromptPack> = {};
  const copyPacks: Record<string, CopyPack> = {};

  concepts
    .filter((concept) => concept.selected)
    .forEach((concept) => {
      promptPacks[concept.id] = generatePromptPack(concept, project.productType || "Product");
      copyPacks[concept.id] = generateCopyPack(concept, project.productType || "Product");
    });

  return { analysis, concepts, promptPacks, copyPacks };
}
