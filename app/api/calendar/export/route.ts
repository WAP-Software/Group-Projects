import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tasksRes, reviewsRes, pollsRes, wsRes] = await Promise.all([
    supabase.from("tasks").select("id, title, due_date, description").eq("workspace_id", workspaceId).not("due_date", "is", null),
    supabase.from("reviews").select("id, title, due_date").eq("workspace_id", workspaceId).not("due_date", "is", null),
    supabase.from("polls").select("id, question, expires_at").eq("workspace_id", workspaceId).not("expires_at", "is", null),
    supabase.from("workspaces").select("name").eq("id", workspaceId).single(),
  ]);

  const wsName = wsRes.data?.name ?? "FinanceCollab";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//FinanceCollab///${wsName}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  function toIcsDate(dateStr: string): string {
    return dateStr.replace(/-/g, "").split("T")[0];
  }

  function addEvent(id: string, summary: string, date: string, description?: string) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${id}@finance-collab`);
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(date)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(date)}`);
    lines.push(`SUMMARY:${summary.replace(/,/g, "\\,")}`);
    if (description) lines.push(`DESCRIPTION:${description.replace(/,/g, "\\,").replace(/\n/g, "\\n")}`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
    lines.push("END:VEVENT");
  }

  (tasksRes.data ?? []).forEach((t) => {
    addEvent(t.id, `[Task] ${t.title}`, t.due_date!, t.description ?? undefined);
  });

  (reviewsRes.data ?? []).forEach((r) => {
    addEvent(r.id, `[Review] ${r.title}`, r.due_date!);
  });

  (pollsRes.data ?? []).forEach((p) => {
    addEvent(p.id, `[Poll closes] ${p.question}`, p.expires_at!);
  });

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${wsName.replace(/\s/g, "-")}-calendar.ics"`,
    },
  });
}
