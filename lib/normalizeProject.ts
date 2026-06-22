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

  if ((text.includes("squishy") || text.includes("poke") || text.includes("belly")) && (text.includes("fridge magnet") || text.includes("acrylic magnet") || text.includes("magnet"))) return "Squishy Acrylic Fridge Magnet";
  if (text.includes("fridge magnet") || text.includes("acrylic magnet") || text.includes("magnet")) return "Acrylic Fridge Magnet";
  if (text.includes("suncatcher") || text.includes("stained glass") || text.includes("window hanging") || text.includes("sunlight") || text.includes("rainbow")) return "Stained Glass Suncatcher";
  if (text.includes("dad cap") || text.includes("photo cap") || text.includes("custom cap") || text.includes("baseball cap") || text.includes("cap") || text.includes("hat")) return "Custom Photo Cap";
  if (text.includes("mug") || text.includes("coffee") || text.includes("cup")) return "Personalized Mug";
  if (text.includes("t-shirt") || text.includes("shirt") || text.includes("tee") || text.includes("apparel") || text.includes("hoodie") || text.includes("sweatshirt")) return "Personalized T-Shirt";
  if (text.includes("ornament")) return "Personalized Ornament";
  if (text.includes("blanket") || text.includes("throw blanket") || text.includes("fleece")) return "Personalized Blanket";
  if (text.includes("canvas") || text.includes("canvas print") || text.includes("wall art")) return "Custom Canvas Print";
  if (text.includes("acrylic plaque") || text.includes("acrylic block") || text.includes("acrylic sign")) return "Personalized Acrylic Plaque";
  if (text.includes("doormat")) return "Personalized Doormat";
  if (text.includes("garden flag") || text.includes("yard flag")) return "Garden Flag";
  if (text.includes("phone case")) return "Phone Case";
  if (text.includes("keychain") || text.includes("key ring")) return "Acrylic Keychain";
  if (text.includes("poster") || text.includes("print poster")) return "Photo Upload Poster";
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

  if (normalizedProductType === "Personalized T-Shirt") {
    return "Typography and custom character apparel layout, readable shirt graphic, gift-ready personalization, clean print spacing";
  }

  if (normalizedProductType === "Personalized Mug") {
    return "Wraparound mug design with readable text, photo or character focal point, clean ecommerce mockup, giftable kitchen context";
  }

  if (normalizedProductType === "Personalized Ornament") {
    return "Holiday keepsake ornament layout, warm festive detail, clear personalization, premium gift-ready presentation";
  }

  if (normalizedProductType === "Custom Canvas Print" || normalizedProductType === "Photo Upload Poster") {
    return "Wall-art composition with strong focal subject, clean typography, premium home decor mockup, no copied layout";
  }

  if (normalizedProductType === "Personalized Blanket" || normalizedProductType === "Personalized Pillow") {
    return "Cozy home textile design, soft lifestyle setting, readable personalization, warm gift-ready composition";
  }

  if (normalizedProductType === "Personalized Acrylic Plaque") {
    return "Premium acrylic keepsake design with glowing edge detail, clear photo/text hierarchy, elegant gift presentation";
  }

  if (normalizedProductType === "Personalized Doormat" || normalizedProductType === "Garden Flag") {
    return "Outdoor home decor layout with bold readable typography, welcoming lifestyle context, weather-ready product mockup";
  }

  if (normalizedProductType === "Acrylic Keychain" || normalizedProductType === "Phone Case") {
    return "Compact personalized accessory design, strong silhouette, clear subject detail, ecommerce-ready product mockup";
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

  if (productType === "Personalized T-Shirt") {
    return [
      field("Recipient Nickname", "Dad, Papa, Mimi, Coach", "high", "easy", "Add nickname"),
      field("Name", "Mike, Sarah, Grandpa Joe", "high", "easy", "Add name"),
      field("Upload Photo", "Clear face or subject photo if photo style is selected", "high", "medium", "Upload photo"),
      field("Character Features", "Hair, beard, glasses, outfit, hobby props", "medium", "medium", "Describe character"),
      field("Kids/Grandkids Names", "Emma, Noah, Liam", "high", "easy", "Add family names"),
      field("Quote/Text", "Best Dad Ever, Grandpa Crew, Custom funny quote", "high", "easy", "Add shirt text"),
      field("Shirt Color", "Black, white, heather gray, navy", "medium", "easy", "Choose shirt color"),
    ];
  }

  if (productType === "Personalized Mug") {
    return [
      field("Upload Photo", "Person, pet, family, or couple photo", "high", "medium", "Upload photo"),
      field("Name", "Milo, Dad, Grandma, Sarah", "high", "easy", "Add name"),
      field("Quote", "Best Dad Ever, Coffee With My Dog, Custom message", "high", "easy", "Add quote"),
      field("Role", "Dad, Mom, Teacher, Dog Mom, Grandpa", "high", "easy", "Choose role"),
      field("Side Selection", "Front only, wraparound, left/right side", "medium", "easy", "Choose mug layout"),
      field("Art Style", "Watercolor, cartoon, minimalist, photo collage", "medium", "medium", "Choose art style"),
    ];
  }

  if (productType === "Personalized Ornament") {
    return [
      field("Upload Photo", "Family, pet, couple, new home, or memorial photo", "high", "medium", "Upload photo"),
      field("Name(s)", "The Johnson Family, Milo, Emma", "high", "easy", "Add names"),
      field("Year", "2026", "medium", "easy", "Add year"),
      field("Occasion Text", "Our First Christmas, Memorial, New Home", "high", "easy", "Add occasion"),
      field("Shape", "Round, heart, star, snowflake", "medium", "medium", "Choose shape"),
    ];
  }

  if (productType === "Personalized Blanket") {
    return [
      field("Upload Photo(s)", "Family, pet, couple, or collage photos", "high", "medium", "Upload photos"),
      field("Name(s)", "Grandma, Mom, The Smith Family", "high", "easy", "Add names"),
      field("Short Message", "Wrapped in love, Custom family message", "high", "easy", "Add message"),
      field("Blanket Size", "30x40, 50x60, 60x80", "medium", "easy", "Choose size"),
      field("Background Theme", "Floral, stars, holiday, neutral, pet pattern", "medium", "medium", "Choose background"),
    ];
  }

  if (productType === "Custom Canvas Print" || productType === "Photo Upload Poster") {
    return [
      field("Upload Photo", "Portrait, pet, family, couple, home, or car photo", "high", "medium", "Upload photo"),
      field("Name/Title", "The Smith Family, Milo, Lake House", "high", "easy", "Add title"),
      field("Date/Location", "Est. 2026, coordinates, city, memorial date", "medium", "easy", "Add date or place"),
      field("Quote", "Home is wherever we are together", "high", "easy", "Add quote"),
      field("Frame/Size", "8x10, 12x18, 16x20, framed/unframed", "medium", "easy", "Choose size"),
    ];
  }

  if (productType === "Personalized Acrylic Plaque") {
    return [
      field("Upload Photo", "Couple, family, pet, memorial, or recipient photo", "high", "medium", "Upload photo"),
      field("Name(s)", "Sarah & Mike, Dad, Milo", "high", "easy", "Add names"),
      field("Message", "Custom dedication or short quote", "high", "easy", "Add message"),
      field("Date", "Anniversary, memorial date, birthday, year", "medium", "easy", "Add date"),
      field("Base/Light Option", "Wood base, LED base, clear acrylic only", "medium", "medium", "Choose display option"),
    ];
  }

  if (productType === "Personalized Doormat") {
    return [
      field("Family Name", "The Johnsons, Miller Home", "high", "easy", "Add family name"),
      field("Address/Year", "Est. 2026 or house number", "medium", "easy", "Add optional detail"),
      field("Pet/Character Option", "Dog breed, cat, family icons", "medium", "medium", "Choose icons"),
      field("Greeting Text", "Welcome, Hope you like dogs, Custom phrase", "high", "easy", "Add greeting"),
      field("Mat Size", "Standard, large, double door", "medium", "easy", "Choose size"),
    ];
  }

  if (productType === "Garden Flag") {
    return [
      field("Family Name", "The Johnson Garden, Grandma's Garden", "high", "easy", "Add name"),
      field("Theme", "Floral, pet memorial, holiday, patriotic, seasonal", "medium", "medium", "Choose theme"),
      field("Short Message", "Welcome, Bloom where planted, Custom phrase", "high", "easy", "Add message"),
      field("Photo/Icon", "Pet photo, house illustration, flower icon", "medium", "medium", "Upload or choose icon"),
      field("Season", "Spring, summer, fall, Christmas", "medium", "easy", "Choose season"),
    ];
  }

  if (productType === "Personalized Pillow") {
    return [
      field("Upload Photo", "Person, pet, family, or home photo", "high", "medium", "Upload photo"),
      field("Name(s)", "Milo, Mom, The Smith Family", "high", "easy", "Add names"),
      field("Short Message", "Custom cozy message or quote", "high", "easy", "Add message"),
      field("Pillow Size", "14x14, 16x16, 18x18", "medium", "easy", "Choose size"),
      field("Background Theme", "Floral, neutral, holiday, pet pattern", "medium", "medium", "Choose background"),
    ];
  }

  if (productType === "Acrylic Keychain") {
    return [
      field("Upload Photo", "Person, pet, couple, or car photo", "high", "medium", "Upload photo"),
      field("Name", "Milo, Dad, Sarah", "high", "easy", "Add name"),
      field("Short Text", "Drive safe, Miss you, Custom phrase", "high", "easy", "Add text"),
      field("Shape", "Heart, round, rectangle, custom cutout", "medium", "medium", "Choose shape"),
      field("Charm Option", "Tassel, clip, glitter, double-sided", "medium", "medium", "Choose add-on"),
    ];
  }

  if (productType === "Phone Case") {
    return [
      field("Phone Model", "iPhone 15, iPhone 16 Pro, Samsung Galaxy", "medium", "easy", "Choose model"),
      field("Upload Photo", "Person, pet, couple, or collage photos", "high", "medium", "Upload photo"),
      field("Name/Initials", "Sarah, M, Dad", "high", "easy", "Add name or initials"),
      field("Style Theme", "Minimal, floral, collage, cartoon, luxury", "medium", "medium", "Choose style"),
      field("Case Color", "Clear, black, white, pink, navy", "medium", "easy", "Choose case color"),
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
