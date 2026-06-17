// Server-only Supabase client using the SERVICE ROLE key. This key bypasses
// Row Level Security entirely, which is required because the server is the
// only party allowed to read/write hole_cards across players (e.g. to deal
// cards, validate showdown, and copy revealed_cards). This module must
// NEVER be imported from a "use client" file or from anything bundled to
// the browser - only from app/api/**/route.ts handlers.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export function getServiceRoleClient() {
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This must be configured as a server-only env var."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
