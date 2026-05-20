const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL!;

export async function uploadToR2(
  file: File,
  workspaceId: string,
  userId: string,
  token: string,
): Promise<{ key: string; url: string }> {
  const timestamp = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const key = `${userId}/${timestamp}_${safeFilename}`;

  const response = await fetch(`${CF_WORKER_URL}/upload/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      Authorization: `Bearer ${token}`,
      "X-Workspace-Id": workspaceId,
    },
    body: file,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload failed: ${err}`);
  }

  const r2Key = `${workspaceId}/${key}`;
  return {
    key: r2Key,
    url: `${CF_WORKER_URL}/files/${encodeURIComponent(r2Key)}`,
  };
}

export function getFileUrl(r2Key: string): string {
  return `${CF_WORKER_URL}/files/${encodeURIComponent(r2Key)}`;
}

export async function downloadFile(r2Key: string, filename: string, token?: string): Promise<void> {
  const url = getFileUrl(r2Key);
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function deleteFromR2(r2Key: string, token: string): Promise<void> {
  const response = await fetch(
    `${CF_WORKER_URL}/files/${encodeURIComponent(r2Key)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) {
    throw new Error("Delete failed");
  }
}
