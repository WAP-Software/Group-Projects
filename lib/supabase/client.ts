import { createBrowserClient } from "@supabase/ssr";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ReturnType<typeof createBrowserClient<any>> | null = null;

export function createClient() {
  if (_client) return _client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _client = createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return _client;
}
