import type { Role } from "@/generated/prisma/client";

const toNumber = (value: { toNumber?: () => number } | number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value.toNumber ? value.toNumber() : Number(value);
};

type ProductShape = {
  id: string;
  name: string;
  categoryId: string;
  category?: { name?: string | null } | null;
  price: { toNumber?: () => number } | number | string;
  unit: string;
  tax: { toNumber?: () => number } | number | string | null;
  description: string | null;
  isKitchenItem: boolean;
  active: boolean;
  variants?: Array<{
    id: string;
    attribute: string;
    value: string;
    extraPrice: { toNumber?: () => number } | number | string;
  }>;
};

type ProductVariantShape = NonNullable<ProductShape["variants"]>[number];

type TableShape = {
  id: string;
  floorId: string;
  floor?: { name?: string | null } | null;
  tableNumber: string;
  seats: number;
  active: boolean;
  appointmentResource: string | null;
  status: string;
};

type SessionShape = {
  id: string;
  terminalName: string;
  status: string;
  openingSaleAmount: { toNumber?: () => number } | number | string;
  closingSaleAmount: { toNumber?: () => number } | number | string;
  openedAt: Date;
  closedAt: Date | null;
  openedBy?: { id: string; name: string; role: Role } | null;
};

type OrderShape = {
  id: string;
  orderNumber: string;
  source: string;
  stage: string;
  paymentMethod: string | null;
  paymentStatus: string;
  total: { toNumber?: () => number } | number | string;
  tableId: string | null;
  table?: { tableNumber?: string | null } | null;
  sessionId: string;
  session?: { id: string; terminalName: string } | null;
  responsibleId: string | null;
  responsible?: { id: string; name: string; role: Role } | null;
  customerToken: string | null;
  upiId: string | null;
  qrPayload: string | null;
  qrConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
  items?: Array<{
    id: string;
    productId: string | null;
    name: string;
    quantity: number;
    unitPrice: { toNumber?: () => number } | number | string;
    kitchenStage: string;
    prepared: boolean;
  }>;
};

type OrderItemShape = NonNullable<OrderShape["items"]>[number];

export function serializeProduct(product: ProductShape) {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    categoryName: product.category?.name ?? "",
    price: toNumber(product.price),
    unit: product.unit,
    tax: product.tax === null ? null : toNumber(product.tax),
    description: product.description,
    isKitchenItem: product.isKitchenItem,
    active: product.active,
    variants: (product.variants ?? []).map((variant: ProductVariantShape) => ({
      id: variant.id,
      attribute: variant.attribute,
      value: variant.value,
      extraPrice: toNumber(variant.extraPrice),
    })),
  };
}

export function serializeTable(table: TableShape) {
  return {
    id: table.id,
    floorId: table.floorId,
    floorName: table.floor?.name ?? "",
    tableNumber: table.tableNumber,
    seats: table.seats,
    active: table.active,
    appointmentResource: table.appointmentResource,
    status: table.status,
  };
}

export function serializeSession(session: SessionShape) {
  return {
    id: session.id,
    terminalName: session.terminalName,
    status: session.status,
    openingSaleAmount: toNumber(session.openingSaleAmount),
    closingSaleAmount: toNumber(session.closingSaleAmount),
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    openedBy: session.openedBy
      ? {
          id: session.openedBy.id,
          name: session.openedBy.name,
          role: session.openedBy.role as Role,
        }
      : null,
  };
}

export function serializeOrder(order: OrderShape) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    source: order.source,
    stage: order.stage,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: toNumber(order.total),
    tableId: order.tableId,
    tableNumber: order.table?.tableNumber ?? null,
    sessionId: order.sessionId,
    sessionName: order.session?.terminalName ?? null,
    responsibleId: order.responsibleId,
    responsibleName: order.responsible?.name ?? null,
    responsibleRole: order.responsible?.role ?? null,
    customerToken: order.customerToken,
    upiId: order.upiId,
    qrPayload: order.qrPayload,
    qrConfirmed: order.qrConfirmed,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (order.items ?? []).map((item: OrderItemShape) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      kitchenStage: item.kitchenStage,
      prepared: item.prepared,
    })),
  };
}