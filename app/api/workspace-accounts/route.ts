import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";

type WorkspaceAccount = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "designer";
  status: "active" | "inactive";
  title?: string;
  createdAt: string;
  updatedAt: string;
};

export async function GET() {
  try {
    const response = await supabaseRest("workspace_accounts?select=*&order=created_at.asc");
    if (!response.ok) throw new Error(await response.text());
    const rows = (await response.json()) as Array<{ account: WorkspaceAccount | null }>;
    return NextResponse.json({ source: "supabase", accounts: rows.map((row) => row.account).filter(Boolean) });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        accounts: [],
        error: error instanceof Error ? error.message : "Workspace accounts unavailable.",
      },
      { status: 200 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { accounts?: WorkspaceAccount[] };
    if (!Array.isArray(body.accounts)) {
      return NextResponse.json({ error: "accounts array is required." }, { status: 400 });
    }

    const rows = body.accounts.map((account) => ({
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      status: account.status,
      title: account.title || null,
      account,
      created_at: account.createdAt,
      updated_at: account.updatedAt,
    }));

    if (!rows.length) return NextResponse.json({ source: "supabase", saved: 0 });

    const response = await supabaseRest("workspace_accounts?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });

    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ source: "supabase", saved: rows.length });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        error: error instanceof Error ? error.message : "Workspace accounts could not be saved to Supabase.",
      },
      { status: 200 },
    );
  }
}
