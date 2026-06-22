import { cleanGenericOtherLanguage } from "@/lib/normalizeProject";
import type { ArtworkAsset, ArtworkAssetGroup, ArtworkAssetType } from "@/types/artworkAsset";
import type { Concept } from "@/types/concept";
import type { Project } from "@/types/project";

type AssetTemplate = {
  assetGroup: ArtworkAssetGroup;
  assetType: ArtworkAssetType;
  title: string;
  purpose: string;
  recommendedTool: ArtworkAsset["recommendedTool"];
  recommendedRatio?: string;
  outputFormat?: ArtworkAsset["outputFormat"];
  priority: ArtworkAsset["priority"];
  prompt: (context: AssetContext) => string;
};

type AssetContext = {
  concept: Concept;
  productType: string;
  buyer: string;
  occasion: string;
  customFields: string;
  visualDirection: string;
  materialCue: string;
};

const safeRules = "original artwork only, no copied competitor artwork or layout, no brand logos, no protected characters, ecommerce-ready, clean production detail";

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "asset";
}

function materialCue(productType: string) {
  const product = productType.toLowerCase();
  if (product.includes("squishy") || product.includes("magnet")) return "clear acrylic edge, printed layer, raised soft silicone belly or tactile detail, fridge-safe magnet backing";
  if (product.includes("suncatcher") || product.includes("stained glass")) return "stained glass linework, translucent color panels, sunlight and rainbow reflections, hanging chain detail";
  if (product.includes("shirt") || product.includes("hoodie") || product.includes("sweatshirt")) return "soft cotton fabric, readable front print, clean DTG or screen-print texture, accurate shirt folds";
  if (product.includes("mug")) return "glossy ceramic surface, wraparound print area, left/right side preview, realistic handle and rim";
  if (product.includes("cap") || product.includes("hat")) return "embroidered or printed patch texture, curved cap front panel, stitching detail, fabric weave";
  if (product.includes("ornament")) return "glossy ornament surface, hanging ribbon, shaped edge, holiday tree lighting";
  if (product.includes("plaque")) return "clear acrylic thickness, polished edge, optional LED base, premium keepsake reflection";
  return "realistic product material, clean edge detail, accurate scale, premium POD finish";
}

function baseContext(concept: Concept, productType: string): AssetContext {
  return {
    concept,
    productType,
    buyer: concept.buyer,
    occasion: concept.occasion,
    customFields: concept.customFields.join(", ") || "photo, name, short message, style choice",
    visualDirection: concept.designDirection,
    materialCue: materialCue(productType),
  };
}

function assetPrompt(context: AssetContext, assetSubject: string, composition: string, background: string) {
  return cleanGenericOtherLanguage(
    `Create ${assetSubject} for "${context.concept.name}", a personalized ${context.productType} for ${context.buyer} / ${context.occasion}. Visual direction: ${context.visualDirection}. Customization cues: ${context.customFields}. Material cues: ${context.materialCue}. Composition: ${composition}. Background: ${background}. Quality constraints: crisp product detail, readable personalization, strong ecommerce clarity, no vague premium styling, ${safeRules}.`,
  );
}

const commonAdTemplates: AssetTemplate[] = [
  {
    assetGroup: "Ad Creative Assets",
    assetType: "meta_ad_scene",
    title: "Meta 1:1 Ad Scene",
    purpose: "Create a scroll-stopping product ad visual for Meta tests.",
    recommendedTool: "ChatGPT",
    recommendedRatio: "1:1",
    outputFormat: "JPG mockup",
    priority: "Must Have",
    prompt: (context) => assetPrompt(context, "a realistic 1:1 Meta ad creative scene", "product clearly visible in use, emotional gift context, natural phone-photo realism, no text overlay", "realistic US-market lifestyle setting with clean negative space"),
  },
  {
    assetGroup: "Ad Creative Assets",
    assetType: "ugc_reel_frame",
    title: "9:16 UGC / Reel Frame",
    purpose: "Create a vertical first frame for Reels, TikTok, or UGC briefs.",
    recommendedTool: "ChatGPT",
    recommendedRatio: "9:16",
    outputFormat: "JPG mockup",
    priority: "Must Have",
    prompt: (context) => assetPrompt(context, "a vertical UGC opening frame", "hand reveal or use-action close-up, clear personalization detail, scroll-stopping crop", "casual phone-camera lifestyle scene with natural light"),
  },
  {
    assetGroup: "Ad Creative Assets",
    assetType: "before_after",
    title: "Before / After Transformation",
    purpose: "Show how a raw personal input becomes a giftable product.",
    recommendedTool: "Figma",
    recommendedRatio: "4:5",
    outputFormat: "Prompt only",
    priority: "Good To Have",
    prompt: (context) => assetPrompt(context, "a before-and-after creative layout brief", "left side raw photo/name/custom input, right side finished product mockup, simple arrows or step markers", "plain ecommerce-friendly layout, no brand UI"),
  },
];

