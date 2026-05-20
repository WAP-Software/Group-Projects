import { GanttView } from "@/components/timeline/GanttView";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function TimelinePage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="mb-6 fade-in stagger-1">
        <h1 className="text-2xl font-bold">Project Timeline</h1>
        <p className="text-sm text-muted-foreground mt-1">Gantt-Ansicht aller Tasks und Meilensteine</p>
      </div>
      <div className="fade-in stagger-2">
        <GanttView workspaceId={workspaceId} />
      </div>
    </div>
  );
}
