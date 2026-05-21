"use client";

import { use, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { FileDetailPanel } from "@/components/files/FileDetailPanel";
import { formatDate, formatBytes, mimeLabel, cn } from "@/lib/utils";
import {
  FolderOpen, Kanban, File, FileText, Table2,
  Presentation, Link2, ImageIcon, Clock, Plus,
} from "lucide-react";
import type { FileRecord } from "@/types/database";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

type MobileTab = "files" | "tasks";

function deadlineDays(date: string | null): number | null {
  if (!date) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null;
  const days = deadlineDays(deadline);
  if (days === null) return null;
  const cls = days <= 0 ? "bg-red-500 text-white" : days <= 7 ? "bg-yellow-500 text-white" : "bg-green-500 text-white";
  const label = days < 0 ? "Overdue" : days === 0 ? "Today" : `${days}d`;
  return (
    <span className={cn("inline-flex items-center gap-1 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full", cls)}>
      <Clock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return <Table2 className="h-4 w-4 text-green-600" />;
  if (mime.includes("presentation") || mime.includes("powerpoint")) return <Presentation className="h-4 w-4 text-orange-500" />;
  if (mime === "text/uri-list") return <Link2 className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function WorkspacePage({ params }: Props) {
  const { workspaceId } = use(params);
  const supabase = createClient();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("files");

  const loadFiles = useCallback(async () => {
    const { data } = await supabase
      .from("files")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    const sorted = (data ?? []).sort((a: FileRecord, b: FileRecord) => {
      const da = a.deadline_date ? deadlineDays(a.deadline_date) ?? 999 : 999;
      const db = b.deadline_date ? deadlineDays(b.deadline_date) ?? 999 : 999;
      return da - db;
    });
    setFiles(sorted);
  }, [workspaceId, supabase]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* ── Left: Files ── */}
      <div className={cn(
        "flex flex-col border-r border-border bg-background",
        "w-full md:w-[360px] md:shrink-0",
        mobileTab !== "files" && "hidden md:flex",
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Files</span>
            <span className="text-xs text-muted-foreground">({files.length})</span>
          </div>
          <a
            href={`/workspaces/${workspaceId}/files`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Upload
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {files.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No files yet</p>
              <p className="text-xs text-muted-foreground mt-1">Upload files via the Files page</p>
            </div>
          ) : (
            files.map((file) => (
              <button
                key={file.id}
                onClick={() => { setSelectedFile(file); setDetailOpen(true); }}
                className="w-full text-left rounded-xl border border-border/50 px-3 py-2.5 hover:bg-muted/30 hover:border-primary/30 transition-all bg-card pressable"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0"><FileIcon mime={file.mime_type} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <DeadlineBadge deadline={file.deadline_date} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {mimeLabel(file.mime_type)}
                      {file.size_bytes ? ` · ${formatBytes(file.size_bytes)}` : ""}
                      {` · ${formatDate(file.created_at)}`}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Kanban ── */}
      <div className={cn(
        "flex-1 overflow-hidden",
        mobileTab !== "tasks" && "hidden md:block",
      )}>
        <KanbanBoard workspaceId={workspaceId} />
      </div>

      {/* ── Mobile tab bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-border flex">
        <button
          onClick={() => setMobileTab("files")}
          className={cn("flex-1 py-3 flex flex-col items-center gap-0.5 text-[11px] font-medium transition-colors", mobileTab === "files" ? "text-primary" : "text-muted-foreground")}
        >
          <FolderOpen className="h-5 w-5" />
          Files
        </button>
        <button
          onClick={() => setMobileTab("tasks")}
          className={cn("flex-1 py-3 flex flex-col items-center gap-0.5 text-[11px] font-medium transition-colors", mobileTab === "tasks" ? "text-primary" : "text-muted-foreground")}
        >
          <Kanban className="h-5 w-5" />
          Tasks
        </button>
      </div>

      <FileDetailPanel
        file={selectedFile}
        workspaceId={workspaceId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onRefresh={loadFiles}
      />
    </div>
  );
}
