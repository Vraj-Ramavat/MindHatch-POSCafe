"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../../lib/formatCurrency";

type CustomerItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  prepared: boolean;
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  stage: string;
  paymentStatus: string;
  paymentMethod: string | null;
  tableId: string | null;
  tableNumber: string | null;
  total: number;
  createdAt: string;
  items: CustomerItem[];
};

type CustomerTable = {
  id: string;
  floorName: string;
  tableNumber: string;
  seats: number;
  active: boolean;
  status: string;
};

export default function CustomerPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [tables, setTables] = useState<CustomerTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchData() {
    const [ordersResponse, tablesResponse] = await Promise.all([fetch("/api/orders"), fetch("/api/tables")]);

    if (!ordersResponse.ok || !tablesResponse.ok) {
      throw new Error("Unable to load customer display data.");
    }

    const [ordersPayload, tablesPayload] = await Promise.all([ordersResponse.json(), tablesResponse.json()]);
    setOrders(ordersPayload.orders);
    setTables(tablesPayload.tables);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load display data."));

    const interval = window.setInterval(() => {
      void fetchData().catch(() => undefined);
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) ?? tables[0] ?? null,
    [tables, selectedTableId],
  );

  const activeOrder = useMemo(
    () => orders.find((order) => order.tableId === selectedTable?.id) ?? null,
    [orders, selectedTable],
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-8 lg:px-10">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Customer display</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Live order status</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
          The customer screen shows what is being prepared, what has been paid, and how the order is progressing.
        </p>
      </section>

      {message ? <section className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">{message}</section> : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">Select your table</h2>
            <p className="text-sm text-slate-500">Choose a table to see its live status and current order.</p>
          </div>
          <div className="text-xs text-slate-500 sm:text-sm">{tables.length} tables live</div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => {
            const isSelected = table.id === selectedTable?.id;

            return (
              <button
                key={table.id}
                type="button"
                onClick={() => setSelectedTableId(table.id)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  isSelected ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-slate-50 hover:bg-white"
                }`}
              >
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{table.floorName}</div>
                <div className="mt-2 text-base font-semibold text-slate-950 sm:text-lg">{table.tableNumber}</div>
                <div className="mt-1 text-sm text-slate-600">{table.seats} seats</div>
                <div className="mt-3 inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                  {table.status}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Table status</div>
          <div className="mt-3 text-2xl font-semibold sm:text-3xl">{selectedTable?.status ?? "Waiting"}</div>
          <div className="mt-2 text-sm text-slate-300">
            {selectedTable ? `${selectedTable.floorName} · ${selectedTable.tableNumber}` : "Choose a table"}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Active order</div>
          <div className="mt-3 text-2xl font-semibold text-slate-950 sm:text-3xl">{activeOrder?.orderNumber ?? "---"}</div>
          <div className="mt-2 text-sm text-slate-600">{activeOrder ? `Order ${activeOrder.stage}` : "No live order yet"}</div>
        </article>
      </section>

      {selectedTable ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950 sm:text-2xl">Live table view</h2>
              <p className="text-sm text-slate-500">
                Table {selectedTable.tableNumber} · Payment: {activeOrder?.paymentMethod ?? "Pending"}
                {activeOrder ? ` · Total: ${formatCurrency(activeOrder.total)}` : ""}
              </p>
            </div>
            <div className="rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">
              {activeOrder?.paymentStatus ?? selectedTable.status}
            </div>
          </div>

          {activeOrder ? (
            <div className="mt-6 grid gap-3">
              {activeOrder.items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className={item.prepared ? "line-through text-slate-400" : ""}>
                      {item.name} x{item.quantity}
                    </span>
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {item.prepared ? "Ready" : "In progress"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No live order for this table yet.
            </div>
          )}

        </section>
      ) : null}
    </main>
  );
}