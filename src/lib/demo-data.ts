import bcrypt from "bcryptjs";
import { Prisma, Role, TableStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const demoAdminEmail = "admin@mindhatch.local";
const demoAdminPassword = "admin1234";

export async function ensureDemoAuthUser() {
  try {
    const existingUser = await prisma.user.findUnique({ where: { email: demoAdminEmail } });

    if (existingUser) {
      return existingUser;
    }

    const passwordHash = await bcrypt.hash(demoAdminPassword, 12);

    return prisma.user.create({
      data: {
        name: "MindHatch Admin",
        email: demoAdminEmail,
        passwordHash,
        role: Role.ADMIN,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return null;
    }

    throw error;
  }
}

export async function ensureDemoData() {
  const productCount = await prisma.product.count();
  const tableCount = await prisma.table.count();

  if (productCount > 0 && tableCount > 0) {
    return;
  }

  const foodCategory =
    (await prisma.category.findFirst({ where: { name: "Food" } })) ??
    (await prisma.category.create({ data: { name: "Food" } }));

  const drinksCategory =
    (await prisma.category.findFirst({ where: { name: "Drinks" } })) ??
    (await prisma.category.create({ data: { name: "Drinks" } }));

  const items = [
    {
      name: "Margherita Pizza",
      categoryId: foodCategory.id,
      price: new Prisma.Decimal(180),
      unit: "plate",
      tax: new Prisma.Decimal(5),
      description: "Classic cheese pizza with tomato base and basil.",
      isKitchenItem: true,
      variants: [
        { attribute: "Pack", value: "6", extraPrice: new Prisma.Decimal(0) },
        { attribute: "Pack", value: "12", extraPrice: new Prisma.Decimal(120) },
      ],
    },
    {
      name: "Veg Burger",
      categoryId: foodCategory.id,
      price: new Prisma.Decimal(125),
      unit: "piece",
      tax: new Prisma.Decimal(5),
      description: "Grilled veg patty with house sauce and lettuce.",
      isKitchenItem: true,
      variants: [],
    },
    {
      name: "Cold Coffee",
      categoryId: drinksCategory.id,
      price: new Prisma.Decimal(95),
      unit: "glass",
      tax: new Prisma.Decimal(5),
      description: "Chilled coffee with cream and ice.",
      isKitchenItem: false,
      variants: [],
    },
    {
      name: "Water Bottle",
      categoryId: drinksCategory.id,
      price: new Prisma.Decimal(20),
      unit: "bottle",
      tax: new Prisma.Decimal(0),
      description: "Packaged water for quick service.",
      isKitchenItem: false,
      variants: [],
    },
  ];

  for (const item of items) {
    const existingProduct = await prisma.product.findFirst({ where: { name: item.name } });

    if (!existingProduct) {
      await prisma.product.create({
        data: {
          name: item.name,
          categoryId: item.categoryId,
          price: item.price,
          unit: item.unit,
          tax: item.tax,
          description: item.description,
          isKitchenItem: item.isKitchenItem,
          variants: {
            create: item.variants,
          },
        },
      });
    }
  }

  const floor = (await prisma.floor.findFirst({ where: { name: "Ground Floor" } })) ??
    (await prisma.floor.create({ data: { name: "Ground Floor" } }));

  if (tableCount === 0) {
    await prisma.table.createMany({
      data: [
        { floorId: floor.id, tableNumber: "Table 3", seats: 2, status: TableStatus.AVAILABLE },
        { floorId: floor.id, tableNumber: "Table 6", seats: 4, status: TableStatus.AVAILABLE },
        { floorId: floor.id, tableNumber: "Table 8", seats: 4, status: TableStatus.RESERVED },
        { floorId: floor.id, tableNumber: "Table 12", seats: 6, status: TableStatus.OCCUPIED },
      ],
    });
  }
}