function fallbackTemplates(): AssetTemplate[] {
  return [
    {
      assetGroup: "Product Design Assets",
      assetType: "main_artwork",
      title: "Main Artwork",
      purpose: "Generate the primary reusable artwork for the product.",
      recommendedTool: "ChatGPT",
      recommendedRatio: "1:1",
      outputFormat: "PNG transparent",
      priority: "Must Have",
      prompt: (context) => assetPrompt(context, "the main product artwork", "centered reusable artwork, clear personalization area, production-ready edges", "transparent or plain light background"),
    },
    {
      assetGroup: "Product Design Assets",
      assetType: "typography",
      title: "Typography / Quote Layout",
      purpose: "Create readable original text treatment for the product.",
      recommendedTool: "Ideogram",
      recommendedRatio: "1:1",
      outputFormat: "PNG transparent",
      priority: "Must Have",
      prompt: (context) => assetPrompt(context, "original typography and quote layout options", "balanced type hierarchy, readable at small ecommerce thumbnail size, no copied slogans", "transparent background"),
    },
    {
      assetGroup: "Product Design Assets",
      assetType: "print_composition",
      title: "Final Print Composition",
      purpose: "Assemble artwork, personalization, material cues, and text into one design.",
      recommendedTool: "ChatGPT",
      recommendedRatio: "1:1",
      outputFormat: "PNG transparent",
      priority: "Must Have",
      prompt: (context) => assetPrompt(context, "the final production-ready print composition", "front-facing product design, balanced artwork plus text plus custom fields, no mockup scene", "transparent or plain light background"),
    },
    {
      assetGroup: "Material / Structure Assets",
      assetType: "material_detail",
      title: "Material Detail",
      purpose: "Clarify the physical cues that make the product believable.",
      recommendedTool: "Midjourney",
      recommendedRatio: "1:1",
      outputFormat: "JPG mockup",
      priority: "Good To Have",
      prompt: (context) => assetPrompt(context, "a close-up product material detail prompt", "macro detail crop showing edge, print surface, texture, thickness, and finish", "neutral ecommerce studio background"),
    },
    {
      assetGroup: "Mockup Assets",
      assetType: "product_mockup",
      title: "Product Close-Up Mockup",
      purpose: "Create a product-only ecommerce image.",
      recommendedTool: "ChatGPT",
      recommendedRatio: "4:5",
      outputFormat: "JPG mockup",
      priority: "Must Have",
      prompt: (context) => assetPrompt(context, "a product close-up ecommerce mockup", "product centered, accurate scale, clear material and personalization detail", "neutral bright studio or simple home setting"),
    },
    {
      assetGroup: "Mockup Assets",
      assetType: "lifestyle_scene",
      title: "Lifestyle Scene",
      purpose: "Show product in a believable gift/use context.",
      recommendedTool: "Midjourney",
      recommendedRatio: "4:5",
      outputFormat: "JPG mockup",
      priority: "Must Have",
      prompt: (context) => assetPrompt(context, "a realistic lifestyle mockup scene", "product in use, emotional gift moment, clear scale reference, no text overlay", context.concept.mockupDirection),
    },
    {
      assetGroup: "Mockup Assets",
      assetType: "shopify_hero",
      title: "Shopify Hero",
      purpose: "Create a wide hero image for product page testing.",
      recommendedTool: "ChatGPT",
      recommendedRatio: "21:9",
      outputFormat: "JPG mockup",
      priority: "Good To Have",
      prompt: (context) => assetPrompt(context, "a wide Shopify product hero image", "product on left third, lifestyle context, clean negative space for page header", "bright uncluttered ecommerce scene"),
    },
    ...commonAdTemplates,
  ];
}

