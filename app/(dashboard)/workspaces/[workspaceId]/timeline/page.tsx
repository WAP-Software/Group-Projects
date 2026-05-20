"use client";

import { use, useState } from "react";
import { GanttView } from "@/components/timeline/GanttView";
import { CalendarView } from "@/components/timeline/CalendarView";
import { GanttChartSquare, CalendarDays } from "lucide-react";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

type View = "timeline" | "calendar";

export default function TimelinePage({ params }: Props) {
  const { workspaceId } = use(params);
  const [view, setView] = useState<View>("timeline");

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between mb-6 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold">
            {view === "timeline" ? "Project Timeline" : "Calendar"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {view === "timeline"
              ? "Tasks & reviews by deadline — day by day"
              : "Monthly overview of all deadlines"}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-px rounded-lg border border-border p-1 bg-muted/30 shrink-0">
          <button
            onClick={() => setView("timeline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === "timeline"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GanttChartSquare className="h-3.5 w-3.5" />
            Timeline
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              view === "calendar"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar
          </button>
        </div>
      </div>

      <div className="fade-in stagger-2">
        {view === "timeline"
          ? <GanttView workspaceId={workspaceId} />
          : <CalendarView workspaceId={workspaceId} />
        }
      </div>
    </div>
  );
}
