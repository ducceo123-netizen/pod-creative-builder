import { getCustomFields, normalizeProject } from "@/lib/normalizeProject";
import type { Analysis } from "@/types/analysis";
import type { ArtworkAsset } from "@/types/artworkAsset";
import type { ComponentAssetPlan, DesignComponent, PersonalizationItem, ProductDecomposition } from "@/types/productDecomposition";
import type { Project } from "@/types/project";

function component(
  id: string,
  name: string,
  componentType: DesignComponent["componentType"],
  role: DesignComponent["role"],
  description: string,
  sourceFromCompetitor: string,
  options: Partial<DesignComponent> = {},
): DesignComponent {
  return {
    id,
    name,
    componentType,
    role,
    description,
    sourceFromCompetitor,
    shouldKeepAsMechanism: options.shouldKeepAsMechanism ?? true,
    shouldChangeForOriginality: options.shouldChangeForOriginality ?? true,
    copyRisk: options.copyRisk || "Medium",
    suggestedReplacement: options.suggestedReplacement,
    generationPrompt: options.generationPrompt,
    materialNotes: options.materialNotes,
    teeinblueLayerSuggestion: options.teeinblueLayerSuggestion,
  };
}

function plan(
  id: string,
  componentId: string,
  assetName: string,
  assetPurpose: string,
  assetSource: ComponentAssetPlan["assetSource"],
  prompt: string,
  options: Partial<ComponentAssetPlan> = {},
): ComponentAssetPlan {
  return {
    id,
    componentId,
    assetName,
    assetPurpose,
    assetSource,
    required: options.required ?? true,
    priority: options.priority || "Must Have",
    recommendedFormat: options.recommendedFormat || "PNG transparent",
    recommendedTool: options.recommendedTool || "ChatGPT",
    suggestedSize: options.suggestedSize,
    prompt,
    status: options.status || "Not Started",
  };
}

function statusFromAssets(componentId: string, assets: ArtworkAsset[]): ComponentAssetPlan["status"] {
  const text = componentId.toLowerCase();
  const match = assets.find((asset) => {
    const haystack = `${asset.assetType} ${asset.title} ${asset.purpose}`.toLowerCase();
    return (
      haystack.includes(text.replace(/-/g, " ")) ||
      (text.includes("photo") && haystack.includes("face")) ||
      (text.includes("typography") && haystack.includes("typography")) ||
      (text.includes("mockup") && haystack.includes("mockup")) ||
      (text.includes("material") && haystack.includes("material"))
    );
  });
  if (!match) return "Not Started";
  if (match.status === "Copied" || match.status === "Generated Externally") return "Prompt Copied";
  if (match.status === "Uploaded") return "Uploaded";
  if (match.status === "Approved") return "Approved";
  if (match.status === "Needs Revision") return "Needs Revision";
  return "Not Started";
}

function withStatuses(plans: ComponentAssetPlan[], assets: ArtworkAsset[]) {
  return plans.map((item) => ({ ...item, status: statusFromAssets(item.componentId, assets) }));
}

