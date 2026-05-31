import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const allowedRoles = new Set([Role.ADMIN, Role.MANAGER, Role.CASHIER, Role.KITCHEN]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const role = allowedRoles.has((body.role ?? Role.CASHIER) as Role) ? ((body.role as Role) ?? Role.CASHIER) : Role.CASHIER;

    if (!name || !email || password.length < 8) {
      return Response.json(
        { error: "Name, email, and an 8+ character password are required." },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return Response.json({ error: "A user with that email already exists." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create user." },
      { status: 500 },
    );
  }
}