function productTemplates(productType: string): AssetTemplate[] {
  const product = productType.toLowerCase();
  const templates = fallbackTemplates();

  if (product.includes("squishy") || product.includes("fridge magnet")) {
    return [
      { ...templates[0], assetType: "character_clipart", title: "Dad / Husband Body Clipart", prompt: (context) => assetPrompt(context, "a funny dad or husband body clipart base", "front-facing cartoon body, soft rounded belly area, blank face space for uploaded photo, friendly humor without body-shaming", "transparent background") },
      { ...templates[1], assetType: "face_integration", title: "Face Integration", recommendedTool: "ChatGPT", prompt: (context) => assetPrompt(context, "a face/photo integration direction", "uploaded face naturally placed on cartoon body, recognizable, clean cutout, matching light and proportions", "transparent background") },
      { ...templates[3], assetType: "material_detail", title: "Squishy Silicone Belly Material", prompt: (context) => assetPrompt(context, "raised soft silicone belly material detail", "glossy tactile belly, pokeable rounded edge, clearly distinct from flat acrylic layer", "macro ecommerce close-up") },
      { ...templates[3], assetType: "product_structure", title: "Acrylic Edge / Cutline", prompt: (context) => assetPrompt(context, "clear acrylic edge and laser cutline detail", "2-3mm transparent border, magnet backing cue, subtle thickness and reflection", "neutral close-up background") },
      { ...templates[1], assetType: "typography", title: "Funny Text Label", prompt: (context) => assetPrompt(context, "short original funny text label options", "bold readable phrase under character, snack/BBQ/dad humor, no copied competitor slogan", "transparent background") },
      { ...templates[2], title: "Final Magnet Assembly", prompt: (context) => assetPrompt(context, "the final squishy acrylic fridge magnet assembly", "uploaded face, cartoon body, silicone belly, acrylic edge, funny text, balanced centered product art", "transparent background") },
      { ...templates[4], title: "Fridge Close-Up", prompt: (context) => assetPrompt(context, "a fridge close-up product mockup", "magnet attached to bright kitchen fridge, hand near belly for tactile scale cue", "realistic American kitchen daylight") },
      { ...templates[5], title: "Hand Poking UGC Scene", prompt: (context) => assetPrompt(context, "a hand-poking belly UGC scene", "phone-camera close-up of finger about to poke soft belly, product crisp and playful", "bright kitchen fridge setting") },
      ...commonAdTemplates,
    ];
  }

  if (product.includes("shirt") || product.includes("hoodie") || product.includes("sweatshirt")) {
    return [
      { ...templates[0], assetType: "character_clipart", title: "Character / Clipart Base", prompt: (context) => assetPrompt(context, "a clean funny character or clipart base for apparel", "front-facing printable artwork, transparent background, bold silhouette readable on shirt", "transparent background") },
      { ...templates[1], assetType: "face_integration", title: "Face / Photo Integration", recommendedTool: "ChatGPT", prompt: (context) => assetPrompt(context, "photo face integration for apparel art", "face fits character style naturally, clean crop, no distortion, print-friendly contrast", "transparent background") },
      { ...templates[1], title: "Typography Headline", prompt: (context) => assetPrompt(context, "bold readable typography headline for a shirt", "large readable phrase, balanced around artwork, no copied slogan", "transparent background") },
      { ...templates[1], assetType: "name_layout", title: "Kids / Grandkids Names Layout", prompt: (context) => assetPrompt(context, "a family names layout for shirt personalization", "names arranged in clean badge/ribbon/list system, readable small print, balanced spacing", "transparent background") },
      { ...templates[2], title: "Final Front-Print Composition", prompt: (context) => assetPrompt(context, "the final front-print T-shirt composition", "character, nickname, quote, and kids names arranged for a centered shirt graphic", "transparent background") },
      { ...templates[4], title: "Flat Lay Shirt Mockup", prompt: (context) => assetPrompt(context, "a flat lay shirt mockup", "shirt centered, print clearly visible, fabric folds realistic, ecommerce crop", "neutral studio background") },
      { ...templates[5], title: "Model Wearing Shirt", prompt: (context) => assetPrompt(context, "a model wearing the personalized shirt", "natural pose, print readable, buyer/occasion context, realistic US-market photography", "family, BBQ, or gift moment lifestyle scene") },
      ...commonAdTemplates,
    ];
  }

  if (product.includes("suncatcher") || product.includes("stained glass")) {
    return [
      { ...templates[0], title: "Portrait Artwork", prompt: (context) => assetPrompt(context, "pet or person portrait artwork in stained glass style", "clear face shape, emotional likeness, simplified color panels, no copied style", "transparent background") },
      { ...templates[3], assetType: "product_structure", title: "Stained Glass Linework / Frame", prompt: (context) => assetPrompt(context, "stained glass linework and frame shape", "lead came outlines, arch/round/heart frame, hanging point, balanced custom text area", "transparent background") },
      { ...templates[3], title: "Sunlight / Rainbow Material", prompt: (context) => assetPrompt(context, "sunlight and rainbow reflection material cue", "translucent colored panels, window light glow, premium handmade suncatcher detail", "window close-up background") },
      { ...templates[1], title: "Name / Date / Quote Typography", prompt: (context) => assetPrompt(context, "memorial or gift typography layout", "name, date, and short quote readable within frame, respectful and not cheesy", "transparent background") },
      { ...templates[2], title: "Transparent Product Render", prompt: (context) => assetPrompt(context, "final transparent suncatcher product render", "portrait, stained glass frame, name/date/quote, hanging chain, centered product art", "transparent background") },
      { ...templates[5], title: "Window Hanging Mockup", prompt: (context) => assetPrompt(context, "a window hanging suncatcher mockup", "product hanging in sunlit window, rainbow reflection on wall, clear scale", "warm home window scene") },
      { ...templates[6], title: "Shopify Hero", prompt: (context) => assetPrompt(context, "a wide Shopify hero for stained glass suncatcher", "product by bright window, rainbow light, negative space for page crop", "warm memorial or gift home setting") },
      ...commonAdTemplates.slice(0, 2),
    ];
  }

  if (product.includes("mug")) {
    return [
      { ...templates[0], title: "Portrait / Artwork", prompt: (context) => assetPrompt(context, "portrait or artwork for mug wrap", "subject centered, print-safe colors, clean edges, works on curved surface", "transparent background") },
      { ...templates[2], assetType: "print_composition", title: "Mug Wrap Layout", prompt: (context) => assetPrompt(context, "a mug wrap print layout", "left/right side preview, quote and photo balanced across wrap area, handle-safe spacing", "plain light background") },
      { ...templates[1], title: "Quote / Typography", prompt: (context) => assetPrompt(context, "readable mug quote typography", "short phrase, bold readable lettering, warm gift tone, no copied phrase", "transparent background") },
      { ...templates[4], title: "Clean Product Mockup", prompt: (context) => assetPrompt(context, "clean ceramic mug mockup", "mug angled with handle visible, glossy ceramic, design readable", "neutral kitchen counter") },
      { ...templates[5], title: "Kitchen / Coffee Lifestyle Scene", prompt: (context) => assetPrompt(context, "coffee lifestyle mug scene", "hand holding mug, warm morning light, personalization visible", "bright kitchen or desk scene") },
      ...commonAdTemplates,
    ];
  }

  if (product.includes("cap") || product.includes("hat")) {
    return [
      { ...templates[0], title: "Photo / Portrait Patch Artwork", prompt: (context) => assetPrompt(context, "patch artwork for custom cap", "portrait or icon simplified for embroidery/patch, strong silhouette, readable small size", "transparent background") },
      { ...templates[3], title: "Embroidery / Patch Texture", prompt: (context) => assetPrompt(context, "embroidery or printed patch material detail", "thread texture, leather or woven patch edge, curved cap placement", "macro close-up") },
      { ...templates[2], title: "Cap Front Layout", prompt: (context) => assetPrompt(context, "final cap front layout", "patch centered on front panel, role/name badge, clean spacing, curved cap-aware composition", "plain light background") },
      { ...templates[4], title: "Close-Up Cap Texture", prompt: (context) => assetPrompt(context, "cap texture close-up", "fabric weave, stitching, patch edge, premium ecommerce detail", "neutral studio background") },
      { ...templates[5], title: "Outdoor Wearing Mockup", prompt: (context) => assetPrompt(context, "dad/outdoor wearing cap mockup", "natural outdoor pose, cap front visible, lifestyle gift context", "backyard, golf, BBQ, or fishing scene") },
      ...commonAdTemplates,
    ];
  }

  if (product.includes("ornament")) {
    return [
      { ...templates[0], title: "Portrait / Artwork", prompt: (context) => assetPrompt(context, "ornament portrait or artwork", "photo or illustration in holiday frame, clear focal subject, warm gift tone", "transparent background") },
      { ...templates[3], assetType: "product_structure", title: "Ornament Shape / Frame", prompt: (context) => assetPrompt(context, "ornament frame and shape detail", "round/heart/star shape, hanging hole, glossy edge, ribbon cue", "transparent background") },
      { ...templates[1], title: "Name / Year Typography", prompt: (context) => assetPrompt(context, "name and year typography for ornament", "readable holiday text, balanced below portrait, no copied phrase", "transparent background") },
      { ...templates[4], title: "Christmas Tree Mockup", prompt: (context) => assetPrompt(context, "ornament hanging on Christmas tree mockup", "warm lights, product in focus, readable personalization, scale reference", "cozy holiday home background") },
      { ...templates[5], title: "Gift Box Scene", prompt: (context) => assetPrompt(context, "ornament gift box lifestyle scene", "product near open gift box, ribbon, warm holiday light, no text overlay", "holiday tabletop") },
      ...commonAdTemplates,
    ];
  }

  return templates;
}

