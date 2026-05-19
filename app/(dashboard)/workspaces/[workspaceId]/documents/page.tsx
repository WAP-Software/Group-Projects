import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Document } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus } from "lucide-react";
import { DocumentCreateButton } from "@/components/documents/DocumentCreateButton";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function DocumentsPage({ params }: Props) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const { data: rawDocs } = await supabase
    .from("documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  const docs = rawDocs as Array<Document & { author?: { full_name: string | null } }> | null;

  return (
    <div className="p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6 fade-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Collaboratively edit with real-time sync</p>
        </div>
        <DocumentCreateButton workspaceId={workspaceId} />
      </div>

      {!docs?.length ? (
        <div className="flex flex-col items-center py-20 text-center fade-in stagger-2">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No documents yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Create your first collaborative document.</p>
          <DocumentCreateButton workspaceId={workspaceId} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 fade-in stagger-2">
          {docs.map((doc, i) => (
            <Link key={doc.id} href={`/workspaces/${workspaceId}/documents/${doc.id}`}>
              <Card className={`border-border/50 hover:shadow-md pressable h-full stagger-${Math.min(i+1,5)}`}>
                <CardContent className="p-4">
                  <FileText className="h-8 w-8 text-blue-500 mb-3" />
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2">{doc.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    by {(doc.author as any)?.full_name ?? "Unknown"} · {formatDate(doc.updated_at)}
                  </p>
                  <Badge
                    variant="secondary"
                    className={`text-xs capitalize ${
                      doc.status === "approved"
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : doc.status === "in_review"
                        ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950"
                        : ""
                    }`}
                  >
                    {doc.status.replace("_", " ")}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
