import { NextResponse } from "next/server";
import { generateStrategyWithGemini } from "@/lib/ai/gemini";
import { buildLocalStrategy, type GenerateStrategyRequest } from "@/lib/strategy";

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateStrategyRequest;

  if (!body.project) {
    return NextResponse.json({ error: "Missing project in request body." }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ...buildLocalStrategy(body.project), source: "local" });
  }

  try {
    return NextResponse.json({ ...(await generateStrategyWithGemini(body)), source: "gemini" });
  } catch (error) {
    console.error("Gemini generation failed; falling back to local strategy.", error);
    return NextResponse.json({ ...buildLocalStrategy(body.project), source: "local-fallback" });
  }
}
