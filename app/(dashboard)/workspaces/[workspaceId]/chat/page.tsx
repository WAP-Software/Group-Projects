import { ChatPanel } from "@/components/chat/ChatPanel";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function ChatPage({ params }: Props) {
  const { workspaceId } = await params;
  return <ChatPanel workspaceId={workspaceId} />;
}
