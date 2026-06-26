import { NextResponse } from "next/server";
import { logIntegrationRun } from "@/lib/integrationLog";

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  const payload = await request.json();
  const endpoint = process.env.TEEINBLUE_API_URL;
  const apiKey = process.env.TEEINBLUE_API_KEY;

  if (!endpoint || !apiKey) {
    await logIntegrationRun({ id: id("integration"), integrationType: "teeinblue", status: "not_configured", payload });
    return NextResponse.json({
      source: "handoff",
      status: "not_configured",
      message: "TEEINBLUE_API_URL and TEEINBLUE_API_KEY are not configured. The package is ready for manual upload/export.",
      package: payload,
    });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      await logIntegrationRun({ id: id("integration"), integrationType: "teeinblue", status: "failed", payload, response: data });
      return NextResponse.json({ source: "teeinblue", status: "failed", error: data }, { status: response.status });
    }

    await logIntegrationRun({ id: id("integration"), integrationType: "teeinblue", status: "synced", payload, response: data });
    return NextResponse.json({ source: "teeinblue", status: "synced", response: data });
  } catch (error) {
    await logIntegrationRun({ id: id("integration"), integrationType: "teeinblue", status: "failed", payload, response: error instanceof Error ? error.message : "Teeinblue sync failed." });
    return NextResponse.json({ source: "teeinblue", status: "failed", error: error instanceof Error ? error.message : "Teeinblue sync failed." }, { status: 502 });
  }
}
