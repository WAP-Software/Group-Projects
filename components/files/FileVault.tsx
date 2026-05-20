"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadToR2, deleteFromR2, downloadFile } from "@/lib/cloudflare/r2";
import { formatBytes, formatDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload, Search, MoreHorizontal, Download, Trash2,
  FileText, ImageIcon, File, FolderOpen, CloudUpload, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import type { FileRecord } from "@/types/database";
import { FileDetailPanel } from "./FileDetailPanel";

function fileIcon(mime: string | null) {
  if (!mime) return <File className="h-4 w-4 text-slate-400" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-slate-400" />;
}

interface Props {
  workspaceId: string;
}

export function FileVault({ workspaceId }: Props) {
  const supabase = createClient();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const dragCounter = useRef(0);

  const loadFiles = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from("files")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setFiles(data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    loadFiles();
    const sub = supabase
      .channel(`files:${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "files", filter: `workspace_id=eq.${workspaceId}` }, () => loadFiles(true))
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadFiles, workspaceId]);

  async function doUpload(file: File) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (!user || authErr) { toast.error("Not authenticated"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { toast.error("No auth token"); return; }

    setUploading(true);
    setUploadProgress(10);
    try {
      const { key } = await uploadToR2(file, workspaceId, user.id, token);
      setUploadProgress(80);
      await supabase.from("files").insert({
        workspace_id: workspaceId,
        name: file.name,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        r2_key: key,
        folder_path: "/",
        uploaded_by: user.id,
      });
      setUploadProgress(100);
      toast.success("File uploaded!");
      loadFiles();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await doUpload(file);
    e.target.value = "";
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await doUpload(file);
  }

  async function handleDownload(file: FileRecord) {
    try {
      await downloadFile(file.r2_key, file.original_name);
    } catch {
      toast.error("Download fehlgeschlagen");
    }
  }

  async function handleDelete(file: FileRecord) {
    if (!confirm(`Delete "${file.name}"?`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) await deleteFromR2(file.r2_key, session.access_token).catch(() => {});
    await supabase.from("files").delete().eq("id", file.id);
    toast.success("File deleted");
    loadFiles();
  }

  const filtered = files.filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div
      className="p-6 max-w-7xl mx-auto w-full relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-4 z-50 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-primary/5 pointer-events-none">
          <CloudUpload className="h-10 w-10 text-primary" />
          <p className="text-primary font-semibold text-lg">Drop file to upload</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-sm text-muted-foreground mt-1">Click a file to comment and view linked tasks — drag & drop to upload</p>
        </div>
        <label className="cursor-pointer">
          <Button asChild className="gap-2 pressable">
            <span><Upload className="h-4 w-4" /> Upload File</span>
          </Button>
          <input type="file" className="sr-only" onChange={handleFileInput} disabled={uploading} />
        </label>
      </div>

      {uploading && (
        <div className="mb-4 fade-in">
          <p className="text-sm text-muted-foreground mb-1">Uploading…</p>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      <div className="flex gap-3 mb-4 fade-in stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center fade-in stagger-3">
          <label className="cursor-pointer flex flex-col items-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4 hover:bg-muted/70 transition-colors">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No files yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Drag & drop files here or click to upload</p>
            <input type="file" className="sr-only" onChange={handleFileInput} disabled={uploading} />
          </label>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden fade-in stagger-3">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden sm:table-cell">Size</TableHead>
                <TableHead className="hidden md:table-cell">Uploaded</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((file) => (
                <TableRow
                  key={file.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedFile(file)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {fileIcon(file.mime_type)}
                      <span className="text-sm font-medium truncate max-w-[180px]">{file.name}</span>
                      {file.version > 1 && <Badge variant="secondary" className="text-xs">v{file.version}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{file.mime_type ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{file.size_bytes ? formatBytes(file.size_bytes) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{formatDate(file.created_at)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 pressable">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedFile(file)}>
                          <MessageSquare className="h-3.5 w-3.5 mr-2" /> Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                          <Download className="h-3.5 w-3.5 mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(file)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FileDetailPanel
        file={selectedFile}
        workspaceId={workspaceId}
        open={selectedFile !== null}
        onClose={() => setSelectedFile(null)}
      />
    </div>
  );
}
