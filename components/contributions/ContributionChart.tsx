"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type ComputedContribution = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  tasks_completed: number;
  tasks_created: number;
  files_uploaded: number;
  messages_sent: number;
};

const RANK = ["🥇", "🥈", "🥉"];

interface Props {
  contributions: ComputedContribution[];
}

export function ContributionChart({ contributions }: Props) {
  function score(c: ComputedContribution) {
    return c.tasks_completed * 3 + c.tasks_created + c.files_uploaded * 2 + Math.floor(c.messages_sent / 5);
  }

  const sorted = [...contributions].sort((a, b) => score(b) - score(a));

  const chartData = sorted.map((c) => ({
    name: (c.full_name ?? "User").split(" ")[0],
    "Tasks done": c.tasks_completed,
    "Tasks created": c.tasks_created,
    "Files": c.files_uploaded,
    "Messages": c.messages_sent,
  }));

  const isEmpty = contributions.every(
    (c) => c.tasks_completed === 0 && c.tasks_created === 0 && c.files_uploaded === 0 && c.messages_sent === 0,
  );

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((c, i) => (
          <Card key={c.user_id} className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(c.full_name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  {i < 3 && (
                    <span className="absolute -top-1 -right-1 text-sm leading-none">{RANK[i]}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.full_name ?? "Member"}</p>
                  <p className="text-xs text-muted-foreground">{score(c)} pts</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { label: "Done", value: c.tasks_completed, color: "text-green-600" },
                  { label: "Created", value: c.tasks_created, color: "text-blue-600" },
                  { label: "Files", value: c.files_uploaded, color: "text-violet-600" },
                  { label: "Msgs", value: c.messages_sent, color: "text-pink-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Activity Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No activity recorded yet — complete tasks, upload files, and chat to see stats.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="Tasks done" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Tasks created" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Files" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Messages" fill="#ec4899" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
