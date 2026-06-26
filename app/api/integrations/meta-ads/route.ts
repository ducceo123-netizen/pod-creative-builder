import { NextResponse } from "next/server";
import { logIntegrationRun } from "@/lib/integrationLog";
import { getRuntimeSetting } from "@/lib/runtimeSettings";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  const payload = await request.json();
  const settings = await getRuntimeSetting("metaAds");
  const endpoint = settings.enabled ? settings.endpoint || process.env.META_ADS_API_URL : process.env.META_ADS_API_URL;
  const accessToken = settings.enabled ? settings.apiKey || process.env.META_ACCESS_TOKEN : process.env.META_ACCESS_TOKEN;

  if (!endpoint || !accessToken) {
    await logIntegrationRun({ id: id("integration"), integrationType: "meta_ads", status: "not_configured", payload });
    return NextResponse.json({
      source: "handoff",
      status: "not_configured",
      message: "META_ADS_API_URL and META_ACCESS_TOKEN are not configured. Ad payload is ready for manual upload or a custom Meta workflow.",
      ads: payload,
    });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      await logIntegrationRun({ id: id("integration"), integrationType: "meta_ads", status: "failed", payload, response: data });
      return NextResponse.json({ source: "meta", status: "failed", error: data }, { status: response.status });
    }

    await logIntegrationRun({ id: id("integration"), integrationType: "meta_ads", status: "synced", payload, response: data });
    return NextResponse.json({ source: "meta", status: "synced", response: data });
  } catch (error) {
    await logIntegrationRun({ id: id("integration"), integrationType: "meta_ads", status: "failed", payload, response: error instanceof Error ? error.message : "Meta Ads sync failed." });
    return NextResponse.json({ source: "meta", status: "failed", error: error instanceof Error ? error.message : "Meta Ads sync failed." }, { status: 502 });
  }
}
