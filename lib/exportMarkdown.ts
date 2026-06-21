import type { Analysis } from "@/types/analysis";
import type { Concept } from "@/types/concept";
import type { CopyPack } from "@/types/copyPack";
import type { OutputFlags } from "@/lib/outputFilters";
import type { Project } from "@/types/project";
import type { PromptPack } from "@/types/promptPack";

const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

export function exportMarkdown({
  project,
  analysis,
  concepts,
  prompts,
  copies,
  flags,
}: {
  project: Project;
  analysis: Analysis | null;
  concepts: Concept[];
  prompts: Record<string, PromptPack>;
  copies: Record<string, CopyPack>;
  flags: OutputFlags;
}) {
  const selected = concepts.filter((concept) => concept.selected);
  const sections = [`# POD Creative Pack

## Project Brief

- Project: ${project.name}
- Product type: ${project.productType || "Not set"}
- Buyer persona: ${project.buyerPersona || "Not set"}
- Occasion: ${project.occasion || "Not set"}
- Niche: ${project.niche || "Not set"}
- Brand voice: ${project.brandVoice?.join(", ") || "Not set"}
- Visual style: ${project.visualStyle?.join(", ") || "Not set"}
- Competitor: ${project.competitorBrand || "Not set"}
- Competitor URL: ${project.competitorUrl || "Not set"}`];

  if (flags.productBreakdown) {
    sections.push(`## Competitor Product Breakdown

${analysis ? list(Object.entries(analysis.productBreakdown).map(([key, value]) => `**${key}:** ${value}`)) : "No analysis generated yet."}

## Inspiration Rules

### Keep as Inspiration
${analysis ? list(analysis.inspirationRules.keepAsInspiration) : ""}

### Do Not Copy
${analysis ? list(analysis.inspirationRules.doNotCopy) : ""}

### Safe Transformation Directions
${analysis ? list(analysis.inspirationRules.safeTransformationDirections) : ""}`);
  }

  if (flags.customMap) {
    sections.push(`## Customization Map

| Custom Field | Example | Emotional Value | Difficulty | Recommended |
|---|---|---|---|---|
${analysis ? analysis.customFields.map((field) => `| ${field.name} | ${field.example} | ${field.emotionalValue} | ${field.difficulty} | ${field.recommended ? "Yes" : "No"} |`).join("\n") : "| No custom fields generated yet. |  |  |  |  |"}`);
  }

  if (flags.concepts) {
    sections.push(`## Selected Concepts

${selected.map((concept) => `### ${concept.name}
${concept.oneLineIdea}

- Buyer: ${concept.buyer}
- Occasion: ${concept.occasion}
- Emotion: ${concept.emotion}
- Custom fields: ${concept.customFields.join(", ")}
- Ad hook: ${concept.adHook}`).join("\n\n") || "No selected concepts yet."}`);
  }

  if (flags.designPrompts) {
    sections.push(`## Design Prompts

${selected.map((concept) => {
  const pack = prompts[concept.id];
  return pack ? `### ${concept.name}
${pack.designPrompt}` : "";
}).join("\n\n") || "No design prompts generated yet."}`);
  }

  if (flags.mockupPrompts) {
    sections.push(`## Mockup Prompts

${selected.map((concept) => {
  const pack = prompts[concept.id];
  return pack ? `### ${concept.name}
${[
  pack.lifestyleMockupPrompt,
  pack.banner21x9Prompt,
  pack.showcase16x9Prompt,
  pack.product468x598Prompt,
  pack.square1x1Prompt,
  pack.reel9x16Prompt,
].join("\n\n")}` : "";
}).join("\n\n") || "No mockup prompts generated yet."}`);
  }

  if (flags.shopifyCopy) {
    sections.push(`## Shopify Copy

${selected.map((concept) => {
  const pack = copies[concept.id];
  return pack ? `### ${concept.name}
${pack.fullDescription}

${list(pack.bulletBenefits)}` : "";
}).join("\n\n") || "No Shopify copy generated yet."}`);
  }

  if (flags.metaAds) {
    sections.push(`## Meta Ads Copy

${selected.map((concept) => {
  const pack = copies[concept.id];
  return pack ? `### ${concept.name}
${list(pack.metaHooks)}

${list(pack.primaryTexts)}` : "";
}).join("\n\n") || "No Meta Ads copy generated yet."}`);
  }

  if (flags.seo) {
    sections.push(`## SEO Keywords / Tags

${selected.flatMap((concept) => copies[concept.id]?.tags || []).join(", ") || "No SEO tags generated yet."}`);
  }

  sections.push(`## Notes / Next Steps

- Review selected concepts for brand fit.
- Use prompt packs to create original design and mockup assets.
- Keep competitor research as strategy input only, not a design source.`);

  return `${sections.join("\n\n")}\n`;
}
