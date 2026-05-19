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

export function priorityColor(priority: string): string {
  const map: Record<string, string> = {
    low: "text-slate-500 bg-slate-100 dark:bg-slate-800",
    medium: "text-blue-600 bg-blue-50 dark:bg-blue-950",
    high: "text-orange-600 bg-orange-50 dark:bg-orange-950",
    urgent: "text-red-600 bg-red-50 dark:bg-red-950",
  };
  return map[priority] ?? map.medium;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    backlog: "text-slate-600 bg-slate-100 dark:bg-slate-800",
    in_progress: "text-blue-600 bg-blue-50 dark:bg-blue-950",
    review: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950",
    done: "text-green-600 bg-green-50 dark:bg-green-950",
  };
  return map[status] ?? map.backlog;
}
