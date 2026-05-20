import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function CalendarPage({ params }: Props) {
  const { workspaceId } = await params;
  redirect(`/workspaces/${workspaceId}/timeline`);
}
