import { MOCKUP_SCENES } from "@/lib/constants";
import type { Analysis, CustomField, ProductScores } from "@/types/analysis";
import type { Concept } from "@/types/concept";
import type { CopyPack } from "@/types/copyPack";
import type { Project } from "@/types/project";
import type { PromptPack } from "@/types/promptPack";

const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const fallback = (value: string | undefined, backup: string) => value?.trim() || backup;

const fieldTemplates: CustomField[] = [
  {
    name: "Customer photo",
    example: "Upload a favorite high-resolution image",
    emotionalValue: "high",
    difficulty: "medium",
    recommended: true,
    shopifyOptionLabel: "Upload your photo",
  },
  {
    name: "Name",
    example: "Milo",
    emotionalValue: "medium",
    difficulty: "easy",
    recommended: true,
    shopifyOptionLabel: "Add the name",
  },
  {
    name: "Occasion date",
    example: "June 14, 2026",
    emotionalValue: "high",
    difficulty: "easy",
    recommended: true,
    shopifyOptionLabel: "Add an optional date",
  },
  {
    name: "Short message",
    example: "Still lighting up our home",
    emotionalValue: "high",
    difficulty: "easy",
    recommended: true,
    shopifyOptionLabel: "Add a short message",
  },
  {
    name: "Background theme",
    example: "Garden, beach, home window, holiday scene",
    emotionalValue: "medium",
    difficulty: "medium",
    recommended: false,
    shopifyOptionLabel: "Choose a background style",
  },
];

export function createProject(seed?: Partial<Project>): Project {
  const now = new Date().toISOString();
  return {
    id: id("project"),
    name: seed?.name || "Untitled POD Brief",
    createdAt: now,
    updatedAt: now,
    status: "draft",
    productType: "Suncatcher",
    targetMarket: "United States",
    buyerPersona: "Dog Mom",
    occasion: "Pet Memorial",
    niche: "Personalized pet gifts",
    brandVoice: ["Warm", "Meaningful", "Emotional but not cheesy"],
    visualStyle: ["Stained Glass"],
    outputs: [
      "Product breakdown",
      "Custom fields map",
      "New product angles",
      "Design prompts",
      "Mockup prompts",
      "Shopify title and description",
      "Meta Ads hooks and primary texts",
      "SEO keywords",
      "Export Markdown",
      "Export JSON",
    ],
    ...seed,
  };
}

export function generateAnalysis(project: Project): Analysis {
  const productType = fallback(project.productType, "Custom POD product");
  const buyer = fallback(project.buyerPersona, "Gift buyer");
  const occasion = fallback(project.occasion, "Meaningful gifting moment");
  const niche = fallback(project.niche, "personalized gifts");
  const visual = project.visualStyle?.[0] || "premium illustrated";

  return {
    id: id("analysis"),
    projectId: project.id,
    productBreakdown: {
      productType: `Custom ${productType.toLowerCase()}`,
      coreBuyer: buyer,
      coreOccasion: occasion,
      coreEmotion: occasion.toLowerCase().includes("memorial")
        ? "Warm remembrance"
        : "Personal, thoughtful recognition",
      visualMechanism: `${visual} artwork translated into a custom ${productType.toLowerCase()} that feels giftable and original.`,
      personalizationLogic:
        "Use the competitor only for the personalization pattern, then change the quote system, composition, art style, and mockup context.",
      likelyPurchaseReason: `The buyer wants a ${niche} product that feels specific to their relationship, not like a generic marketplace template.`,
    },
    customFields: fieldTemplates,
    inspirationRules: {
      keepAsInspiration: [
        "Product category and buyer intent",
        "Personalization mechanism",
        "Emotional buying reason",
        "The role of the occasion in making the purchase urgent",
      ],
      doNotCopy: [
        "Exact artwork or character pose",
        "Exact slogan, typography, or phrase structure",
        "Brand-specific layout, icon set, border, or color palette",
        "Identical product photography or ad composition",
      ],
      safeTransformationDirections: [
        "Change the buyer persona or relationship angle",
        "Create a new quote system and naming convention",
        "Use a different art style, frame shape, and composition",
        "Build stronger lifestyle mockups for the US market",
      ],
    },
    improvementOpportunities: [
      "Make the emotional promise more specific to the buyer and occasion.",
      "Add clearer personalization labels so shoppers know exactly what to submit.",
      "Create mockups that show scale, material, and use context in one glance.",
      "Use ad hooks that focus on the buyer's moment, not the competitor's wording.",
    ],
    scores: {
      customDepth: "high",
      adsPotential: "high",
      productionDifficulty: productType === "T-shirt" || productType === "Mug" ? "easy" : "medium",
      copyRisk: project.productDescription ? "medium" : "low",
    },
  };
}

