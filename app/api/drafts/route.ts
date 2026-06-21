import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";

export async function GET() {
  try {
    const response = await supabaseRest("creative_drafts?select=*&order=updated_at.desc");
    if (!response.ok) throw new Error(await response.text());
    const rows = (await response.json()) as Array<{ draft: unknown }>;
    return NextResponse.json({ source: "supabase", drafts: rows.map((row) => row.draft).filter(Boolean) });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        drafts: [],
        error: error instanceof Error ? error.message : "Supabase drafts unavailable.",
      },
      { status: 200 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const draft = await request.json();
    if (!draft?.id) return NextResponse.json({ error: "Draft id is required." }, { status: 400 });

    const response = await supabaseRest("creative_drafts?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([
        {
          id: draft.id,
          title: draft.title || "Untitled POD Draft",
          status: draft.status || "draft",
          product_type: draft.productType || null,
          buyer_persona: draft.buyerPersona || null,
          occasion: draft.occasion || null,
          competitor_brand: draft.competitorBrand || null,
          competitor_url: draft.competitorUrl || null,
          opportunity_score: draft.opportunityScore?.overall || null,
          draft,
          updated_at: new Date().toISOString(),
        },
      ]),
    });

    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ source: "supabase", draft });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Draft could not be saved to Supabase.",
      },
      { status: 200 },
    );
  }
}
