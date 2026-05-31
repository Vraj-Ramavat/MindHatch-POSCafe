import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";
import { serializeOrder } from "@/lib/serializers";

const editorRoles = ["ADMIN", "MANAGER", "CASHIER"] as const;

function getRazorpaySecret() {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }

  return keySecret;
}

function createCheckoutToken(secret: string, orderId: string, razorpayOrderId: string, amount: number, paymentMethod: string) {
  return crypto.createHmac("sha256", secret).update(`${orderId}:${razorpayOrderId}:${amount}:${paymentMethod}`).digest("hex");
}

function verifySignature(secret: string, razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(razorpaySignature);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function POST(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const secret = getRazorpaySecret();
    const body = (await request.json()) as {
      orderId?: string;
      paymentMethod?: "CARD" | "UPI";
      checkoutToken?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    if (!body.orderId || !body.paymentMethod || !body.checkoutToken || !body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
      return Response.json({ error: "Missing Razorpay verification details." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: body.orderId }, include: { table: true, session: true, responsible: true, items: true } });

    if (!order) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    const expectedToken = createCheckoutToken(secret, order.id, body.razorpayOrderId, order.total.toNumber(), body.paymentMethod);

    if (expectedToken !== body.checkoutToken) {
      return Response.json({ error: "Checkout token mismatch." }, { status: 400 });
    }

    if (!verifySignature(secret, body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)) {
      return Response.json({ error: "Invalid Razorpay signature." }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: body.paymentMethod,
        paymentStatus: "PAID",
        qrConfirmed: body.paymentMethod === "UPI",
      },
      include: { table: true, session: true, responsible: true, items: true },
    });

    return Response.json({ order: serializeOrder(updatedOrder) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to verify Razorpay payment." },
      { status: 500 },
    );
  }
}