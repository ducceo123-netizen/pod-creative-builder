import type { CustomField } from "@/types/analysis";
import type { Project } from "@/types/project";

export type NormalizedProject = Project & {
  normalizedProductType: string;
  normalizedVisualDirection: string;
};

export function buildSearchText(project: Project): string {
  return [
    project.productTitle,
    project.productDescription,
    project.userNotes,
    project.niche,
    project.buyerPersona,
    project.occasion,
    project.competitorUrl,
    project.customProductType,
    project.customVisualStyle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function inferProductType(project: Project): string {
  if (project.productType && project.productType !== "Other") return project.productType;
  if (project.customProductType?.trim()) return project.customProductType.trim();

  const text = buildSearchText(project);

  if (text.includes("squishy") && text.includes("fridge magnet")) return "Squishy Acrylic Fridge Magnet";
  if (text.includes("fridge magnet") || text.includes("magnet")) return "Acrylic Fridge Magnet";
  if (text.includes("suncatcher") || text.includes("stained glass")) return "Stained Glass Suncatcher";
  if (text.includes("cap") || text.includes("hat")) return "Custom Photo Cap";
  if (text.includes("mug")) return "Personalized Mug";
  if (text.includes("t-shirt") || text.includes("shirt")) return "Custom T-Shirt";
  if (text.includes("ornament")) return "Personalized Ornament";
  if (text.includes("blanket")) return "Personalized Blanket";
  if (text.includes("canvas")) return "Custom Canvas Print";
  if (text.includes("acrylic plaque")) return "Personalized Acrylic Plaque";
  if (text.includes("doormat")) return "Personalized Doormat";
  if (text.includes("garden flag")) return "Garden Flag";
  if (text.includes("phone case")) return "Phone Case";
  if (text.includes("keychain")) return "Acrylic Keychain";
  if (text.includes("poster")) return "Photo Upload Poster";
  if (text.includes("pillow")) return "Personalized Pillow";

  return "Custom POD Product";
}

export function inferVisualDirection(project: Project, normalizedProductType: string): string {
  const selectedStyle = project.visualStyle?.find((style) => style && style !== "Other");
  if (selectedStyle) return selectedStyle;
  if (project.customVisualStyle?.trim()) return project.customVisualStyle.trim();

  const text = buildSearchText(project);

  if (
    text.includes("funny") ||
    text.includes("dad bod") ||
    text.includes("belly") ||
    text.includes("poke") ||
    text.includes("squishy")
  ) {
    return "Funny custom character with realistic photo face, clean cartoon body, playful squishy belly, family-friendly humor, bright kitchen/fridge lifestyle";
  }

  if (text.includes("memorial") || text.includes("remembrance") || text.includes("tribute")) {
    return "Warm sentimental keepsake style, soft lighting, personal tribute, premium gift presentation";
  }

  if (text.includes("stained glass") || text.includes("suncatcher")) {
    return "Stained glass inspired portrait style, sunlight reflections, warm window decor, premium handmade look";
  }

  if (text.includes("watercolor")) {
    return "Soft watercolor portrait style, warm giftable composition, clean personalized details";
  }

  if (text.includes("christmas")) {
    return "Warm holiday illustration style, festive home setting, gift-ready personalized design";
  }

  return `${normalizedProductType} design direction with original layout, clean personalization areas, gift-ready composition, and no copied competitor elements`;
}

export function normalizeProject(project: Project): NormalizedProject {
  const normalizedProductType = inferProductType(project);
  const normalizedVisualDirection = inferVisualDirection(project, normalizedProductType);
  return { ...project, normalizedProductType, normalizedVisualDirection };
}

export function cleanGenericOtherLanguage(text: string): string {
  return text
    .replaceAll("custom other", "custom POD product")
    .replaceAll("personalized other", "personalized POD product")
    .replaceAll("Custom other", "Custom POD product")
    .replaceAll("Personalized other", "Personalized POD product")
    .replaceAll("Other artwork", "Original artwork")
    .replaceAll("Other direction", "Original design direction")
    .replaceAll("custom Other", "custom POD product")
    .replaceAll("Other,", "Custom POD Product,");
}

export function hasGenericOutputWarning(value: string): boolean {
  const text = value.toLowerCase();
  return ["custom other", "personalized other", "other direction", "other artwork", "custom pod product"].some((phrase) =>
    text.includes(phrase),
  );
}

export function cleanStringArray(items: string[]): string[] {
  return items.map(cleanGenericOtherLanguage);
}

const field = (
  name: string,
  example: string,
  emotionalValue: CustomField["emotionalValue"],
  difficulty: CustomField["difficulty"],
  shopifyOptionLabel?: string,
): CustomField => ({
  name,
  example,
  emotionalValue,
  difficulty,
  recommended: true,
  shopifyOptionLabel: shopifyOptionLabel || name,
});

export function getCustomFields(productType: string): CustomField[] {
  if (productType === "Squishy Acrylic Fridge Magnet") {
    return [
      field("Upload Photo", "Clear front-facing photo of Dad, husband, boyfriend, or Grandpa", "high", "medium", "Upload his photo"),
      field("Recipient Name", "Dad, Mike, Grandpa, Babe", "medium", "easy", "Add recipient name"),
      field("Relationship Label", "Dad, Husband, Boyfriend, Grandpa, Papa", "high", "easy", "Choose relationship"),
      field("Belly Style", "Classic Dad Belly, BBQ Belly, Beach Belly, Couch Belly", "high", "medium", "Choose belly style"),
      field("Outfit Theme", "BBQ apron, Hawaiian shirt, sports jersey, pajamas, office shirt", "medium", "medium", "Choose outfit theme"),
      field("Short Funny Text", "Poke Me, Snack Inspector, Grill Boss, Dad Mode", "high", "easy", "Add funny text"),
      field("Preview Before Production", "Customer checks spelling, photo crop, and character details before production", "medium", "medium", "Approve preview"),
    ];
  }

  if (productType === "Stained Glass Suncatcher") {
    return [
      field("Upload Photo", "Favorite pet or person photo", "high", "medium", "Upload your photo"),
      field("Pet/Person Name", "Milo, Bella, Grandma", "high", "easy", "Add the name"),
      field("Memorial Date/Year", "2012-2026 or Forever in our hearts", "high", "easy", "Add optional date"),
      field("Short Quote", "Still lighting up our home", "high", "easy", "Add a short quote"),
      field("Frame Shape", "Round, arch, heart, ornament", "medium", "medium", "Choose frame shape"),
      field("Light/Rainbow Effect", "Soft sunlight, rainbow glow, warm window reflection", "medium", "medium", "Choose light effect"),
      field("Chain/Suction Cup Option", "Chain hanger or suction cup", "medium", "easy", "Choose hanging option"),
    ];
  }

  if (productType === "Custom Photo Cap") {
    return [
      field("Upload Photo", "Clear photo for the patch or illustrated face", "high", "medium", "Upload photo"),
      field("Dad/Grandpa Title", "Dad, Papa, Grandpa, Coach", "high", "easy", "Add title"),
      field("Children Names", "Emma, Noah, Liam", "high", "easy", "Add children names"),
      field("Year", "Est. 2026 or Since 1998", "medium", "easy", "Add year"),
      field("Hobby Theme", "Fishing, golf, BBQ, baseball, hunting", "medium", "medium", "Choose hobby"),
      field("Patch/Embroidery Style", "Leather patch, embroidered text, vintage badge", "medium", "medium", "Choose patch style"),
    ];
  }

  return [
    field("Upload Photo", "Clear photo of the person, pet, or subject", "high", "medium", "Upload photo"),
    field("Name", "Milo, Dad, Sarah, Grandpa", "high", "easy", "Add name"),
    field("Occasion Text", "Father's Day, birthday, memorial, anniversary", "medium", "easy", "Add occasion"),
    field("Short Message", "A short phrase that fits the design", "high", "easy", "Add message"),
    field("Style Choice", "Funny, sentimental, premium, holiday, minimal", "medium", "medium", "Choose style"),
  ];
}
