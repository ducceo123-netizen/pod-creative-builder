import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const draft = await request.json();
    if (!id || !draft?.id) return NextResponse.json({ error: "Draft id is required." }, { status: 400 });

    const response = await supabaseRest(`creative_drafts?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
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
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ source: "supabase", draft });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Draft could not be updated in Supabase.",
      },
      { status: 200 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Draft id is required." }, { status: 400 });

    const response = await supabaseRest(`creative_drafts?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ source: "supabase", deleted: true });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Draft could not be deleted from Supabase.",
      },
      { status: 200 },
    );
  }
}
