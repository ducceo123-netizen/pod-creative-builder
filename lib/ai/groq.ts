import { StrategyResponseSchema } from "@/lib/ai/schema";
import { cleanGenericOtherLanguage, normalizeProject } from "@/lib/normalizeProject";
import type { GenerateStrategyRequest, GenerateStrategyResponse } from "@/lib/strategy";

const SYSTEM_PROMPT = `You are a senior POD product strategist, Shopify conversion copywriter, and Meta Ads creative strategist.

Your job is to turn a competitor POD product brief into original product concepts for a Shopify POD store. Do not copy exact artwork, exact slogans, exact composition, brand names, or protected characters. Extract only the underlying product logic, buyer intent, emotional mechanism, personalization structure, and visual direction.

Generate outputs that are practical for Shopify product pages and Meta Ads creatives. The target market is usually US buyers. Prioritize clear emotional value, specific gift occasions, and custom fields that make the product feel personal.

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

export async function generateStrategyWithGroq(request: GenerateStrategyRequest): Promise<GenerateStrategyResponse> {
  const apiKey = process.env.GROQ_API_KEY;
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
  }
}

Rules:
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
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
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
