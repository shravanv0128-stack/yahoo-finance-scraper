// Browser-side Supabase client, using only the public anon key. Safe to
// import from client components. RLS policies (see supabase/schema.sql)
// enforce that this client can never read other players' hole_cards.
"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// The app has no signup/login flow (it's a private, link-shared game), so
// every browser gets an anonymous Supabase auth session on first load.
// Requires "Anonymous sign-ins" enabled in Supabase (Authentication ->
// Sign In / Providers). The resulting session's access token is what
// satisfies getUserFromRequest() in src/lib/auth.ts on the API side.
export async function ensureSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signInData.session;
}
