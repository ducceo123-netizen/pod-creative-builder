import { NextResponse } from "next/server";
import { generateStrategyWithGroq } from "@/lib/ai/groq";
import { getRuntimeSetting } from "@/lib/runtimeSettings";
import { buildLocalStrategy, type GenerateStrategyRequest } from "@/lib/strategy";

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateStrategyRequest;

  if (!body.project) {
    return NextResponse.json({ error: "Missing project in request body." }, { status: 400 });
  }

  const groqSettings = await getRuntimeSetting("groq");
  const apiKey = groqSettings.enabled ? groqSettings.apiKey || process.env.GROQ_API_KEY : process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      ...buildLocalStrategy(body.project),
      source: "local",
      fallbackReason: "Missing Groq API key. Add it in Settings > Runtime API Keys or set GROQ_API_KEY.",
    });
  }

  try {
    return NextResponse.json({ ...(await generateStrategyWithGroq(body, { apiKey, model: groqSettings.model })), source: "groq" });
  } catch (error) {
    console.error("Groq generation failed; falling back to local strategy.", error);
    return NextResponse.json({
      ...buildLocalStrategy(body.project),
      source: "local-fallback",
      fallbackReason: error instanceof Error ? error.message : "Groq generation failed.",
    });
  }
}
