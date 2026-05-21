import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diff = now.getTime() - target.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function generateCursorColor(userId: string): string {
  const colors = [
    "#f87171", "#fb923c", "#fbbf24", "#a3e635",
    "#34d399", "#22d3ee", "#60a5fa", "#a78bfa",
    "#f472b6", "#e879f9",
  ];
  const index = userId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function priorityColor(_priority: string): string {
  return "text-foreground bg-muted";
}

export function mimeLabel(mime: string | null): string {
  if (!mime) return "File";
  const known: Record<string, string> = {
    "text/uri-list": "Link",
    "application/pdf": "PDF",
    "text/plain": "TXT",
    "text/csv": "CSV",
    "application/json": "JSON",
    "application/zip": "ZIP",
    "vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "vnd.ms-excel": "XLS",
    "vnd.ms-powerpoint": "PPT",
  };
  if (known[mime]) return known[mime];
  const sub = mime.split("/")[1] ?? mime;
  if (known[sub]) return known[sub];
  const type = mime.split("/")[0];
  if (type === "image") return sub.toUpperCase().slice(0, 5);
  return sub.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "File";
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    backlog: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
    in_progress: "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300",
    review: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-300",
    done: "text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-300",
  };
  return map[status] ?? map.backlog;
}