function buildSquishyMagnet(project: Project, analysis: Analysis | null, assets: ArtworkAsset[]): ProductDecomposition {
  const buyer = project.buyerPersona || analysis?.productBreakdown.coreBuyer || "Dad";
  const occasion = project.occasion || analysis?.productBreakdown.coreOccasion || "Father's Day";
  const designComponents = [
    component("uploaded-photo", "Uploaded face/photo", "uploaded_photo", "customer_input", "Customer photo cropped into a face cutout for the character.", "Competitor uses a personalized photo-to-character mechanism.", {
      copyRisk: "Low",
      suggestedReplacement: "Keep the photo upload mechanism but use a different crop shape, face frame, and expression matching rules.",
      teeinblueLayerSuggestion: "CUSTOM_PHOTO",
    }),
    component("character-body", "Dad body clipart", "character_body", "ai_generated_asset", "Original cartoon body that carries the funny dad-bod idea.", "Competitor uses a humorous body illustration.", {
      copyRisk: "High",
      suggestedReplacement: "Change body proportions, pose, outfit, line style, and prop system.",
      generationPrompt: `Create an original funny ${buyer} character body for a squishy acrylic fridge magnet, blank face area, playful stance, transparent background, no copied competitor pose or outfit.`,
      teeinblueLayerSuggestion: "ARTWORK_BASE",
    }),
    component("belly-material", "Raised squishy belly", "material_effect", "product_material", "Soft tactile belly surface that explains why the product is pokeable.", "Competitor shows a raised belly interaction.", {
      copyRisk: "Medium",
      materialNotes: "Use glossy silicone highlight, soft rounded edge, and tactile bulge cues.",
      teeinblueLayerSuggestion: "MATERIAL_BELLY",
    }),
    component("acrylic-base", "Clear acrylic cutline", "product_base", "product_material", "Transparent acrylic edge and magnet product structure.", "Competitor product is an acrylic fridge magnet.", {
      copyRisk: "Low",
      materialNotes: "Show clear edge, rounded cutline, and fridge-scale thickness.",
      teeinblueLayerSuggestion: "PRODUCT_CUTLINE",
    }),
    component("funny-text", "Funny text label", "quote_text", "manual_design_layer", "Short phrase or relationship label that makes the gift specific.", "Competitor relies on dad/family humor text.", {
      copyRisk: "High",
      suggestedReplacement: "Use new short phrases, different hierarchy, and different badge placement.",
      teeinblueLayerSuggestion: "CUSTOM_QUOTE",
    }),
    component("mockup-context", "Fridge / hand-poke mockup", "mockup_context", "mockup_scene", "Scene showing product scale and tactile interaction.", "Competitor likely uses fridge or hand interaction visuals.", {
      copyRisk: "Medium",
      suggestedReplacement: `Change scene to kitchen family moment, office cabinet gag, or ${occasion} gift reaction.`,
    }),
  ];

  const personalizationMap: PersonalizationItem[] = [
    { id: "p-photo", label: "Upload Photo", inputType: "photo_upload", examples: ["Front-facing dad photo", "Grandpa selfie"], required: true, mapsToComponentId: "uploaded-photo", teeinblueFieldType: "photo", customerFacingLabel: "Upload recipient photo", productionNote: "Crop to face only and preserve identity without stretching." },
    { id: "p-relationship", label: "Relationship Label", inputType: "dropdown", examples: ["Dad", "Grandpa", "Husband", "Papa"], required: true, mapsToComponentId: "funny-text", teeinblueFieldType: "dropdown", customerFacingLabel: "Choose relationship", productionNote: "Map to a text layer or badge option." },
    { id: "p-funny-text", label: "Short Funny Text", inputType: "text", examples: ["Snack Inspector", "Poke Me", "Dad Mode"], required: false, mapsToComponentId: "funny-text", teeinblueFieldType: "text", customerFacingLabel: "Add short text", productionNote: "Keep under 18 characters for thumbnail readability." },
    { id: "p-outfit", label: "Outfit Theme", inputType: "dropdown", examples: ["BBQ", "Fishing", "Golf", "Vacation"], required: false, mapsToComponentId: "character-body", teeinblueFieldType: "dropdown", customerFacingLabel: "Choose outfit theme", productionNote: "Use as seller-generated variation or Teeinblue option layer later." },
  ];

  const componentAssetPlan = withStatuses(
    [
      plan("a-photo", "uploaded-photo", "Photo crop guide", "Prepare customer photo crop and face integration rules.", "customer_upload", "Crop the uploaded photo to face only, preserve identity, match the cartoon body angle, avoid warping facial features.", { recommendedFormat: "PNG", recommendedTool: "Photoshop", suggestedSize: "800 x 800 px" }),
      plan("a-character", "character-body", "Original dad body clipart", "Generate the core character body with blank face area.", "ai_generated", designComponents[1].generationPrompt || "", { suggestedSize: "3000 x 3000 px" }),
      plan("a-belly", "belly-material", "Squishy belly material detail", "Represent raised glossy tactile silicone belly.", "ai_generated", "Create a transparent PNG belly material detail: raised soft glossy silicone, rounded highlight, tactile pokeable feel, small fridge magnet scale, no copied product shape.", { recommendedTool: "Ideogram", suggestedSize: "2000 x 2000 px" }),
      plan("a-acrylic", "acrylic-base", "Acrylic edge and cutline", "Build clear acrylic product structure.", "manual_design", "Create a clean acrylic cutline layer with rounded clear edge, subtle thickness, magnet product scale, transparent background.", { recommendedTool: "Figma", recommendedFormat: "SVG", suggestedSize: "3000 x 3000 px" }),
      plan("a-text", "funny-text", "Funny label typography", "Create readable short text/badge system.", "manual_design", "Design original funny dad gift typography with short phrase, bold readable hierarchy, not copied from competitor, transparent background.", { recommendedTool: "Figma", recommendedFormat: "Text layer", suggestedSize: "Flexible" }),
      plan("a-mockup", "mockup-context", "Fridge hand-poke mockup", "Show scale and interaction in a fresh context.", "mockup_context", `Photorealistic product mockup: original squishy acrylic fridge magnet on a kitchen fridge, hand poking belly, ${occasion} gift humor, bright natural light, no copied competitor composition.`, { recommendedFormat: "JPG", priority: "Should Have", suggestedSize: "1600 x 1200 px" }),
    ],
    assets,
  );

  return {
    designComponents,
    personalizationMap,
    componentAssetPlan,
    materialNotes: [
      "Show clear acrylic edge and rounded cutline.",
      "Represent magnetic backing by fridge placement or subtle back-view note.",
      "Raised silicone belly should look soft, glossy, and tactile.",
      "Keep product small and handheld/fridge-scale.",
      "Final print artwork should avoid tiny text and overly thin cutlines.",
    ],
    safeTransformationPlan: {
      keep: ["Photo-to-character personalization", "Squishy belly interaction", `${buyer} gift intent`, occasion],
      change: ["Product name", "Body pose", "Typography system", "Outfit theme", "Mockup scene", "Character proportions", "Color palette"],
      avoid: ["Same belly shape", "Same character stance", "Same headline phrase", "Same fridge photo composition", "Competitor brand styling"],
      originalityMoves: ["Shift to a fresh outfit theme such as BBQ inspector or vacation dad", "Use a new badge/text placement", "Create a different hand-poke or family reaction scene", "Use original phrases instead of competitor slogan logic"],
      copyRisk: "Medium",
    },
  };
}

