import type { Concept } from "@/types/concept";
import type { CopyPack } from "@/types/copyPack";
import type { Project } from "@/types/project";
import type { PromptPack } from "@/types/promptPack";

export type OutputFlags = {
  productBreakdown: boolean;
  customMap: boolean;
  concepts: boolean;
  designPrompts: boolean;
  mockupPrompts: boolean;
  shopifyCopy: boolean;
  metaAds: boolean;
  seo: boolean;
  exportMarkdown: boolean;
  exportJson: boolean;
};

const has = (outputs: string[], needle: string) => outputs.some((output) => output.toLowerCase().includes(needle));

export function getOutputFlags(project: Project): OutputFlags {
  const outputs = project.outputs || [];
  const showAll = outputs.length === 0;

  return {
    productBreakdown: showAll || has(outputs, "product breakdown"),
    customMap: showAll || has(outputs, "custom fields"),
    concepts: showAll || has(outputs, "product angles"),
    designPrompts: showAll || has(outputs, "design prompts"),
    mockupPrompts: showAll || has(outputs, "mockup prompts"),
    shopifyCopy: showAll || has(outputs, "shopify"),
    metaAds: showAll || has(outputs, "meta ads"),
    seo: showAll || has(outputs, "seo"),
    exportMarkdown: showAll || has(outputs, "markdown"),
    exportJson: showAll || has(outputs, "json"),
  };
}

export function filterPromptPack(pack: PromptPack, flags: OutputFlags): Partial<PromptPack> {
  const filtered: Partial<PromptPack> = {
    id: pack.id,
    conceptId: pack.conceptId,
  };

  if (flags.designPrompts) filtered.designPrompt = pack.designPrompt;
  if (flags.mockupPrompts) {
    filtered.lifestyleMockupPrompt = pack.lifestyleMockupPrompt;
    filtered.banner21x9Prompt = pack.banner21x9Prompt;
    filtered.showcase16x9Prompt = pack.showcase16x9Prompt;
    filtered.product468x598Prompt = pack.product468x598Prompt;
    filtered.square1x1Prompt = pack.square1x1Prompt;
    filtered.reel9x16Prompt = pack.reel9x16Prompt;
  }

  return filtered;
}

export function filterCopyPack(pack: CopyPack, flags: OutputFlags): Partial<CopyPack> {
  const filtered: Partial<CopyPack> = {
    id: pack.id,
    conceptId: pack.conceptId,
  };

  if (flags.shopifyCopy) {
    filtered.shopifyTitles = pack.shopifyTitles;
    filtered.shortDescription = pack.shortDescription;
    filtered.fullDescription = pack.fullDescription;
    filtered.bulletBenefits = pack.bulletBenefits;
    filtered.personalizationInstructions = pack.personalizationInstructions;
    filtered.trustNotes = pack.trustNotes;
    filtered.faqs = pack.faqs;
  }

  if (flags.seo) filtered.tags = pack.tags;

  if (flags.metaAds) {
    filtered.metaHooks = pack.metaHooks;
    filtered.primaryTexts = pack.primaryTexts;
    filtered.headlines = pack.headlines;
    filtered.ugcScriptIdea = pack.ugcScriptIdea;
    filtered.testingPlan = pack.testingPlan;
  }

  return filtered;
}

export function filterExportData({
  project,
  concepts,
  promptPacks,
  copyPacks,
}: {
  project: Project;
  concepts: Concept[];
  promptPacks: Record<string, PromptPack>;
  copyPacks: Record<string, CopyPack>;
}) {
  const flags = getOutputFlags(project);
  const filteredPrompts = Object.fromEntries(
    Object.entries(promptPacks).map(([key, pack]) => [key, filterPromptPack(pack, flags)]),
  );
  const filteredCopies = Object.fromEntries(
    Object.entries(copyPacks).map(([key, pack]) => [key, filterCopyPack(pack, flags)]),
  );

  return {
    concepts: flags.concepts ? concepts : [],
    promptPacks: filteredPrompts,
    copyPacks: filteredCopies,
  };
}
