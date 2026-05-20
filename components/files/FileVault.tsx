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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload, Search, MoreHorizontal, Download, Trash2,
  FileText, ImageIcon, File, FolderOpen, CloudUpload, MessageSquare,
  Pin, PinOff, Archive, Link2, ChevronRight, Home, Tag, X, FolderPlus,
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

const FOLDERS = ["/", "/Literature", "/Data", "/Presentations", "/Submissions"];

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
  const [currentFolder, setCurrentFolder] = useState("/");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [externalLinkOpen, setExternalLinkOpen] = useState(false);
  const [extName, setExtName] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [zipping, setZipping] = useState(false);
  const dragCounter = useRef(0);

  const loadFiles = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from("files")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("is_pinned", { ascending: false })
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

  async function postUploadNotification(fileName: string) {
    const { data: channel } = await supabase
      .from("channels")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("is_default", true)
      .single();
    if (!channel) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("messages").insert({
      channel_id: channel.id,
      user_id: user.id,
      content: `📎 New file uploaded: **${fileName}**`,
    });
  }

  async function doUpload(file: File, folderOverride?: string) {
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
        folder_path: folderOverride ?? currentFolder,
        uploaded_by: user.id,
        is_pinned: false,
      });
      setUploadProgress(100);
      toast.success("File uploaded!");
      await postUploadNotification(file.name);
      loadFiles();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function addExternalLink() {
    if (!extName.trim() || !extUrl.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const url = extUrl.startsWith("http") ? extUrl : `https://${extUrl}`;
    await supabase.from("files").insert({
      workspace_id: workspaceId,
      name: extName.trim(),
      original_name: extName.trim(),
      mime_type: "text/uri-list",
      size_bytes: 0,
      r2_key: "",
      folder_path: currentFolder,
      uploaded_by: user.id,
      external_url: url,
      is_pinned: false,
    });
    toast.success("Link added");
    setExtName("");
    setExtUrl("");
    setExternalLinkOpen(false);
    loadFiles();
  }

  async function togglePin(file: FileRecord, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from("files").update({ is_pinned: !file.is_pinned }).eq("id", file.id);
    loadFiles(true);
  }

  async function handleDownload(file: FileRecord) {
    if (file.external_url) {
      window.open(file.external_url, "_blank");
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await downloadFile(file.r2_key, file.original_name, session?.access_token);
    } catch {
      toast.error("Download failed");
    }
  }

  async function handleUpdateVersion(existingFile: FileRecord, newFile: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    try {
      const { key } = await uploadToR2(newFile, workspaceId, user.id, token);
      const { data: allVersions } = await supabase
        .from("files").select("id, r2_key, version")
        .eq("workspace_id", workspaceId)
        .eq("original_name", existingFile.original_name)
        .order("version", { ascending: true });
      const newVersion = ((allVersions ?? []).at(-1)?.version ?? existingFile.version) + 1;
      await supabase.from("files").insert({
        workspace_id: workspaceId,
        name: existingFile.name,
        original_name: existingFile.original_name,
        mime_type: newFile.type || existingFile.mime_type,
        size_bytes: newFile.size,
        r2_key: key,
        folder_path: existingFile.folder_path,
        uploaded_by: user.id,
        version: newVersion,
        parent_version_id: existingFile.id,
        tags: existingFile.tags,
        is_pinned: existingFile.is_pinned,
      });
      // Enforce max 3 versions
      if (allVersions && allVersions.length >= 3) {
        const toDelete = allVersions.slice(0, allVersions.length - 2);
        for (const v of toDelete) {
          if (v.r2_key) await deleteFromR2(v.r2_key, token).catch(() => {});
          await supabase.from("files").delete().eq("id", v.id);
        }
      }
      toast.success(`Version ${newVersion} uploaded`);
      loadFiles(true);
    } catch {
      toast.error("Update failed");
    }
  }

  async function handleDelete(file: FileRecord) {
    if (!confirm(`Delete "${file.name}"?`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && file.r2_key) {
      await deleteFromR2(file.r2_key, session.access_token).catch(() => {});
    }
    await supabase.from("files").delete().eq("id", file.id);
    toast.success("File deleted");
    loadFiles();
  }

  async function handleZipExport() {
    const JSZip = (await import("jszip")).default;
    const targets = filtered;
    if (targets.length === 0) { toast.error("No files to export"); return; }
    setZipping(true);
    try {
      const zip = new JSZip();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      await Promise.all(
        targets
          .filter((f) => f.r2_key && !f.external_url)
          .map(async (f) => {
            const url = `${process.env.NEXT_PUBLIC_CF_WORKER_URL}/files/${encodeURIComponent(f.r2_key)}`;
            const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
            if (res.ok) zip.file(f.name, await res.blob());
          })
      );
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "files.zip";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("ZIP created");
    } catch {
      toast.error("ZIP export failed");
    } finally {
      setZipping(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = "";
  }

  function onDragEnter(e: React.DragEvent) { e.preventDefault(); dragCounter.current++; setDragging(true); }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await doUpload(file);
  }

  // Derived state
  const allTags = Array.from(new Set(files.flatMap((f) => f.tags ?? [])));
  const filtered = files.filter((f) => {
    if (currentFolder !== "/" && f.folder_path !== currentFolder) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (activeTag && !(f.tags ?? []).includes(activeTag)) return false;
    return true;
  });
  const pinned = filtered.filter((f) => f.is_pinned);
  const unpinned = filtered.filter((f) => !f.is_pinned);

  return (
    <div
      className="p-6 max-w-7xl mx-auto w-full relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="absolute inset-4 z-50 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-primary/5 pointer-events-none">
          <CloudUpload className="h-10 w-10 text-primary" />
          <p className="text-primary font-semibold text-lg">Drop file to upload</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-sm text-muted-foreground mt-1">Click a file for details — drag & drop to upload</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setExternalLinkOpen(true)}>
            <Link2 className="h-4 w-4" /> Link
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleZipExport} disabled={zipping}>
            <Archive className="h-4 w-4" /> {zipping ? "Creating…" : "ZIP"}
          </Button>
          <label className="cursor-pointer">
            <Button asChild className="gap-2 pressable" size="sm">
              <span><Upload className="h-4 w-4" /> Upload</span>
            </Button>
            <input type="file" className="sr-only" onChange={handleFileInput} disabled={uploading} />
          </label>
        </div>
      </div>

      {uploading && (
        <div className="mb-4 fade-in">
          <p className="text-sm text-muted-foreground mb-1">Uploading…</p>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* Folder breadcrumb */}
      <div className="flex items-center gap-1 mb-3 text-sm fade-in stagger-1 overflow-x-auto pb-0.5">
        <button
          onClick={() => setCurrentFolder("/")}
          className={cn("flex items-center gap-1 px-2 py-1 rounded-md transition-colors hover:bg-muted shrink-0", currentFolder === "/" && "bg-primary/10 text-primary")}
        >
          <Home className="h-3.5 w-3.5" /> All
        </button>
        {FOLDERS.filter((f) => f !== "/").map((folder) => (
          <button
            key={folder}
            onClick={() => setCurrentFolder(folder)}
            className={cn("flex items-center gap-1 px-2 py-1 rounded-md transition-colors hover:bg-muted text-muted-foreground shrink-0", currentFolder === folder && "bg-primary/10 text-primary font-medium")}
          >
            <ChevronRight className="h-3 w-3" />
            {folder.replace("/", "")}
          </button>
        ))}
      </div>

      {/* Search + Tag filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 fade-in stagger-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs border transition-colors",
                  activeTag === tag
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
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
            <p className="text-sm text-muted-foreground mb-4">Drag & drop or click to upload</p>
            <input type="file" className="sr-only" onChange={handleFileInput} disabled={uploading} />
          </label>
        </div>
      ) : (
        <div className="space-y-4 fade-in stagger-3">
          {pinned.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Pin className="h-3 w-3" /> Pinned
              </p>
              <FileTable
                files={pinned}
                onSelect={setSelectedFile}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onTogglePin={togglePin}
                onUpdateVersion={handleUpdateVersion}
              />
            </div>
          )}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Files</p>
              )}
              <FileTable
                files={unpinned}
                onSelect={setSelectedFile}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onTogglePin={togglePin}
                onUpdateVersion={handleUpdateVersion}
              />
            </div>
          )}
        </div>
      )}

      <FileDetailPanel
        file={selectedFile}
        workspaceId={workspaceId}
        open={selectedFile !== null}
        onClose={() => setSelectedFile(null)}
        onRefresh={() => loadFiles(true)}
      />

      {/* External link dialog */}
      <Dialog open={externalLinkOpen} onOpenChange={setExternalLinkOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add external link</DialogTitle>
            <DialogDescription>Link to Google Drive, OneDrive or any external resource.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Input placeholder="Name (e.g. Google Drive folder)" value={extName} onChange={(e) => setExtName(e.target.value)} />
            <Input placeholder="URL (e.g. https://drive.google.com/…)" value={extUrl} onChange={(e) => setExtUrl(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setExternalLinkOpen(false)}>Cancel</Button>
              <Button onClick={addExternalLink} disabled={!extName.trim() || !extUrl.trim()}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileTable({
  files,
  onSelect,
  onDownload,
  onDelete,
  onTogglePin,
  onUpdateVersion,
}: {
  files: FileRecord[];
  onSelect: (f: FileRecord) => void;
  onDownload: (f: FileRecord) => void;
  onDelete: (f: FileRecord) => void;
  onTogglePin: (f: FileRecord, e: React.MouseEvent) => void;
  onUpdateVersion: (f: FileRecord, newFile: File) => void;
}) {
  const updateRefs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <div className="rounded-xl border border-border overflow-hidden">
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
          {files.map((file) => (
            <TableRow
              key={file.id}
              className="hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => file.external_url ? window.open(file.external_url, "_blank") : onSelect(file)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  {file.external_url
                    ? <Link2 className="h-4 w-4 text-blue-500 shrink-0" />
                    : fileIcon(file.mime_type)}
                  <span className="text-sm font-medium truncate max-w-[180px]">{file.name}</span>
                  {file.version > 1 && <Badge variant="secondary" className="text-xs shrink-0">v{file.version}</Badge>}
                  {file.is_pinned && <Pin className="h-3 w-3 text-amber-500 shrink-0" />}
                  {(file.tags ?? []).slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs shrink-0">{tag}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                {file.external_url ? "Link" : (file.mime_type?.split("/")[1]?.toUpperCase() ?? "—")}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                {file.size_bytes ? formatBytes(file.size_bytes) : "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{formatDate(file.created_at)}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()} className="pr-2">
                <div className="flex items-center justify-end gap-1">
                  {!file.external_url && (
                    <label className="cursor-pointer" title="Upload new version">
                      <Button variant="ghost" size="icon" className="h-8 w-8 pressable text-muted-foreground hover:text-primary" asChild>
                        <span><Upload className="h-3.5 w-3.5" /></span>
                      </Button>
                      <input
                        type="file"
                        className="sr-only"
                        ref={(el) => { updateRefs.current[file.id] = el; }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUpdateVersion(file, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 pressable">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelect(file)}>
                        <MessageSquare className="h-3.5 w-3.5 mr-2" /> Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => onTogglePin(file, e)}>
                        {file.is_pinned
                          ? <><PinOff className="h-3.5 w-3.5 mr-2" /> Unpin</>
                          : <><Pin className="h-3.5 w-3.5 mr-2" /> Pin</>}
                      </DropdownMenuItem>
                      {!file.external_url && (
                        <DropdownMenuItem onClick={() => onDownload(file)}>
                          <Download className="h-3.5 w-3.5 mr-2" /> Download
                        </DropdownMenuItem>
                      )}
                      {file.external_url && (
                        <DropdownMenuItem onClick={() => window.open(file.external_url!, "_blank")}>
                          <Link2 className="h-3.5 w-3.5 mr-2" /> Open link
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(file)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
