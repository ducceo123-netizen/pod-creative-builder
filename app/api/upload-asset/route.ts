import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabaseRest";

const BUCKET = "pod-artwork-assets";

function safePathPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "asset";
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw new Error("Invalid data URL.");
  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const bytes = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  return { contentType, bytes };
}

export async function POST(request: Request) {
  try {
    const config = getSupabaseConfig();
    if (!config) throw new Error("Supabase is not configured.");

    const body = (await request.json()) as {
      draftId?: string;
      assetId?: string;
      filename?: string;
      contentType?: string;
      dataUrl?: string;
    };
    if (!body.draftId || !body.assetId || !body.filename || !body.dataUrl) {
      return NextResponse.json({ error: "draftId, assetId, filename, and dataUrl are required." }, { status: 400 });
    }

    const parsed = parseDataUrl(body.dataUrl);
    const contentType = body.contentType || parsed.contentType;
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(contentType)) {
      return NextResponse.json({ error: "Only PNG, JPG, and SVG uploads are supported." }, { status: 400 });
    }

    const path = [safePathPart(body.draftId), safePathPart(body.assetId), safePathPart(body.filename)].join("/");
    const uploadResponse = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: parsed.bytes,
      cache: "no-store",
    });

    if (!uploadResponse.ok) throw new Error(await uploadResponse.text());

    return NextResponse.json({
      source: "supabase-storage",
      bucket: BUCKET,
      path,
      storageUrl: `${config.url}/storage/v1/object/public/${BUCKET}/${path}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Asset could not be uploaded to Supabase Storage.",
      },
      { status: 200 },
    );
  }
}
