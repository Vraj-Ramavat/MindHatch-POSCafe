"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Product = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  unit: string;
  tax: number | null;
  description: string | null;
  isKitchenItem: boolean;
  active: boolean;
  variants: Array<{ id: string; attribute: string; value: string; extraPrice: number }>;
};

type Table = {
  id: string;
  floorName: string;
  tableNumber: string;
  seats: number;
  active: boolean;
  status: string;
};

type Session = {
  id: string;
  terminalName: string;
  status: string;
  closingSaleAmount: number;
  openedAt: string;
};

type Order = {
  id: string;
  orderNumber: string;
  stage: string;
  paymentMethod: string | null;
  paymentStatus: string;
  total: number;
  tableId: string | null;
  tableNumber: string | null;
  items: Array<{ id: string; name: string; quantity: number; unitPrice: number; prepared: boolean }>;
};

type CartLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  isKitchenItem: boolean;
};

type RazorpayPaymentMethod = "CARD" | "UPI";

type RazorpayCreateResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  checkoutToken: string;
  paymentMethod: RazorpayPaymentMethod;
};

type RazorpayVerifyResponse = {
  order: Order;
};

type RazorpayCheckoutHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  notes?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayCheckoutHandlerResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayInstance = {
  open: () => void;
  close?: () => void;
};

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const paymentMethods = [
  { id: "CASH", label: "Cash" },
  { id: "CARD", label: "Card / Bank (Razorpay)" },
  { id: "UPI", label: "UPI (Razorpay)" },
];

const emptySettings = {
  upiId: "123@ybl.com",
  cash: true,
  card: true,
  upi: true,
};