const conceptNames = [
  "Still Here In The Light",
  "Made For Their Favorite Spot",
  "A Little Window Of Us",
  "The Day We Always Remember",
  "Home Feels Like Them",
  "Your Story, Softly Framed",
  "Every Morning With You",
  "The Gift That Knows Their Name",
  "Kept Close, Made Custom",
  "A Small Sign Of Forever",
  "The Place They Belong",
  "One Memory, Made Useful",
];

export function generateConcepts(project: Project, analysis: Analysis): Concept[] {
  const productType = fallback(project.productType, "Suncatcher");
  const buyer = fallback(project.buyerPersona, "Gift buyer");
  const occasion = fallback(project.occasion, "Meaningful gift");
  const visual = project.visualStyle?.[0] || "Watercolor Portrait";

  return conceptNames.map((name, index) => {
    const scene = MOCKUP_SCENES[index % MOCKUP_SCENES.length];
    const scores: ProductScores = {
      customDepth: index % 4 === 0 ? "medium" : "high",
      adsPotential: index % 5 === 0 ? "medium" : "high",
      productionDifficulty: index % 3 === 0 ? "easy" : "medium",
      copyRisk: "low",
    };

    return {
      id: id("concept"),
      projectId: project.id,
      name,
      oneLineIdea: `A personalized ${productType.toLowerCase()} for ${buyer.toLowerCase()} buyers that turns ${occasion.toLowerCase()} into a practical, original keepsake.`,
      buyer,
      occasion,
      emotion: analysis.productBreakdown.coreEmotion,
      customFields: analysis.customFields.filter((field) => field.recommended).map((field) => field.name),
      designDirection: `${visual} direction with a changed layout, fresh border system, restrained typography, and no borrowed competitor elements.`,
      mockupDirection: `${scene}, natural daylight, clear scale reference, product shown in use with a warm but realistic shopping-photo mood.`,
      adHook:
        index % 2 === 0
          ? `A custom ${productType.toLowerCase()} for the memory they still keep close.`
          : `For the ${buyer.toLowerCase()} who wants a gift that feels made for one story.`,
      selected: index < 3,
      scores,
    };
  });
}

export function generatePromptPack(concept: Concept, productType: string): PromptPack {
  const base = `${concept.name}, custom ${productType.toLowerCase()}, ${concept.designDirection}. Show believable materials, clean edges, accurate scale, premium handmade gift quality, no copied artwork, no brand logos.`;
  return {
    id: id("prompts"),
    conceptId: concept.id,
    designPrompt: `${base} Front-facing product art, centered composition, production-ready print design, transparent or plain light background, crisp personalization areas, realistic texture, no mockup scene.`,
    lifestyleMockupPrompt: `${base} ${concept.mockupDirection}, eye-level camera angle, soft shadows, realistic American home setting, natural reflections, no fake AI artifacts.`,
    banner21x9Prompt: `${base} Wide 21:9 hero banner, product placed left third with warm lifestyle space, bright natural light, clean negative space for Shopify header crop.`,
    showcase16x9Prompt: `${base} 16:9 product showcase, angled product view, close detail insert, gentle background blur, premium ecommerce lighting.`,
    product468x598Prompt: `${base} 468:598 ecommerce product image, vertical crop, product centered, neutral background, clear material detail, accurate color.`,
    square1x1Prompt: `${base} 1:1 Meta ad creative, product in use, strong emotional focal point, scroll-stopping but natural, no text overlay.`,
    reel9x16Prompt: `${base} 9:16 short-form video frame, hand placing the product in its setting, warm movement cue, bright realistic lighting, phone-camera perspective.`,
  };
}

