import { GoogleGenerativeAI } from "@google/generative-ai";
import { StrategyResponseSchema } from "@/lib/ai/schema";
import { cleanGenericOtherLanguage, normalizeProject } from "@/lib/normalizeProject";
import { buildLocalStrategy, type GenerateStrategyRequest, type GenerateStrategyResponse } from "@/lib/strategy";

const SYSTEM_PROMPT = `You are a senior POD product strategist, Shopify conversion copywriter, and Meta Ads creative strategist.

Your job is to turn a competitor POD product brief into original product concepts for a Shopify POD store. Do not copy exact artwork, exact slogans, exact composition, brand names, or protected characters. Extract only the underlying product logic, buyer intent, emotional mechanism, personalization structure, and visual direction.

Generate outputs that are practical for Shopify product pages and Meta Ads creatives. The target market is usually US buyers. Prioritize clear emotional value, specific gift occasions, and custom fields that make the product feel personal.

Avoid generic phrases, overly poetic copy, and cheesy memorial language unless the user explicitly asks for it.

Return strict JSON only. No markdown. No extra explanation.`;

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

export async function generateStrategyWithGemini(request: GenerateStrategyRequest): Promise<GenerateStrategyResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to .env.local to enable Gemini generation.");
  }

  const fallback = buildLocalStrategy(request.project);
  const normalized = normalizeProject(request.project);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.72,
    },
  });

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
${JSON.stringify(fallback, null, 2)}

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

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(cleanGenericOtherLanguage(extractJson(result.response.text())));
  return StrategyResponseSchema.parse(parsed);
}
