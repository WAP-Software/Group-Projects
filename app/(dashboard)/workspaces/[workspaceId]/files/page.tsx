import { FileVault } from "@/components/files/FileVault";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function FilesPage({ params }: Props) {
  const { workspaceId } = await params;
  return <FileVault workspaceId={workspaceId} />;
}