export function buildArtworkAssets(concepts: Concept[], productType: string, projectId?: string, generationId?: string): ArtworkAsset[] {
  const now = new Date().toISOString();
  return concepts.flatMap((concept) => {
    const context = baseContext(concept, productType);
    return productTemplates(productType).map((template, index) => ({
      id: `asset-${slug(concept.id)}-${slug(template.assetType)}-${index}`,
      projectId,
      generationId,
      conceptId: concept.id,
      conceptName: concept.name,
      assetGroup: template.assetGroup,
      assetType: template.assetType,
      title: template.title,
      purpose: template.purpose,
      prompt: template.prompt(context),
      recommendedTool: template.recommendedTool,
      recommendedRatio: template.recommendedRatio,
      outputFormat: template.outputFormat,
      priority: template.priority,
      status: "Not Started",
      createdAt: now,
      updatedAt: now,
    }));
  });
}

export function formatArtworkToolBrief(project: Project, asset: ArtworkAsset) {
  return `I'm building a POD product concept: ${asset.conceptName}.
Product type: ${project.productType || "Custom POD Product"}.
Asset needed: ${asset.title}.
Asset group: ${asset.assetGroup}.
Purpose: ${asset.purpose}.
Recommended ratio/output: ${asset.recommendedRatio || "Flexible"} / ${asset.outputFormat || "Prompt only"}.

Prompt:
${asset.prompt}

Constraints:
- no copied competitor artwork
- no copied slogan or layout
- no brand logos
- clean ecommerce-ready composition
- follow the product material details
- keep personalization readable and production-friendly`;
}

export function formatArtworkAssetsMarkdown(assets: ArtworkAsset[]) {
  if (!assets.length) return "No artwork assets generated yet.";
  const conceptNames = Array.from(new Set(assets.map((asset) => asset.conceptName)));
  return conceptNames
    .map((conceptName) => {
      const conceptAssets = assets.filter((asset) => asset.conceptName === conceptName);
      const groups = Array.from(new Set(conceptAssets.map((asset) => asset.assetGroup)));
      return `# ${conceptName}

${groups
  .map((group) => `## ${group}

${conceptAssets
  .filter((asset) => asset.assetGroup === group)
  .map((asset) => `### ${asset.title}
- Type: ${asset.assetType}
- Purpose: ${asset.purpose}
- Tool: ${asset.recommendedTool}
- Ratio: ${asset.recommendedRatio || "Flexible"}
- Output: ${asset.outputFormat || "Prompt only"}
- Priority: ${asset.priority}
- Status: ${asset.status}

${asset.prompt}`)
  .join("\n\n")}`)
  .join("\n\n")}`;
    })
    .join("\n\n---\n\n");
}

export function formatArtworkAssetsJson(assets: ArtworkAsset[]) {
  return JSON.stringify(assets, null, 2);
}
