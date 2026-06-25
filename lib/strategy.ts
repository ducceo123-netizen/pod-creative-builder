import { generateAnalysis, generateConcepts, generateCopyPack, generatePromptPack } from "@/lib/generate";
import { normalizeProject } from "@/lib/normalizeProject";
import { buildProductDecomposition } from "@/lib/productDecomposition";
import type { Analysis } from "@/types/analysis";
import type { Concept } from "@/types/concept";
import type { CopyPack } from "@/types/copyPack";
import type { ComponentAssetPlan, DesignComponent, PersonalizationItem, SafeTransformationPlan } from "@/types/productDecomposition";
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
  designComponents?: DesignComponent[];
  personalizationMap?: PersonalizationItem[];
  componentAssetPlan?: ComponentAssetPlan[];
  materialNotes?: string[];
  safeTransformationPlan?: SafeTransformationPlan;
};

export function buildLocalStrategy(project: Project): GenerateStrategyResponse {
  const normalized = normalizeProject(project);
  const analysis = generateAnalysis(project);
  const concepts = generateConcepts(project, analysis);
  const promptPacks: Record<string, PromptPack> = {};
  const copyPacks: Record<string, CopyPack> = {};

  concepts
    .filter((concept) => concept.selected)
    .forEach((concept) => {
      promptPacks[concept.id] = generatePromptPack(concept, normalized.normalizedProductType);
      copyPacks[concept.id] = generateCopyPack(concept, normalized.normalizedProductType);
    });

  const decomposition = buildProductDecomposition(project, analysis);
  return {
    analysis,
    concepts,
    promptPacks,
    copyPacks,
    designComponents: decomposition.designComponents,
    personalizationMap: decomposition.personalizationMap,
    componentAssetPlan: decomposition.componentAssetPlan,
    materialNotes: decomposition.materialNotes,
    safeTransformationPlan: decomposition.safeTransformationPlan,
  };
}