function buildTShirt(project: Project, analysis: Analysis | null, assets: ArtworkAsset[]): ProductDecomposition {
  const buyer = project.buyerPersona || analysis?.productBreakdown.coreBuyer || "Dad";
  const occasion = project.occasion || analysis?.productBreakdown.coreOccasion || "Father's Day";
  const designComponents = [
    component("nickname-text", "Recipient nickname", "name_text", "customer_input", "Customer-selected role such as Dad, Pop, Papa, or Grandpa.", "Competitor uses nickname personalization.", { copyRisk: "Low", teeinblueLayerSuggestion: "CUSTOM_NAME" }),
    component("kids-names", "Kids / grandkids names", "typography", "customer_input", "Names list that creates family-pride personalization.", "Competitor uses family names as emotional proof.", { copyRisk: "Low", teeinblueLayerSuggestion: "CUSTOM_KIDS_NAMES" }),
    component("dad-character", `${buyer} character clipart`, "character_body", "ai_generated_asset", "Original illustrated character with optional props.", "Competitor uses dad/grandpa figure or role iconography.", { copyRisk: "High", suggestedReplacement: "Change character style, pose, props, body proportions, and expression.", generationPrompt: `Original ${buyer} character clipart for a personalized shirt, family-pride gift, optional BBQ/golf/fishing props, clean print-ready linework, transparent background, no copied competitor pose.`, teeinblueLayerSuggestion: "ARTWORK_BASE" }),
    component("headline", "Main headline typography", "quote_text", "manual_design_layer", "Top or arched headline that anchors the shirt composition.", "Competitor relies on a strong family-role headline.", { copyRisk: "High", suggestedReplacement: "Use new wording, hierarchy, and type style.", teeinblueLayerSuggestion: "CUSTOM_QUOTE" }),
    component("front-print", "Front print composition", "print_area", "production_layer", "Final shirt front layout with safe area and layer order.", "Competitor uses front print composition.", { copyRisk: "Medium", materialNotes: "Keep DTG/screen-print friendly contrast and spacing.", teeinblueLayerSuggestion: "PRINTAREA_FRONT" }),
    component("shirt-mockup", "Lifestyle shirt mockup", "mockup_context", "mockup_scene", "Dad wearing shirt in a fresh gift scene.", "Competitor uses lifestyle or product mockup.", { copyRisk: "Medium", suggestedReplacement: `Use BBQ, reunion, vacation, or ${occasion} gift reaction instead of matching competitor scene.` }),
  ];

  const personalizationMap: PersonalizationItem[] = [
    { id: "p-nickname", label: "Recipient Nickname", inputType: "dropdown", examples: ["Dad", "Pop", "Papa", "Grandpa"], required: true, mapsToComponentId: "nickname-text", teeinblueFieldType: "dropdown", customerFacingLabel: "Choose recipient nickname", productionNote: "Maps to main headline or badge text." },
    { id: "p-names", label: "Kids / Grandkids Names", inputType: "text", examples: ["Ava, Liam, Noah", "The Johnson Crew"], required: true, mapsToComponentId: "kids-names", teeinblueFieldType: "text", customerFacingLabel: "Add kids or grandkids names", productionNote: "Keep line breaks controlled and readable." },
    { id: "p-theme", label: "Outfit / Prop Theme", inputType: "dropdown", examples: ["BBQ", "Golf", "Fishing", "Beach"], required: false, mapsToComponentId: "dad-character", teeinblueFieldType: "dropdown", customerFacingLabel: "Choose theme", productionNote: "Seller-generated option layer later." },
    { id: "p-shirt-color", label: "Shirt Color", inputType: "color", examples: ["Black", "Sport Grey", "Navy"], required: true, mapsToComponentId: "front-print", teeinblueFieldType: "color", customerFacingLabel: "Choose shirt color", productionNote: "Check contrast for all text layers." },
  ];

  const componentAssetPlan = withStatuses(
    [
      plan("a-character", "dad-character", `${buyer} character clipart`, "Generate original character art.", "ai_generated", designComponents[2].generationPrompt || "", { suggestedSize: "4500 x 5400 px" }),
      plan("a-headline", "headline", "Headline typography", "Build original type hierarchy.", "manual_design", "Create a bold personalized shirt headline with original wording, readable at thumbnail size, strong hierarchy, transparent background, no copied slogan.", { recommendedTool: "Figma", recommendedFormat: "Text layer" }),
      plan("a-names", "kids-names", "Names layout", "Prepare controlled text layer for names.", "manual_design", "Create a flexible kids/grandkids names layout with clean spacing, readable small print, Teeinblue text-friendly structure.", { recommendedTool: "Teeinblue", recommendedFormat: "Text layer" }),
      plan("a-final", "front-print", "Final front-print composition", "Assemble print-ready shirt design.", "manual_design", "Assemble front shirt design: headline top, original character center, names bottom, safe print margins, high contrast, transparent PNG.", { recommendedTool: "Figma", suggestedSize: "4500 x 5400 px" }),
      plan("a-mockup", "shirt-mockup", "Lifestyle shirt mockup", "Show the finished shirt in a fresh use case.", "mockup_context", `Photorealistic ${buyer} wearing a personalized shirt at BBQ or family reunion, ${occasion} gift moment, natural light, no copied competitor mockup.`, { recommendedFormat: "JPG", priority: "Should Have", suggestedSize: "1600 x 1200 px" }),
    ],
    assets,
  );

  return {
    designComponents,
    personalizationMap,
    componentAssetPlan,
    materialNotes: [
      "Use cotton fabric and DTG/screen-print friendly flat artwork.",
      "Avoid tiny unreadable text in names list.",
      "Keep strong contrast for black, navy, grey, and white shirt variants.",
      "Use front print safe area and avoid edge crowding.",
      "Mockups should show real shirt scale and natural fabric folds.",
    ],
    safeTransformationPlan: {
      keep: ["Family pride mechanism", "Nickname personalization", `${buyer} gift angle`, occasion],
      change: ["Exact slogan", "Layout", "Character style", "Typography", "Props", "Mockup background"],
      avoid: ["Same arched headline", "Same character pose", "Same name-stack layout", "Competitor phrase structure", "Distinctive color palette"],
      originalityMoves: ["Shift to family legend/team/crew framing", "Change props to BBQ, vacation, or reunion", "Use different typography hierarchy", "Build names as a clean team roster or badge system"],
      copyRisk: "Medium",
    },
  };
}

