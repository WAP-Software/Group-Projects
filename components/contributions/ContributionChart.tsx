"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Contribution } from "@/types/database";

const COLORS = {
  tasks_completed: "#22c55e",
  tasks_created: "#3b82f6",
  documents_created: "#f59e0b",
  files_uploaded: "#8b5cf6",
  messages_sent: "#ec4899",
};

interface Props {
  contributions: Contribution[];
}

export function ContributionChart({ contributions }: Props) {
  const chartData = contributions.map((c) => ({
    name: c.full_name?.split(" ")[0] ?? "User",
    "Tasks done": c.tasks_completed,
    "Tasks created": c.tasks_created,
    "Documents": c.documents_created,
    "Files": c.files_uploaded,
    "Messages": c.messages_sent,
  }));

  const sorted = [...contributions].sort(
    (a, b) =>
      (b.tasks_completed + b.documents_created + b.files_uploaded) -
      (a.tasks_completed + a.documents_created + a.files_uploaded),
  );

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((c, i) => {
          const score = c.tasks_completed + c.documents_created * 2 + c.files_uploaded;
          return (
            <Card key={c.user_id} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={c.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getInitials(c.full_name ?? "?")}
                      </AvatarFallback>
                    </Avatar>
                    {i < 3 && (
                      <span className="absolute -top-1 -right-1 text-sm">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.full_name ?? "Member"}</p>
                    <p className="text-xs text-muted-foreground">{score} pts</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[
                    { label: "Tasks", value: c.tasks_completed, color: "text-green-600" },
                    { label: "Docs", value: c.documents_created, color: "text-amber-600" },
                    { label: "Files", value: c.files_uploaded, color: "text-violet-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bar chart */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Activity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="Tasks done" fill={COLORS.tasks_completed} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Documents" fill={COLORS.documents_created} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Messages" fill={COLORS.messages_sent} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
