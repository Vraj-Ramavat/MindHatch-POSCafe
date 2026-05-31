import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";

const editorRoles = ["ADMIN", "MANAGER"] as const;

export async function GET() {
  const authResult = await requireAuth();

  if (authResult instanceof Response) {
    return authResult;
  }

  const floors = await prisma.floor.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      tables: {
        orderBy: [{ tableNumber: "asc" }],
      },
    },
  });

  return Response.json({
    floors: floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      tableCount: floor.tables.length,
      tables: floor.tables.map((table) => ({
        id: table.id,
        tableNumber: table.tableNumber,
        seats: table.seats,
        status: table.status,
      })),
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
    return Response.json({ error: "Floor name is required." }, { status: 400 });
  }

  const floor = await prisma.floor.create({
    data: {
      name,
    },
    include: {
      tables: true,
    },
  });

  return Response.json(
    {
      floor: {
        id: floor.id,
        name: floor.name,
        tableCount: floor.tables.length,
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
    floorId?: string;
    name?: string;
  };

  const name = body.name?.trim();

  if (!body.floorId || !name) {
    return Response.json({ error: "Floor id and name are required." }, { status: 400 });
  }

  const floor = await prisma.floor.update({
    where: { id: body.floorId },
    data: { name },
    include: {
      tables: true,
    },
  });

  return Response.json({
    floor: {
      id: floor.id,
      name: floor.name,
      tableCount: floor.tables.length,
    },
  });
}

export async function DELETE(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    floorId?: string;
  };

  if (!body.floorId) {
    return Response.json({ error: "Floor id is required." }, { status: 400 });
  }

  await prisma.floor.delete({
    where: { id: body.floorId },
  });

  return Response.json({ success: true });
}