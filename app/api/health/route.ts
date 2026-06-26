import { NextResponse } from "next/server";
import { getRuntimeSettings } from "@/lib/runtimeSettings";
import { isSupabaseConfigured } from "@/lib/supabaseRest";

export async function GET() {
  const runtimeSettings = await getRuntimeSettings();
  const groqSettings = runtimeSettings.find((setting) => setting.id === "groq");
  const imageSettings = runtimeSettings.find((setting) => setting.id === "openaiImage");
  const teeinblueSettings = runtimeSettings.find((setting) => setting.id === "teeinblue");
  const shopifySettings = runtimeSettings.find((setting) => setting.id === "shopify");
  const metaSettings = runtimeSettings.find((setting) => setting.id === "metaAds");
  const imageProvider = process.env.IMAGE_PROVIDER || "none";
  const imageProviderConfigured =
    (imageProvider === "openai" && Boolean(process.env.OPENAI_API_KEY)) ||
    (imageProvider === "gemini" && Boolean(process.env.GEMINI_API_KEY)) ||
    (imageProvider === "replicate" && Boolean(process.env.REPLICATE_API_TOKEN)) ||
    (imageProvider === "fal" && Boolean(process.env.FAL_KEY));

  return NextResponse.json({
    groqConfigured: Boolean(process.env.GROQ_API_KEY || (groqSettings?.enabled && groqSettings.apiKey)),
    supabaseConfigured: isSupabaseConfigured(),
    imageProvider: imageSettings?.enabled ? imageSettings.provider : imageProvider,
    imageProviderConfigured: Boolean(imageProviderConfigured || (imageSettings?.enabled && imageSettings.apiKey)),
    teeinblueConfigured: Boolean((teeinblueSettings?.enabled && teeinblueSettings.apiKey && teeinblueSettings.endpoint) || (process.env.TEEINBLUE_API_URL && process.env.TEEINBLUE_API_KEY)),
    shopifyConfigured: Boolean((shopifySettings?.enabled && shopifySettings.apiKey && shopifySettings.storeDomain) || (process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN)),
    metaAdsConfigured: Boolean((metaSettings?.enabled && metaSettings.apiKey && metaSettings.endpoint) || (process.env.META_ADS_API_URL && process.env.META_ACCESS_TOKEN)),
    appVersion: "0.2.0",
  });
}
