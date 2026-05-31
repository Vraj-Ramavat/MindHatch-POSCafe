import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";

const editorRoles = ["ADMIN", "MANAGER", "CASHIER"] as const;

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }

  return { keyId, keySecret };
}

function createCheckoutToken(secret: string, orderId: string, razorpayOrderId: string, amount: number, paymentMethod: string) {
  return crypto.createHmac("sha256", secret).update(`${orderId}:${razorpayOrderId}:${amount}:${paymentMethod}`).digest("hex");
}

export async function POST(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { keyId, keySecret } = getRazorpayCredentials();
    const body = (await request.json()) as {
      orderId?: string;
      paymentMethod?: "CARD" | "UPI";
    };

    if (!body.orderId || !body.paymentMethod) {
      return Response.json({ error: "Order id and payment method are required." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: { table: true },
    });

    if (!order) {
      return Response.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return Response.json({ error: "This order is already paid." }, { status: 400 });
    }

    const amount = Math.round(Number(order.total) * 100);

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt: order.orderNumber,
        payment_capture: 1,
        notes: {
          orderId: order.id,
          tableNumber: order.table?.tableNumber ?? "",
          paymentMethod: body.paymentMethod,
        },
      }),
    });

    if (!razorpayResponse.ok) {
      return Response.json({ error: "Unable to create Razorpay order." }, { status: 502 });
    }

    const razorpayOrder = (await razorpayResponse.json()) as {
      id: string;
      amount: number;
      currency: string;
    };

    const checkoutToken = createCheckoutToken(keySecret, order.id, razorpayOrder.id, order.total.toNumber(), body.paymentMethod);

    return Response.json({
      keyId,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      orderNumber: order.orderNumber,
      checkoutToken,
      paymentMethod: body.paymentMethod,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to prepare Razorpay checkout." },
      { status: 500 },
    );
  }
}