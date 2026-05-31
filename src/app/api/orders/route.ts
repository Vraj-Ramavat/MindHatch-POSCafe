import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";
import { serializeOrder } from "@/lib/serializers";

const editorRoles = ["ADMIN", "MANAGER", "CASHIER"] as const;
const orderInclude = {
  items: true,
  table: true,
  responsible: true,
  session: true,
} as const;

export async function GET() {
  const orders = await prisma.order.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: {
      items: true,
      table: true,
      responsible: true,
      session: true,
    },
  });

  return Response.json({ orders: orders.map(serializeOrder) });
}

export async function POST(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const session = authResult;
  const body = (await request.json()) as {
    sessionId?: string;
    tableId?: string | null;
    source?: "MANUAL" | "SELF";
    customerToken?: string | null;
    upiId?: string | null;
    items?: Array<{
      productId: string;
      quantity: number;
      name: string;
      unitPrice: number;
    }>;
    paymentMethod?: "CASH" | "CARD" | "UPI";
    qrPayload?: string | null;
  };

  if (!body.sessionId || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "Session and at least one item are required." }, { status: 400 });
  }

  const currentSession = await prisma.terminalSession.findUnique({ where: { id: body.sessionId } });

  if (!currentSession || currentSession.status !== "OPEN") {
    return Response.json({ error: "An open session is required to create orders." }, { status: 400 });
  }

  const total = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (body.tableId) {
    const existingOpenOrder = await prisma.order.findFirst({
      where: {
        sessionId: body.sessionId,
        tableId: body.tableId,
        paymentStatus: { not: "PAID" },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    if (existingOpenOrder) {
      const mergedOrder = await prisma.order.update({
        where: { id: existingOpenOrder.id },
        data: {
          total: { increment: new Prisma.Decimal(total) },
          paymentMethod: null,
          paymentStatus: "PENDING",
          qrPayload: null,
          qrConfirmed: false,
          items: {
            create: body.items.map((item) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              kitchenStage: "TO_COOK",
            })),
          },
        },
        include: orderInclude,
      });

      return Response.json({ order: serializeOrder(mergedOrder) }, { status: 200 });
    }
  }

  const orderNumber = `#${Date.now().toString().slice(-6)}`;

  const createdOrder = await prisma.order.create({
    data: {
      orderNumber,
      sessionId: body.sessionId,
      tableId: body.tableId ?? null,
      responsibleId: session.user.id,
      source: body.source ?? "MANUAL",
      customerToken: body.customerToken ?? null,
      upiId: body.upiId ?? null,
      qrPayload: body.qrPayload ?? null,
      paymentMethod: body.paymentMethod ?? null,
      paymentStatus: body.paymentMethod === "UPI" ? "PENDING" : body.paymentMethod ? "PAID" : "PENDING",
      total: new Prisma.Decimal(total),
      items: {
        create: body.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          kitchenStage: "TO_COOK",
        })),
      },
    },
    include: orderInclude,
  });

  return Response.json({ order: serializeOrder(createdOrder) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    orderId?: string;
    stage?: "TO_COOK" | "PREPARING" | "COMPLETED";
    paymentMethod?: "CASH" | "CARD" | "UPI";
    paymentStatus?: "PENDING" | "PAID";
    qrConfirmed?: boolean;
    itemPreparedId?: string;
    itemIds?: string[];
  };

  if (!body.orderId) {
    return Response.json({ error: "Order id is required." }, { status: 400 });
  }

  if (body.itemPreparedId) {
    const updatedItem = await prisma.orderItem.update({
      where: { id: body.itemPreparedId },
      data: { prepared: true, kitchenStage: "COMPLETED" },
    });

    return Response.json({ item: updatedItem });
  }

  if (Array.isArray(body.itemIds) && body.itemIds.length > 0 && body.stage) {
    const movingBackward = body.stage === "TO_COOK" || body.stage === "PREPARING";

    await prisma.orderItem.updateMany({
      where: { id: { in: body.itemIds } },
      data: {
        kitchenStage: body.stage,
        ...(body.stage === "COMPLETED" ? { prepared: true } : {}),
        ...(movingBackward ? { prepared: false } : {}),
      },
    });
  }

  const updatedOrder = await prisma.order.update({
    where: { id: body.orderId },
    data: {
      ...(body.stage ? { stage: body.stage } : {}),
      ...(body.paymentMethod ? { paymentMethod: body.paymentMethod } : {}),
      ...(body.paymentStatus ? { paymentStatus: body.paymentStatus } : {}),
      ...(typeof body.qrConfirmed === "boolean" ? { qrConfirmed: body.qrConfirmed } : {}),
    },
  });

  if (body.stage === "COMPLETED") {
    await prisma.orderItem.updateMany({
      where: { orderId: updatedOrder.id },
      data: { prepared: true, kitchenStage: "COMPLETED" },
    });
  }

  if (body.stage === "PREPARING") {
    await prisma.orderItem.updateMany({
      where: { orderId: updatedOrder.id, kitchenStage: "TO_COOK" },
      data: { kitchenStage: "PREPARING" },
    });
  }

  const refreshedOrder = await prisma.order.findUnique({
    where: { id: updatedOrder.id },
    include: orderInclude,
  });

  if (!refreshedOrder) {
    return Response.json({ error: "Unable to load updated order." }, { status: 500 });
  }

  return Response.json({ order: serializeOrder(refreshedOrder) });
}