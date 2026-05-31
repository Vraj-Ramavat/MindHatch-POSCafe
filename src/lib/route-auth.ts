import { safeAuth } from "@/auth";
import type { Role } from "@/generated/prisma/client";

export async function requireAuth(allowedRoles?: Role[]) {
  const session = await safeAuth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return session;
}