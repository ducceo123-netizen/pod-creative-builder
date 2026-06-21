import { NextResponse } from "next/server";
import { generateStrategyWithGroq } from "@/lib/ai/groq";
import { buildLocalStrategy, type GenerateStrategyRequest } from "@/lib/strategy";

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateStrategyRequest;

  if (!body.project) {
    return NextResponse.json({ error: "Missing project in request body." }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({
      ...buildLocalStrategy(body.project),
      source: "local",
      fallbackReason: "Missing GROQ_API_KEY on the server. Add it to the app environment and restart/redeploy.",
    });
  }

  try {
    return NextResponse.json({ ...(await generateStrategyWithGroq(body)), source: "groq" });
  } catch (error) {
    console.error("Groq generation failed; falling back to local strategy.", error);
    return NextResponse.json({
      ...buildLocalStrategy(body.project),
      source: "local-fallback",
      fallbackReason: error instanceof Error ? error.message : "Groq generation failed.",
    });
  }
}