function buildFallback(project: Project, analysis: Analysis | null, assets: ArtworkAsset[]): ProductDecomposition {
  const normalized = normalizeProject(project);
  const productType = normalized.normalizedProductType;
  const customFields = getCustomFields(productType);
  const designComponents = [
    component("customer-input", "Customer personalization inputs", "personalization_option", "customer_input", "Fields the customer uploads, types, or chooses.", "Inferred from product customization options.", { copyRisk: "Low", teeinblueLayerSuggestion: "CUSTOM_OPTIONS" }),
    component("main-artwork", "Main artwork / illustration", "clipart", "ai_generated_asset", "Original visual asset that carries the product idea.", "Competitor likely uses a central visual mechanism.", { copyRisk: "High", generationPrompt: `Create original ${productType} artwork with ${normalized.normalizedVisualDirection}, production-ready, no copied competitor layout or slogan.`, teeinblueLayerSuggestion: "ARTWORK_BASE" }),
    component("typography", "Typography system", "typography", "manual_design_layer", "Text hierarchy, names, quote, or date layers.", "Inferred from personalized POD product structure.", { copyRisk: "Medium", teeinblueLayerSuggestion: "CUSTOM_TEXT" }),
    component("product-base", "Product base / material", "product_base", "product_material", "Physical product surface, material, or print area.", "Inferred from product type.", { copyRisk: "Low", materialNotes: `Represent ${productType} material cues accurately.` }),
    component("mockup", "Mockup / lifestyle context", "mockup_context", "mockup_scene", "Scene that shows use case, scale, and gift moment.", "Inferred from ecommerce listing needs.", { copyRisk: "Medium" }),
  ];

  const personalizationMap = customFields.slice(0, 5).map((field, index) => ({
    id: `p-${index + 1}`,
    label: field.name,
    inputType: field.name.toLowerCase().includes("photo") ? ("photo_upload" as const) : field.name.toLowerCase().includes("color") ? ("color" as const) : ("text" as const),
    examples: [field.example],
    required: field.recommended,
    mapsToComponentId: field.name.toLowerCase().includes("photo") ? "customer-input" : "typography",
    teeinblueFieldType: field.name.toLowerCase().includes("photo") ? ("photo" as const) : field.name.toLowerCase().includes("color") ? ("color" as const) : ("text" as const),
    customerFacingLabel: field.shopifyOptionLabel || field.name,
    productionNote: "Keep this field short, clear, and mapped to the matching design layer.",
  }));

  const componentAssetPlan = withStatuses(
    [
      plan("a-main", "main-artwork", "Main artwork asset", "Generate original central product artwork.", "ai_generated", designComponents[1].generationPrompt || "", { suggestedSize: "3000 x 3000 px" }),
      plan("a-type", "typography", "Typography/text layers", "Prepare editable text hierarchy.", "manual_design", "Build original typography hierarchy with readable personalization zones and no copied slogan.", { recommendedTool: "Figma", recommendedFormat: "Text layer" }),
      plan("a-base", "product-base", "Product material/base", "Represent the physical product accurately.", "fixed_template", `Create or use a clean ${productType} base/template with correct material cues and print area.`, { recommendedTool: "Figma", priority: "Should Have" }),
      plan("a-mockup", "mockup", "Lifestyle mockup", "Show scale and use case.", "mockup_context", `Create a fresh ecommerce mockup scene for ${productType}, gift-ready, realistic scale, no copied competitor composition.`, { recommendedFormat: "JPG", priority: "Should Have" }),
    ],
    assets,
  );

  return {
    designComponents,
    personalizationMap,
    componentAssetPlan,
    materialNotes: [
      analysis?.productBreakdown.visualMechanism || normalized.normalizedVisualDirection,
      `Represent ${productType} material and scale clearly.`,
      "Keep personalization fields readable at mobile thumbnail size.",
      "Separate customer-editable text/photo layers from fixed base artwork.",
    ],
    safeTransformationPlan: {
      keep: analysis?.inspirationRules.keepAsInspiration || ["Underlying personalization mechanism", "Buyer intent", "Gift occasion"],
      change: analysis?.inspirationRules.safeTransformationDirections || ["Layout", "Typography", "Artwork style", "Mockup context", "Copy"],
      avoid: analysis?.inspirationRules.doNotCopy || ["Exact slogans", "Exact layout", "Competitor artwork", "Brand styling"],
      originalityMoves: ["Change visual hierarchy", "Use different props/context", "Create fresh component prompts", "Separate manual text layers from generated artwork"],
      copyRisk: analysis?.scores.copyRisk === "high" ? "High" : analysis?.scores.copyRisk === "low" ? "Low" : "Medium",
    },
  };
}

