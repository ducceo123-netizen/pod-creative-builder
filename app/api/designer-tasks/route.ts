import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabaseRest";

type DesignerTask = {
  id: string;
  title: string;
  brief: string;
  taskType: string;
  status: string;
  priority: string;
  assignee: string;
  createdBy: string;
  draftId?: string | null;
  draftTitle?: string;
  conceptName?: string;
  assetName?: string;
  dueDate?: string;
  assetUrl?: string;
  designerNote?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export async function GET() {
  try {
    const response = await supabaseRest("designer_tasks?select=*&order=updated_at.desc");
    if (!response.ok) throw new Error(await response.text());
    const rows = (await response.json()) as Array<{ task: DesignerTask | null }>;
    return NextResponse.json({ source: "supabase", tasks: rows.map((row) => row.task).filter(Boolean) });
  } catch (error) {
    return NextResponse.json(
      {
        source: "local-fallback",
        tasks: [],
        error: error instanceof Error ? error.message : "Designer tasks unavailable.",
      },
      { status: 200 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tasks?: DesignerTask[] };
    if (!Array.isArray(body.tasks)) {
      return NextResponse.json({ error: "tasks array is required." }, { status: 400 });
    }

    const rows = body.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      task_type: task.taskType,
      draft_id: task.draftId || null,
      due_date: task.dueDate || null,
      task,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      completed_at: task.completedAt || null,
    }));

    if (!rows.length) return NextResponse.json({ source: "supabase", saved: 0 });

    const response = await supabaseRest("designer_tasks?on_conflict=id", {
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
        error: error instanceof Error ? error.message : "Designer tasks could not be saved to Supabase.",
      },
      { status: 200 },
    );
  }
}
