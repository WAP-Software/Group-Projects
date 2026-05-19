import { KanbanBoard } from "@/components/kanban/KanbanBoard";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function TasksPage({ params }: Props) {
  const { workspaceId } = await params;
  return (
    <div className="flex flex-col min-h-[calc(100vh-7rem)]">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-bold">Kanban Board</h1>
        <p className="text-sm text-muted-foreground mt-1">Drag tasks between columns to update status</p>
      </div>
      <KanbanBoard workspaceId={workspaceId} />
    </div>
  );
}
