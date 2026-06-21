import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabaseRest";

export async function GET() {
  const imageProvider = process.env.IMAGE_PROVIDER || "none";
  const imageProviderConfigured =
    (imageProvider === "openai" && Boolean(process.env.OPENAI_API_KEY)) ||
    (imageProvider === "gemini" && Boolean(process.env.GEMINI_API_KEY)) ||
    (imageProvider === "replicate" && Boolean(process.env.REPLICATE_API_TOKEN)) ||
    (imageProvider === "fal" && Boolean(process.env.FAL_KEY));

  return NextResponse.json({
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    supabaseConfigured: isSupabaseConfigured(),
    imageProvider,
    imageProviderConfigured,
    appVersion: "0.2.0",
  });
}
