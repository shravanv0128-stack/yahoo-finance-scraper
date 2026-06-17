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

// Players sign in with Google (no separate signup flow). The resulting
// session's access token is what satisfies getUserFromRequest() in
// src/lib/auth.ts on the API side, so callers must check for a session
// before hitting any /api/** route and prompt sign-in if there isn't one.
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