export default function TerminalPage() {
  const floorRef = useRef<HTMLElement | null>(null);
  const registerRef = useRef<HTMLElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [openSession, setOpenSession] = useState<Session | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const razorpayScriptRef = useRef<Promise<void> | null>(null);
  const [settings] = useState<typeof emptySettings>(() => {
    if (typeof window === "undefined") {
      return emptySettings;
    }

    try {
      const savedSettings = window.localStorage.getItem("mindhatch-pos-settings");
      return savedSettings ? { ...emptySettings, ...JSON.parse(savedSettings) } : emptySettings;
    } catch {
      return emptySettings;
    }
  });
  const [message, setMessage] = useState<string | null>(null);

  const total = useMemo(() => cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), [cart]);

  const groupedProducts = useMemo(() => {
    return products.reduce<Record<string, Product[]>>((groups, product) => {
      if (!groups[product.categoryName]) {
        groups[product.categoryName] = [];
      }

      groups[product.categoryName].push(product);
      return groups;
    }, {});
  }, [products]);

  async function fetchData() {
    const [productResponse, tableResponse, sessionResponse, orderResponse] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/tables"),
      fetch("/api/sessions"),
      fetch("/api/orders"),
    ]);

    if (!productResponse.ok || !tableResponse.ok || !sessionResponse.ok || !orderResponse.ok) {
      throw new Error("Failed to load POS data.");
    }

    const [productPayload, tablePayload, sessionPayload, orderPayload] = await Promise.all([
      productResponse.json(),
      tableResponse.json(),
      sessionResponse.json(),
      orderResponse.json(),
    ]);

    setProducts(productPayload.products);
    setTables(tablePayload.tables);
    setOpenSession(sessionPayload.openSession);
    setOrders(orderPayload.orders);
  }

  async function loadRazorpayCheckout() {
    if (typeof window === "undefined") {
      throw new Error("Razorpay checkout is only available in the browser.");
    }

    if (window.Razorpay) {
      return;
    }

    if (!razorpayScriptRef.current) {
      razorpayScriptRef.current = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Unable to load Razorpay checkout."));
        document.body.appendChild(script);
      });
    }

    await razorpayScriptRef.current;

    if (!window.Razorpay) {
      throw new Error("Razorpay checkout is unavailable.");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData()
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load terminal data."))
      .finally(() => setLoading(false));

    const interval = window.setInterval(() => {
      void fetchData().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  async function openRegister() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terminalName: "Main POS Terminal" }),
      });

      if (!response.ok) {
        throw new Error("Unable to open a new register session.");
      }

      const payload = (await response.json()) as { session: Session };
      setOpenSession(payload.session);
      await fetchData();
      setMessage("Register opened successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to open register.");
    } finally {
      setSaving(false);
    }
  }

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);

      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: product.price,
          isKitchenItem: product.isKitchenItem,
        },
      ];
    });

    setMessage(`${product.name} added to cart.`);
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + delta } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

    function selectTable(tableId: string) {
      setSelectedTableId(tableId);

      const tableOrder = orders.find((order) => order.tableId === tableId);

      if (tableOrder) {
        setActiveOrder(tableOrder);
        setPaymentChoice(null);
        setMessage(
          tableOrder.paymentStatus === "PAID"
            ? `Table order ${tableOrder.orderNumber} is already paid.`
            : `Loaded order ${tableOrder.orderNumber} for payment.`,
        );
        return;
      }

      setActiveOrder(null);
      setPaymentChoice(null);
      setMessage("No order found for that table.");
    }

  async function createOrder() {
    if (!openSession) {
      setMessage("Open a register session before creating orders.");
      return;
    }

    if (cart.length === 0) {
      setMessage("Add at least one product to the cart.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: openSession.id,
          tableId: selectedTableId,
          source: "MANUAL",
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            name: item.name,
            unitPrice: item.unitPrice,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to create order.");
      }

      const payload = (await response.json()) as { order: Order };
      setActiveOrder(payload.order);
      setPaymentChoice(null);
      setCart([]);
      await fetchData();
      setMessage(`Order ${payload.order.orderNumber} sent to kitchen.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create order.");
    } finally {
      setSaving(false);
    }
  }

  async function completePayment(method: "CASH" | "CARD" | "UPI") {
    if (!activeOrder) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: activeOrder.id,
          paymentMethod: method,
          paymentStatus: "PAID",
          qrConfirmed: method === "UPI",
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to complete payment.");
      }

      const payload = (await response.json()) as { order: Order };
      setActiveOrder(payload.order);
      setReceiptOrder(payload.order);
      setShowReceipt(true);
      await fetchData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete payment.");
    } finally {
      setSaving(false);
    }
  }

  async function startRazorpayFlow(method: RazorpayPaymentMethod) {
    if (!activeOrder) {
      return;
    }

    setSaving(true);
    setMessage(`Opening Razorpay checkout for ${method.toLowerCase()}.`);

    try {
      const createResponse = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: activeOrder.id, paymentMethod: method }),
      });

      if (!createResponse.ok) {
        throw new Error("Unable to start Razorpay checkout.");
      }

      const checkout = (await createResponse.json()) as RazorpayCreateResponse;
      await loadRazorpayCheckout();

      const RazorpayCheckout = window.Razorpay;

      if (!RazorpayCheckout) {
        throw new Error("Razorpay checkout is unavailable.");
      }

      const razorpay = new RazorpayCheckout({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency,
        name: "MindHatch CafePOS",
        description: `Order ${checkout.orderNumber}`,
        order_id: checkout.orderId,
        notes: {
          orderId: activeOrder.id,
          paymentMethod: method,
        },
        theme: { color: "#22c55e" },
        handler: async (response) => {
          try {
            const verifyResponse = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: activeOrder.id,
                paymentMethod: method,
                checkoutToken: checkout.checkoutToken,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            if (!verifyResponse.ok) {
              throw new Error("Payment was authorized, but verification failed.");
            }

            const payload = (await verifyResponse.json()) as RazorpayVerifyResponse;
            setActiveOrder(payload.order);
            setReceiptOrder(payload.order);
            setShowReceipt(true);
            await fetchData();
            setSaving(false);
            setMessage(`Payment completed with Razorpay for order ${payload.order.orderNumber}.`);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to verify Razorpay payment.");
          } finally {
            setSaving(false);
          }
        },
        modal: {
          ondismiss: () => {
            setSaving(false);
            setMessage("Razorpay checkout closed.");
          },
        },
      });

      razorpay.open();
    } catch (error) {
      setSaving(false);
      setMessage(error instanceof Error ? error.message : "Unable to start Razorpay checkout.");
    }
  }

  async function closeRegister() {
    if (!openSession) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: openSession.id }),
      });

      if (!response.ok) {
        throw new Error("Unable to close the register.");
      }

      await fetchData();
      setCart([]);
      setSelectedTableId(null);
      setActiveOrder(null);
      setPaymentChoice(null);
      setMessage("Register closed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to close register.");
    } finally {
      setSaving(false);
    }
  }

  async function resetAfterReceipt() {
    setShowReceipt(false);
    setReceiptOrder(null);
    setCart([]);
    setSelectedTableId(null);
    setActiveOrder(null);
    setPaymentChoice(null);
    await fetchData();
  }

  const activeOrderIsPaid = activeOrder?.paymentStatus === "PAID";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-8 lg:px-10">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">POS terminal</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Floor, cart, and payment control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Open the register, select a table, build an order, push it to the kitchen, and settle it by cash,
              card, or UPI through Razorpay without leaving the terminal.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Session</div>
              <div className="mt-1 text-sm font-semibold">{openSession ? openSession.terminalName : "Closed"}</div>
            </div>
            <div className="rounded-2xl bg-cyan-500 px-4 py-3 text-slate-950">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-950/70">Total</div>
              <div className="mt-1 text-2xl font-semibold">${total.toFixed(2)}</div>
            </div>
            <div className="rounded-2xl bg-amber-100 px-4 py-3 text-amber-950">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-900/70">Cart items</div>
              <div className="mt-1 text-2xl font-semibold">{cart.length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
        <button
          onClick={() => floorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Table
        </button>
        <button
          onClick={() => registerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Register
        </button>
        <button onClick={() => void fetchData()} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          Reload Data
        </button>
        <Link href="/backend" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
          Go to Back-end
        </Link>
        <button
          onClick={() => void closeRegister()}
          className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || !openSession}
        >
          Close Register
        </button>
      </section>

      {message ? (
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
          {message}
        </section>
      ) : null}

      <section ref={floorRef} className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Floor view</h2>
              <p className="text-sm text-slate-500">Choose a table to start the order.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              {openSession ? "Register open" : "Register closed"}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-2">
            {tables.map((table) => {
              const isSelected = table.id === selectedTableId;

              return (
                <button
                  key={table.id}
                  onClick={() => selectTable(table.id)}
                  className={`rounded-2xl border px-4 py-5 text-left transition ${
                    isSelected ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{table.floorName}</div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{table.tableNumber}</div>
                  <div className="mt-1 text-sm text-slate-600">{table.seats} seats</div>
                  <div className="mt-3 inline-flex rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                    {table.status}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Current cart</h2>
              <p className="text-sm text-slate-500">Add items from the product grid and confirm the order.</p>
            </div>
            <button
              onClick={openRegister}
              disabled={saving || Boolean(openSession)}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Open Session
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-200 rounded-3xl border border-slate-200">
            {cart.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">The cart is empty.</div>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between px-4 py-4">
                  <div>
                    <div className="font-medium text-slate-950">{item.name}</div>
                    <div className="text-sm text-slate-500">${item.unitPrice.toFixed(2)} each</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => changeQuantity(item.productId, -1)} className="h-8 w-8 rounded-full border border-slate-200 text-lg text-slate-600">
                      -
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
                    <button onClick={() => changeQuantity(item.productId, 1)} className="h-8 w-8 rounded-full border border-slate-200 text-lg text-slate-600">
                      +
                    </button>
                    <span className="w-20 text-right text-slate-700">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-4 text-white">
            <span className="text-sm uppercase tracking-[0.18em] text-slate-400">Checkout total</span>
            <span className="text-2xl font-semibold">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={() => void createOrder()}
            disabled={saving || !openSession || cart.length === 0}
            className="mt-4 h-12 w-full rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            Send to Kitchen
          </button>
        </div>
      </section>

      <section ref={registerRef} className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Product grid</h2>
              <p className="text-sm text-slate-500">Tap a product to add it to the current order.</p>
            </div>
            <div className="text-sm text-slate-500">{loading ? "Loading..." : `${products.length} products`}</div>
          </div>

          <div className="mt-4 space-y-6">
            {Object.entries(groupedProducts).map(([categoryName, categoryProducts]) => (
              <div key={categoryName}>
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{categoryName}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {categoryProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addProduct(product)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50"
                    >
                      <div className="text-sm font-semibold text-slate-950">{product.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{product.description}</div>
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {product.isKitchenItem ? "Kitchen" : "Bar"}
                        </span>
                        <span className="font-semibold text-slate-950">${product.price.toFixed(2)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Payment methods</h2>
            <p className="mt-1 text-sm text-slate-500">Card and UPI now open Razorpay checkout.</p>
            {activeOrderIsPaid ? (
              <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
                This table’s order is already paid. The payment controls are hidden until a new unpaid order is created.
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {paymentMethods
                  .filter((method) => settings[method.id.toLowerCase() as "cash" | "card" | "upi"])
                  .map((method) => (
                    <button
                      key={method.id}
                      onClick={
                        method.id === "CASH"
                          ? () => setPaymentChoice(method.id)
                          : () => void startRazorpayFlow(method.id as RazorpayPaymentMethod)
                      }
                      disabled={!activeOrder || saving}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-950">{method.label}</span>
                        <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                          {activeOrder ? "Available" : "Create order first"}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </section>
        </div>
      </section>

      {paymentChoice === "CASH" && activeOrder ? (
        <section
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/60 p-6"
        >
          <div
            className="max-w-sm rounded-[1.75rem] bg-white p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Confirm payment</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{paymentChoice}</h2>
            <div className="mt-2 text-sm text-slate-600">Press Confirmed to complete the payment.</div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => void completePayment("CASH")}
                className="h-12 flex-1 rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950"
              >
                Confirmed
              </button>
              <button
                onClick={() => setPaymentChoice(null)}
                className="h-12 flex-1 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {showReceipt && receiptOrder ? (
        <section
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-6"
          onClick={() => void resetAfterReceipt()}
        >
          <div
            className="w-full max-w-md rounded-[1.75rem] bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Receipt</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Payment complete</h2>
              <div className="mt-2 text-sm text-slate-600">Tap close to return to the floor view.</div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>Order</span>
                <span className="font-semibold text-slate-950">{receiptOrder.orderNumber}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>Table</span>
                <span className="font-semibold text-slate-950">{receiptOrder.tableNumber ?? "Walk-in"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>Paid via</span>
                <span className="font-semibold text-slate-950">{receiptOrder.paymentMethod ?? "Unknown"}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>Status</span>
                <span className="font-semibold text-emerald-700">{receiptOrder.paymentStatus}</span>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Items
              </div>
              <div className="divide-y divide-slate-200">
                {receiptOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-slate-950">{item.name}</div>
                      <div className="text-slate-500">Qty {item.quantity}</div>
                    </div>
                    <div className="font-semibold text-slate-950">${(item.quantity * item.unitPrice).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-3xl bg-slate-950 px-4 py-4 text-white">
              <span className="text-sm uppercase tracking-[0.18em] text-slate-400">Total</span>
              <span className="text-2xl font-semibold">${receiptOrder.total.toFixed(2)}</span>
            </div>

            <button
              onClick={() => void resetAfterReceipt()}
              className="mt-6 h-12 w-full rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950"
            >
              Close receipt
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}