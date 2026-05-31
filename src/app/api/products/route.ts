import { Prisma } from "@/generated/prisma/client";
import { ensureDemoData } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";
import { serializeProduct } from "@/lib/serializers";

const editorRoles = ["ADMIN", "MANAGER"] as const;

export async function GET() {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  await ensureDemoData();

  const products = await prisma.product.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      category: true,
      variants: true,
    },
  });

  return Response.json({ products: products.map(serializeProduct) });
}

export async function POST(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    name?: string;
    categoryId?: string;
    price?: number;
    unit?: string;
    tax?: number;
    description?: string;
    isKitchenItem?: boolean;
    active?: boolean;
  };

  if (!body.name || !body.categoryId || typeof body.price !== "number" || !body.unit) {
    return Response.json({ error: "Name, category, price, and unit are required." }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      name: body.name,
      categoryId: body.categoryId,
      price: new Prisma.Decimal(body.price),
      unit: body.unit,
      tax: body.tax === undefined ? null : new Prisma.Decimal(body.tax),
      description: body.description,
      isKitchenItem: body.isKitchenItem ?? true,
      active: body.active ?? true,
    },
    include: { category: true, variants: true },
  });

  return Response.json({ product: serializeProduct(product) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    productId?: string;
    name?: string;
    categoryId?: string;
    price?: number;
    unit?: string;
    tax?: number | null;
    description?: string | null;
    isKitchenItem?: boolean;
    active?: boolean;
  };

  if (!body.productId || !body.name || !body.categoryId || typeof body.price !== "number" || !body.unit) {
    return Response.json({ error: "Product id, name, category, price, and unit are required." }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id: body.productId },
    data: {
      name: body.name,
      categoryId: body.categoryId,
      price: new Prisma.Decimal(body.price),
      unit: body.unit,
      tax: body.tax === undefined || body.tax === null ? null : new Prisma.Decimal(body.tax),
      description: body.description,
      isKitchenItem: body.isKitchenItem ?? true,
      active: body.active ?? true,
    },
    include: { category: true, variants: true },
  });

  return Response.json({ product: serializeProduct(product) });
}

export async function DELETE(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    productId?: string;
  };

  if (!body.productId) {
    return Response.json({ error: "Product id is required." }, { status: 400 });
  }

  await prisma.product.delete({
    where: { id: body.productId },
  });

  return Response.json({ success: true });
}