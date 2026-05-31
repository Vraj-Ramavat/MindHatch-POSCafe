import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/route-auth";
import { serializeTable } from "@/lib/serializers";

const editorRoles = ["ADMIN", "MANAGER"] as const;

export async function GET() {
  const tables = await prisma.table.findMany({
    orderBy: [{ tableNumber: "asc" }],
    include: { floor: true },
  });

  return Response.json({ tables: tables.map(serializeTable) });
}

export async function POST(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    floorId?: string;
    tableNumber?: string;
    seats?: number;
    active?: boolean;
    appointmentResource?: string | null;
    status?: "AVAILABLE" | "OCCUPIED" | "RESERVED";
  };

  if (!body.floorId || !body.tableNumber || typeof body.seats !== "number") {
    return Response.json({ error: "Floor, table number, and seats are required." }, { status: 400 });
  }

  const table = await prisma.table.create({
    data: {
      floorId: body.floorId,
      tableNumber: body.tableNumber,
      seats: body.seats,
      active: body.active ?? true,
      appointmentResource: body.appointmentResource ?? null,
      status: body.status ?? "AVAILABLE",
    },
    include: { floor: true },
  });

  return Response.json({ table: serializeTable(table) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    tableId?: string;
    floorId?: string;
    tableNumber?: string;
    seats?: number;
    status?: "AVAILABLE" | "OCCUPIED" | "RESERVED";
    active?: boolean;
    appointmentResource?: string | null;
  };

  if (!body.tableId) {
    return Response.json({ error: "Table id is required." }, { status: 400 });
  }

  const table = await prisma.table.update({
    where: { id: body.tableId },
    data: {
      ...(body.floorId ? { floorId: body.floorId } : {}),
      ...(body.tableNumber ? { tableNumber: body.tableNumber } : {}),
      ...(typeof body.seats === "number" ? { seats: body.seats } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(body.appointmentResource !== undefined ? { appointmentResource: body.appointmentResource } : {}),
    },
    include: { floor: true },
  });

  return Response.json({ table: serializeTable(table) });
}

export async function DELETE(request: Request) {
  const authResult = await requireAuth([...editorRoles]);

  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as {
    tableId?: string;
  };

  if (!body.tableId) {
    return Response.json({ error: "Table id is required." }, { status: 400 });
  }

  await prisma.table.delete({
    where: { id: body.tableId },
  });

  return Response.json({ success: true });
}