export function buildProductDecomposition(project: Project, analysis: Analysis | null, assets: ArtworkAsset[] = []): ProductDecomposition {
  const product = normalizeProject(project).normalizedProductType.toLowerCase();
  if (product.includes("squishy") || product.includes("magnet")) return buildSquishyMagnet(project, analysis, assets);
  if (product.includes("shirt") || product.includes("hoodie") || product.includes("sweatshirt")) return buildTShirt(project, analysis, assets);
  return buildFallback(project, analysis, assets);
}

export function formatProductDecompositionMarkdown(decomposition: ProductDecomposition) {
  const componentRows = decomposition.designComponents
    .map((item) => `| ${item.name} | ${item.componentType} | ${item.role} | ${item.copyRisk} | ${item.teeinblueLayerSuggestion || "N/A"} |`)
    .join("\n");
  const personalizationRows = decomposition.personalizationMap
    .map((item) => `| ${item.customerFacingLabel} | ${item.inputType} | ${item.required ? "Yes" : "No"} | ${item.mapsToComponentId} | ${item.productionNote} |`)
    .join("\n");
  const assetRows = decomposition.componentAssetPlan
    .map((item) => `| ${item.assetName} | ${item.assetSource} | ${item.priority} | ${item.recommendedFormat} | ${item.recommendedTool} | ${item.status} |`)
    .join("\n");

  return `## Product Snapshot

This pack is organized for build-ready design generation: decompose the competitor mechanism, generate assets one component at a time, and transform risky elements before production.

## Competitor Design Decomposition

| Component | Type | Role | Copy Risk | Teeinblue Layer |
|---|---|---|---|---|
${componentRows}

## Personalization Map

| Field | Input Type | Required | Maps To | Production Note |
|---|---|---|---|---|
${personalizationRows || "| No personalization fields generated. |  |  |  |  |"}

## Component Asset Plan

| Asset | Source | Priority | Format | Tool | Status |
|---|---|---|---|---|---|
${assetRows}

## Material & Production Notes

${decomposition.materialNotes.map((item) => `- ${item}`).join("\n")}

## Safe Transformation Plan

### Keep
${decomposition.safeTransformationPlan.keep.map((item) => `- ${item}`).join("\n")}

### Change
${decomposition.safeTransformationPlan.change.map((item) => `- ${item}`).join("\n")}

### Avoid
${decomposition.safeTransformationPlan.avoid.map((item) => `- ${item}`).join("\n")}

### Originality Moves
${decomposition.safeTransformationPlan.originalityMoves.map((item) => `- ${item}`).join("\n")}
`;
}