export function generateCopyPack(concept: Concept, productType: string): CopyPack {
  const product = productType.toLowerCase();
  return {
    id: id("copy"),
    conceptId: concept.id,
    shopifyTitles: [
      `Personalized ${productType} for ${concept.buyer}`,
      `${concept.name} Custom ${productType}`,
      `Custom ${productType} Gift for ${concept.occasion}`,
      `Personalized ${concept.occasion} ${productType}`,
      `Meaningful ${productType} With Photo and Name`,
      `Custom Keepsake ${productType} for ${concept.buyer}`,
      `Made-For-You ${productType} Gift`,
      `Personalized ${productType} With Your Story`,
    ],
    shortDescription: `Turn one meaningful detail into a custom ${product} made for ${concept.buyer.toLowerCase()} buyers and ${concept.occasion.toLowerCase()}.`,
    fullDescription: `This personalized ${product} is designed to feel specific, thoughtful, and easy to give. Add the photo, name, date, or short message that matters most, and the final piece becomes a warm keepsake for ${concept.occasion.toLowerCase()}. The design direction is original, gift-ready, and made to feel personal without looking overdone.`,
    bulletBenefits: [
      "Personalized with the details that make the gift feel one of one.",
      "Designed around a clear buyer, occasion, and emotional reason to buy.",
      "Works as a keepsake, display piece, or thoughtful everyday reminder.",
      "Clean production direction keeps the result polished and easy to approve.",
      "Simple gift message makes it easy for shoppers to understand the offer.",
    ],
    personalizationInstructions:
      "Upload a clear photo if requested, enter the name exactly as you want it shown, add an optional date or short message, and review spelling before checkout.",
    trustNotes: [
      "Preview details are checked before production.",
      "Use a clear, high-resolution photo for the best result.",
      "Made to order, so small layout adjustments may be made for balance.",
    ],
    faqs: [
      { question: "Can I add a custom message?", answer: "Yes. Keep it short so the final layout stays clean and readable." },
      { question: "What kind of photo works best?", answer: "Bright, clear photos with the subject facing the camera usually work best." },
      { question: "Can this be sent as a gift?", answer: "Yes. The copy and packaging direction are built around gifting." },
      { question: "Will the design copy another store?", answer: "No. The concept uses original wording, layout, and art direction." },
      { question: "What should I check before ordering?", answer: "Review names, dates, and spelling carefully before submitting." },
    ],
    tags: [
      productType,
      concept.buyer,
      concept.occasion,
      "personalized gift",
      "custom keepsake",
      "photo gift",
      "Shopify POD",
      "US gift",
    ],
    metaHooks: [
      concept.adHook,
      "The gift that feels like it was made from one real memory.",
      `For ${concept.buyer.toLowerCase()} buyers who want something more personal.`,
      `A simple custom ${product} with a story behind it.`,
      "Not another generic gift.",
      "Made for the moment they keep thinking about.",
      "Add the details. Make it theirs.",
      `A thoughtful ${concept.occasion.toLowerCase()} gift without the cheesy copy.`,
      "Small details, big meaning.",
      "When the name matters as much as the gift.",
    ],
    primaryTexts: [
      `Create a personalized ${product} with the photo, name, and message that make the gift feel specific.`,
      `For ${concept.occasion.toLowerCase()}, give something that feels personal from the first glance.`,
      `Choose the details, approve the spelling, and turn a simple ${product} into a keepsake.`,
      `A warmer way to give a custom gift to ${concept.buyer.toLowerCase()} buyers.`,
      `Built around one story, one person, and one reason to remember.`,
    ],
    headlines: [
      `Personalized ${productType}`,
      `Made For ${concept.buyer}`,
      `Custom ${concept.occasion} Gift`,
      "Add Photo, Name, Message",
      "A Keepsake With Meaning",
    ],
    ugcScriptIdea:
      "Open with the finished product in hand, show the personalization details close up, cut to the lifestyle placement, then end with the buyer reaction or gift-ready packaging.",
    testingPlan: [
      "Test one emotional hook against one practical personalization hook.",
      "Compare clean product-only image versus lifestyle mockup.",
      "Run buyer-specific copy against occasion-specific copy.",
      "Keep the same landing page while testing first creative variables.",
    ],
  };
}
