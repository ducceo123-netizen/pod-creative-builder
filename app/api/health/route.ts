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
    teeinblueConfigured: Boolean(process.env.TEEINBLUE_API_URL && process.env.TEEINBLUE_API_KEY),
    shopifyConfigured: Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN),
    metaAdsConfigured: Boolean(process.env.META_ADS_API_URL && process.env.META_ACCESS_TOKEN),
    appVersion: "0.2.0",
  });
}
