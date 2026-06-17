// Helper to identify the calling user inside an API route handler.
// The client attaches the Supabase access token as a Bearer header; we
// verify it server-side using the service-role client (which can call
// `auth.getUser` for any token) rather than trusting any user-supplied id.
import { NextRequest } from "next/server";
import { getServiceRoleClient } from "./supabaseServer";

export interface AuthedUser {
  id: string;
  email?: string | null;
}

export async function getUserFromRequest(req: NextRequest): Promise<AuthedUser | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email };
}
