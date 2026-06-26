import { StrategyResponseSchema } from "@/lib/ai/schema";
import { cleanGenericOtherLanguage, normalizeProject } from "@/lib/normalizeProject";
import type { GenerateStrategyRequest, GenerateStrategyResponse } from "@/lib/strategy";

const SYSTEM_PROMPT = `You are a senior POD product strategist, Shopify conversion copywriter, and Meta Ads creative strategist.

Your job is to turn a competitor POD product brief into a build-ready creative plan for a Shopify POD store. First decompose the competitor product into visible and implied design components, then generate original concepts, component-level prompts, asset plans, and copy. Do not copy exact artwork, exact slogans, exact composition, brand names, or protected characters. Extract only the underlying product logic, buyer intent, emotional mechanism, personalization structure, and visual direction.

Generate outputs that are practical for external design generation, Teeinblue/Figma assembly, Shopify product pages, and Meta Ads creatives. The target market is usually US buyers. Prioritize clear emotional value, specific gift occasions, and custom fields that make the product feel personal.

Avoid generic phrases, overly poetic copy, and cheesy memorial language unless the user explicitly asks for it.

Return strict JSON only. No markdown. No extra explanation.`;

type GroqChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match?.[1]) return match[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

export async function generateStrategyWithGroq(
  request: GenerateStrategyRequest,
  options: { apiKey?: string; model?: string } = {},
): Promise<GenerateStrategyResponse> {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY. Add it to .env.local to enable Groq generation.");
  }

  const normalized = normalizeProject(request.project);

  const prompt = `Create a complete POD creative strategy using this exact JSON shape as the contract. Keep all ids as strings and use the existing project id where relevant.

Project brief:
${JSON.stringify(request.project, null, 2)}

Normalized product inputs:
${JSON.stringify(
  {
    productType: normalized.normalizedProductType,
    visualDirection: normalized.normalizedVisualDirection,
  },
  null,
  2,
)}

Screenshot provided:
${request.screenshotBase64 ? "Yes, base64 image data is available in the request. Use it only as context if supported." : "No screenshot provided."}

Required response shape:
{
  "analysis": {
    "id": "analysis-${request.project.id}",
    "projectId": "${request.project.id}",
    "productBreakdown": {
      "productType": "string",
      "coreBuyer": "string",
      "coreOccasion": "string",
      "coreEmotion": "string",
      "visualMechanism": "string",
      "personalizationLogic": "string",
      "likelyPurchaseReason": "string"
    },
    "customFields": [
      {
        "name": "string",
        "example": "string",
        "emotionalValue": "low | medium | high",
        "difficulty": "easy | medium | hard",
        "recommended": true,
        "shopifyOptionLabel": "string"
      }
    ],
    "inspirationRules": {
      "keepAsInspiration": ["string"],
      "doNotCopy": ["string"],
      "safeTransformationDirections": ["string"]
    },
    "improvementOpportunities": ["string"],
    "scores": {
      "customDepth": "low | medium | high",
      "adsPotential": "low | medium | high",
      "productionDifficulty": "easy | medium | hard",
      "copyRisk": "low | medium | high"
    }
  },
  "concepts": [
    {
      "id": "concept-1",
      "projectId": "${request.project.id}",
      "name": "string",
      "oneLineIdea": "string",
      "buyer": "string",
      "occasion": "string",
      "emotion": "string",
      "customFields": ["string"],
      "designDirection": "string",
      "mockupDirection": "string",
      "adHook": "string",
      "selected": true,
      "scores": {
        "customDepth": "low | medium | high",
        "adsPotential": "low | medium | high",
        "productionDifficulty": "easy | medium | hard",
        "copyRisk": "low | medium | high"
      }
    }
  ],
  "promptPacks": {
    "concept-1": {
      "id": "prompts-concept-1",
      "conceptId": "concept-1",
      "designPrompt": "string",
      "lifestyleMockupPrompt": "string",
      "banner21x9Prompt": "string",
      "showcase16x9Prompt": "string",
      "product468x598Prompt": "string",
      "square1x1Prompt": "string",
      "reel9x16Prompt": "string"
    }
  },
  "copyPacks": {
    "concept-1": {
      "id": "copy-concept-1",
      "conceptId": "concept-1",
      "shopifyTitles": ["string"],
      "shortDescription": "string",
      "fullDescription": "string",
      "bulletBenefits": ["string"],
      "personalizationInstructions": "string",
      "trustNotes": ["string"],
      "faqs": [{"question": "string", "answer": "string"}],
      "tags": ["string"],
      "metaHooks": ["string"],
      "primaryTexts": ["string"],
      "headlines": ["string"],
      "ugcScriptIdea": "string",
      "testingPlan": ["string"]
    }
  },
  "designComponents": [
    {
      "id": "component-face-photo",
      "name": "string",
      "componentType": "uploaded_photo | clipart | character_body | face_cutout | typography | quote_text | name_text | date_text | badge | frame | background | pattern | product_base | material_effect | print_area | mockup_context | personalization_option | decorative_element",
      "role": "customer_input | ai_generated_asset | template_asset | manual_design_layer | product_material | mockup_scene | production_layer",
      "description": "string",
      "sourceFromCompetitor": "string",
      "shouldKeepAsMechanism": true,
      "shouldChangeForOriginality": true,
      "copyRisk": "Low | Medium | High",
      "suggestedReplacement": "string",
      "generationPrompt": "string",
      "materialNotes": "string",
      "teeinblueLayerSuggestion": "string"
    }
  ],
  "personalizationMap": [
    {
      "id": "personalization-photo",
      "label": "string",
      "inputType": "photo_upload | text | dropdown | color | number | date | checkbox",
      "examples": ["string"],
      "required": true,
      "mapsToComponentId": "component-face-photo",
      "teeinblueFieldType": "photo | text | dropdown | checkbox | color",
      "customerFacingLabel": "string",
      "productionNote": "string"
    }
  ],
  "componentAssetPlan": [
    {
      "id": "asset-character-body",
      "componentId": "component-character-body",
      "assetName": "string",
      "assetPurpose": "string",
      "assetSource": "customer_upload | ai_generated | manual_design | fixed_template | mockup_context",
      "required": true,
      "priority": "Must Have | Should Have | Optional",
      "recommendedFormat": "PNG transparent | PNG | JPG | SVG | PSD | Text layer | Prompt only",
      "recommendedTool": "ChatGPT | Ideogram | Midjourney | Figma | Photoshop | Teeinblue | Any",
      "suggestedSize": "string",
      "prompt": "string",
      "status": "Not Started"
    }
  ],
  "materialNotes": ["string"],
  "safeTransformationPlan": {
    "keep": ["string"],
    "change": ["string"],
    "avoid": ["string"],
    "originalityMoves": ["string"],
    "copyRisk": "Low | Medium | High"
  }
}

Rules:
- First decompose the product into customer input, generated artwork, typography, material/product structure, production layers, and mockup context.
- Identify what should be kept as mechanism versus changed for originality.
- Generate component-level asset prompts for photo/face, clipart/character, typography, material, final layout, and mockup/context where relevant.
- Include Teeinblue-friendly layer suggestions for design components when relevant.
- Return 10 to 12 original concepts.
- Mark the strongest 3 concepts selected.
- Generate promptPacks and copyPacks only for selected concepts.
- Prompt pack keys must match selected concept ids.
- Copy pack keys must match selected concept ids.
- Do not copy competitor text, layout, artwork, slogans, brand identity, or protected characters.
- Use practical, specific US-market POD copy.
- Never use the literal word "Other" as a product type or visual direction.
- Use the normalized product type and normalized visual direction when productType or visualStyle is Other.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.45,
      response_format: { type: "json_object" },
    }),
  });

  const data = (await response.json()) as GroqChatResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `Groq request failed with ${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq response did not include message content.");

  const parsed = JSON.parse(cleanGenericOtherLanguage(extractJson(content)));
  return StrategyResponseSchema.parse(parsed);
}
