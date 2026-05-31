import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";

const editorRoles = ["ADMIN", "MANAGER"] as const;

export async function GET() {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ name: "asc" }],
  });

  return Response.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
    })),
  });
}

export async function POST(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    name?: string;
  };

  const name = body.name?.trim();

  if (!name) {
    return Response.json({ error: "Category name is required." }, { status: 400 });
  }

  const existingCategory = await prisma.category.findFirst({
    where: { name },
  });

  if (existingCategory) {
    return Response.json({ error: "That category already exists." }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: { name },
  });

  return Response.json(
    {
      category: {
        id: category.id,
        name: category.name,
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    categoryId?: string;
    name?: string;
  };

  const name = body.name?.trim();

  if (!body.categoryId || !name) {
    return Response.json({ error: "Category id and name are required." }, { status: 400 });
  }

  const category = await prisma.category.update({
    where: { id: body.categoryId },
    data: { name },
  });

  return Response.json({
    category: {
      id: category.id,
      name: category.name,
    },
  });
}

export async function DELETE(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    categoryId?: string;
  };

  if (!body.categoryId) {
    return Response.json({ error: "Category id is required." }, { status: 400 });
  }

  await prisma.category.delete({
    where: { id: body.categoryId },
  });

  return Response.json({ success: true });
}