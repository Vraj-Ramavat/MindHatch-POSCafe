"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "../../lib/formatCurrency";

type TicketItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  kitchenStage: string;
  prepared: boolean;
};

type Ticket = {
  id: string;
  orderNumber: string;
  stage: string;
  paymentStatus: string;
  tableNumber: string | null;
  total: number;
  createdAt: string;
  items: TicketItem[];
};

type TicketFragment = Ticket & {
  fragmentKey: string;
  fragmentStage: "TO_COOK" | "PREPARING" | "COMPLETED";
};

type TrashTicket = TicketFragment & {
  removedAt: string;
};

const stageFlow = ["TO_COOK", "PREPARING", "COMPLETED"] as const;
const completedTicketLifetime = 60_000;
const trashStorageKey = "mindhatch-kitchen-trash";

export default function KitchenPage() {
  const [orders, setOrders] = useState<Ticket[]>([]);
  const [trashedTickets, setTrashedTickets] = useState<TrashTicket[]>([]);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const completionTimersRef = useRef<Record<string, number>>({});
  const completedSeenAtRef = useRef<Record<string, number>>({});

  async function fetchOrders() {
    const response = await fetch("/api/orders");

    if (!response.ok) {
      throw new Error("Unable to load kitchen tickets.");
    }

    const payload = (await response.json()) as { orders: Ticket[] };
    setOrders(payload.orders);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrders().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load tickets."));

    const savedTrash = window.localStorage.getItem(trashStorageKey);
    if (savedTrash) {
      try {
        setTrashedTickets(JSON.parse(savedTrash) as TrashTicket[]);
      } catch {
        window.localStorage.removeItem(trashStorageKey);
      }
    }

    const interval = window.setInterval(() => {
      void fetchOrders().catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  const columns = useMemo(
    () => {
      const toCook: TicketFragment[] = [];
      const preparing: TicketFragment[] = [];
      const completed: TicketFragment[] = [];

      for (const order of orders) {
        const pendingItems = order.items.filter((item) => item.kitchenStage === "TO_COOK");
        const preparingItems = order.items.filter((item) => item.kitchenStage === "PREPARING");
        const completedItems = order.items.filter((item) => item.kitchenStage === "COMPLETED");

        if (pendingItems.length > 0) {
          toCook.push({
            ...order,
            items: pendingItems,
            fragmentKey: `${order.id}-pending`,
            fragmentStage: "TO_COOK",
          });
        }

        if (preparingItems.length > 0) {
          preparing.push({
            ...order,
            items: preparingItems,
            fragmentKey: `${order.id}-preparing`,
            fragmentStage: "PREPARING",
          });
        }

        if (completedItems.length > 0) {
          completed.push({
            ...order,
            items: completedItems,
            fragmentKey: `${order.id}-completed`,
            fragmentStage: "COMPLETED",
          });
        }
      }

      return {
        TO_COOK: toCook,
        PREPARING: preparing,
        COMPLETED: completed,
      };
    },
    [orders],
  );

  const trashedKeys = useMemo(() => new Set(trashedTickets.map((ticket) => ticket.fragmentKey)), [trashedTickets]);

  const visibleCompletedTickets = useMemo(
    () => columns.COMPLETED.filter((ticket) => !trashedKeys.has(ticket.fragmentKey)),
    [columns.COMPLETED, trashedKeys],
  );

  useEffect(() => {
    window.localStorage.setItem(trashStorageKey, JSON.stringify(trashedTickets));
  }, [trashedTickets]);

  useEffect(() => {
    const now = Date.now();
    const visibleKeys = new Set(visibleCompletedTickets.map((ticket) => ticket.fragmentKey));

    for (const ticket of visibleCompletedTickets) {
      const existingSeenAt = completedSeenAtRef.current[ticket.fragmentKey];
      const seenAt = existingSeenAt ?? now;
      completedSeenAtRef.current[ticket.fragmentKey] = seenAt;

      const elapsed = now - seenAt;
      const remaining = completedTicketLifetime - elapsed;

      if (remaining <= 0) {
        setTrashedTickets((current) =>
          current.some((trashedTicket) => trashedTicket.fragmentKey === ticket.fragmentKey)
            ? current
            : [
                ...current,
                {
                  ...ticket,
                  removedAt: new Date().toISOString(),
                },
              ],
        );

        delete completedSeenAtRef.current[ticket.fragmentKey];
        const timer = completionTimersRef.current[ticket.fragmentKey];
        if (timer) {
          window.clearTimeout(timer);
          delete completionTimersRef.current[ticket.fragmentKey];
        }

        continue;
      }

      if (!completionTimersRef.current[ticket.fragmentKey]) {
        completionTimersRef.current[ticket.fragmentKey] = window.setTimeout(() => {
          setTrashedTickets((current) =>
            current.some((trashedTicket) => trashedTicket.fragmentKey === ticket.fragmentKey)
              ? current
              : [
                  ...current,
                  {
                    ...ticket,
                    removedAt: new Date().toISOString(),
                  },
                ],
          );
          delete completedSeenAtRef.current[ticket.fragmentKey];
          delete completionTimersRef.current[ticket.fragmentKey];
        }, remaining);
      }
    }

    for (const fragmentKey of Object.keys(completionTimersRef.current)) {
      if (!visibleKeys.has(fragmentKey)) {
        window.clearTimeout(completionTimersRef.current[fragmentKey]);
        delete completionTimersRef.current[fragmentKey];
        delete completedSeenAtRef.current[fragmentKey];
      }
    }
  }, [visibleCompletedTickets]);

  async function advanceOrder(order: TicketFragment) {
    await setOrderStage(order, 1);
  }

  async function moveOrderBack(order: TicketFragment) {
    await setOrderStage(order, -1);
  }

  async function setOrderStage(order: TicketFragment, direction: 1 | -1) {
    const currentIndex = stageFlow.indexOf(order.fragmentStage);
    const nextStage = stageFlow[Math.min(Math.max(currentIndex + direction, 0), stageFlow.length - 1)];

    if (nextStage === order.fragmentStage) {
      return;
    }

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        stage: nextStage,
        itemIds: order.items.map((item) => item.id),
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to update ticket stage.");
    }

    await fetchOrders();
  }

  async function restoreTicket(ticket: TrashTicket) {
    setTrashedTickets((current) => current.filter((trashedTicket) => trashedTicket.fragmentKey !== ticket.fragmentKey));
    await fetchOrders();
  }

  async function markPrepared(orderId: string, itemId: string) {
    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        itemPreparedId: itemId,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to mark item as prepared.");
    }

    await fetchOrders();
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-8 lg:px-10">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-600">Kitchen display</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Live prep tickets</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
          Tickets move from To Cook to Preparing to Completed, and each line item can be struck off individually as
          it is prepared.
        </p>
      </section>

      {message ? <section className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">{message}</section> : null}

      <section className="grid gap-4 xl:grid-cols-3">
        {(["TO_COOK", "PREPARING", "COMPLETED"] as const).map((stage) => (
          <div key={stage} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">{stage.replace("_", " ")}</h2>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                {columns[stage].length}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {stage === "COMPLETED" ? (
                visibleCompletedTickets.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No tickets</div>
                ) : (
                  visibleCompletedTickets.map((ticket) => (
                    <article key={ticket.fragmentKey} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3 text-left">
                        <button onClick={() => void advanceOrder(ticket)} className="flex-1 text-left">
                          <div className="text-xl font-semibold text-slate-950">{ticket.orderNumber}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            Table {ticket.tableNumber ?? "Walk-in"} · {ticket.paymentStatus} · {formatCurrency(ticket.total)}
                          </div>
                        </button>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Tap to advance
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void moveOrderBack(ticket)}
                          disabled={ticket.fragmentStage === "TO_COOK"}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Move to previous stage
                        </button>
                      </div>

                      <div className="mt-4 space-y-2">
                        {ticket.items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => void markPrepared(ticket.id, item.id)}
                            className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-sm transition hover:bg-cyan-50"
                          >
                            <span className={item.prepared ? "text-slate-400 line-through" : "text-slate-700"}>
                              {item.name} x{item.quantity}
                            </span>
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              {item.prepared ? "Done" : "Prepare"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </article>
                  ))
                )
              ) : columns[stage].length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No tickets</div>
              ) : (
                columns[stage].map((ticket) => (
                  <article key={ticket.fragmentKey} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3 text-left">
                      <button onClick={() => void advanceOrder(ticket)} className="flex-1 text-left">
                        <div className="text-xl font-semibold text-slate-950">{ticket.orderNumber}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          Table {ticket.tableNumber ?? "Walk-in"} · {ticket.paymentStatus} · {formatCurrency(ticket.total)}
                        </div>
                      </button>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Tap to advance
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void moveOrderBack(ticket)}
                        disabled={ticket.fragmentStage === "TO_COOK"}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Move to previous stage
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {ticket.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => void markPrepared(ticket.id, item.id)}
                          className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-sm transition hover:bg-cyan-50"
                        >
                          <span className={item.prepared ? "text-slate-400 line-through" : "text-slate-700"}>
                            {item.name} x{item.quantity}
                          </span>
                          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            {item.prepared ? "Done" : "Prepare"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        ))}
      </section>

      <button
        type="button"
        onClick={() => setIsTrashOpen((open) => !open)}
        className="fixed bottom-6 right-6 z-40 flex h-14 items-center gap-3 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
      >
        <span className="text-lg">🗑️</span>
        <span>Dustbin</span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{trashedTickets.length}</span>
      </button>

      {isTrashOpen ? (
        <section className="fixed bottom-24 right-6 z-40 w-[min(22rem,calc(100vw-3rem))] rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Dustbin</h2>
              <p className="text-xs text-slate-500">Completed tickets stored automatically after 1 minute.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsTrashOpen(false)}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              Close
            </button>
          </div>

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {trashedTickets.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No deleted completed tickets yet.
              </div>
            ) : (
              trashedTickets
                .slice()
                .reverse()
                .map((ticket) => (
                  <article key={ticket.fragmentKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{ticket.orderNumber}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Table {ticket.tableNumber ?? "Walk-in"} · {ticket.items.length} item(s)
                        </div>
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Deleted</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => void restoreTicket(ticket)}
                      className="mt-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Restore
                    </button>
                  </article>
                ))
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}