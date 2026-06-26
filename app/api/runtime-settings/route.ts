import { NextResponse } from "next/server";
import {
  getRuntimeSettings,
  runtimeProviderDefaults,
  saveRuntimeSettings,
  toPublicRuntimeSetting,
  type RuntimeProviderSetting,
} from "@/lib/runtimeSettings";

function isMasked(value?: string) {
  return Boolean(value?.includes("•"));
}

export async function GET() {
  const settings = await getRuntimeSettings();
  return NextResponse.json({
    source: "supabase",
    settings: settings.map(toPublicRuntimeSetting),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { settings?: RuntimeProviderSetting[] };
    if (!Array.isArray(body.settings)) {
      return NextResponse.json({ error: "settings array is required." }, { status: 400 });
    }

    const current = await getRuntimeSettings();
    const settings = runtimeProviderDefaults.map((fallback) => {
      const incoming = body.settings?.find((setting) => setting.id === fallback.id);
      const existing = current.find((setting) => setting.id === fallback.id);
      const nextApiKey = incoming?.apiKey && !isMasked(incoming.apiKey) ? incoming.apiKey : existing?.apiKey;
      return {
        ...fallback,
        ...existing,
        ...incoming,
        apiKey: nextApiKey,
      };
    });

    const saved = await saveRuntimeSettings(settings);
    return NextResponse.json({
      source: "supabase",
      settings: saved.map(toPublicRuntimeSetting),
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Runtime settings could not be saved.",
      },
      { status: 200 },
    );
  }
}
