import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";

export async function POST(request: Request) {
  try {
    const record = await request.json();
    if (!record?.id || !record?.filename || !record?.exportType) {
      return NextResponse.json({ error: "Export id, filename, and exportType are required." }, { status: 400 });
    }

    const response = await supabaseRest("export_records?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          id: record.id,
          draft_id: record.draftId || null,
          export_type: record.exportType,
          filename: record.filename,
          content_type: record.contentType,
          size_bytes: record.sizeBytes || 0,
          metadata: record.metadata || {},
          created_at: record.createdAt || new Date().toISOString(),
        },
      ]),
    });

    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ source: "supabase", record });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Export record could not be saved to Supabase.",
      },
      { status: 200 },
    );
  }
}
