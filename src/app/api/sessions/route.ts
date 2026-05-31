import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";
import { serializeSession } from "@/lib/serializers";

const editorRoles = ["ADMIN", "MANAGER", "CASHIER"] as const;

export async function GET() {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  const sessions = await prisma.terminalSession.findMany({
    orderBy: [{ openedAt: "desc" }],
    include: { openedBy: true },
    take: 10,
  });

  const openSession = sessions.find((session) => session.status === "OPEN") ?? null;

  return Response.json({
    sessions: sessions.map(serializeSession),
    openSession: openSession ? serializeSession(openSession) : null,
  });
}

export async function POST(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const session = authResult;
  const body = (await request.json().catch(() => ({}))) as {
    terminalName?: string;
  };

  const openSession = await prisma.terminalSession.create({
    data: {
      terminalName: body.terminalName?.trim() || "Main POS Terminal",
      openedById: session.user.id,
    },
    include: { openedBy: true },
  });

  return Response.json({ session: serializeSession(openSession) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const session = authResult;
  const body = (await request.json()) as {
    sessionId?: string;
  };

  const targetSession =
    (body.sessionId
      ? await prisma.terminalSession.findUnique({ where: { id: body.sessionId }, include: { openedBy: true } })
      : await prisma.terminalSession.findFirst({
          where: { status: "OPEN" },
          orderBy: { openedAt: "desc" },
          include: { openedBy: true },
        })) ?? null;

  if (!targetSession) {
    return Response.json({ error: "No open session found." }, { status: 404 });
  }

  const closingSaleAmount = await prisma.order.aggregate({
    where: { sessionId: targetSession.id, paymentStatus: "PAID" },
    _sum: { total: true },
  });

  const closedSession = await prisma.terminalSession.update({
    where: { id: targetSession.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: session.user.id,
      closingSaleAmount: closingSaleAmount._sum.total ?? 0,
    },
    include: { openedBy: true },
  });

  return Response.json({ session: serializeSession(closedSession) });
}