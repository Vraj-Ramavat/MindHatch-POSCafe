"use client";

import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";

type ReportItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  prepared: boolean;
};

type ReportOrder = {
  id: string;
  orderNumber: string;
  sessionId: string;
  sessionName: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  tableNumber: string | null;
  stage: string;
  paymentStatus: string;
  paymentMethod: string | null;
  total: number;
  createdAt: string;
  items: ReportItem[];
};

type Session = { id: string; terminalName: string; status: string };
type Product = { id: string; name: string };
type FilterPeriod = "all" | "today" | "week" | "custom";

export default function ReportsPage() {
  const [orders, setOrders] = useState<ReportOrder[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [period, setPeriod] = useState<FilterPeriod>("week");
  const [sessionId, setSessionId] = useState("all");
  const [responsible, setResponsible] = useState("all");
  const [productName, setProductName] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function fetchData() {
    const [ordersResponse, sessionsResponse, productsResponse] = await Promise.all([
      fetch("/api/orders"),
      fetch("/api/sessions"),
      fetch("/api/products"),
    ]);

    if (!ordersResponse.ok || !sessionsResponse.ok || !productsResponse.ok) {
      throw new Error("Unable to load reporting data.");
    }

    const [orderPayload, sessionPayload, productPayload] = await Promise.all([
      ordersResponse.json(),
      sessionsResponse.json(),
      productsResponse.json(),
    ]);

    setOrders(orderPayload.orders);
    setSessions(sessionPayload.sessions);
    setProducts(productPayload.products);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load reports."));
  }, []);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt);

      if (period === "today" && createdAt < startOfToday) {
        return false;
      }

      if (period === "week" && createdAt < startOfWeek) {
        return false;
      }

      if (period === "custom") {
        if (fromDate && createdAt < new Date(`${fromDate}T00:00:00`)) {
          return false;
        }

        if (toDate && createdAt > new Date(`${toDate}T23:59:59.999`)) {
          return false;
        }
      }

      if (sessionId !== "all" && order.sessionId !== sessionId) {
        return false;
      }

      if (responsible !== "all" && order.responsibleName !== responsible) {
        return false;
      }

      if (productName !== "all" && !order.items.some((item) => item.name === productName)) {
        return false;
      }

      return true;
    });
  }, [orders, period, sessionId, responsible, productName, fromDate, toDate]);

  const summary = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const paidOrders = filteredOrders.filter((order) => order.paymentStatus === "PAID");
    const itemSales = new Map<string, number>();

    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        itemSales.set(item.name, (itemSales.get(item.name) ?? 0) + item.quantity);
      });
    });

    const topProduct = Array.from(itemSales.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No sales";

    return {
      totalSales,
      orderCount: filteredOrders.length,
      paidCount: paidOrders.length,
      avgTicket: filteredOrders.length > 0 ? totalSales / filteredOrders.length : 0,
      topProduct,
    };
  }, [filteredOrders]);

  const responsibleOptions = useMemo(() => Array.from(new Set(orders.map((order) => order.responsibleName).filter(Boolean))) as string[], [orders]);
  const productOptions = useMemo(() => products.map((product) => product.name), [products]);

  async function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(18);
    doc.text("MindHatch CafePOS Report", 14, 16);
    doc.setFontSize(11);
    doc.text(
      `Orders: ${summary.orderCount} | Total sales: $${summary.totalSales.toFixed(2)} | Top product: ${summary.topProduct}`,
      14,
      26,
    );

    let y = 38;
    filteredOrders.forEach((order) => {
      const line = `${order.orderNumber} | ${order.sessionName ?? order.sessionId} | ${order.responsibleName ?? "Unknown"} | ${order.tableNumber ?? "Walk-in"} | ${order.paymentStatus} | $${order.total.toFixed(2)}`;
      doc.text(line, 14, y);
      y += 8;
      if (y > 190) {
        doc.addPage();
        y = 16;
      }
    });

    doc.save("mindhatch-cafepos-report.pdf");
  }

  async function exportXls() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    sheet.columns = [
      { header: "Order", key: "orderNumber", width: 14 },
      { header: "Session", key: "session", width: 18 },
      { header: "Responsible", key: "responsible", width: 18 },
      { header: "Table", key: "table", width: 12 },
      { header: "Status", key: "status", width: 14 },
      { header: "Total", key: "total", width: 12 },
    ];

    filteredOrders.forEach((order) => {
      sheet.addRow({
        orderNumber: order.orderNumber,
        session: order.sessionName ?? order.sessionId,
        responsible: order.responsibleName ?? "Unknown",
        table: order.tableNumber ?? "Walk-in",
        status: order.paymentStatus,
        total: order.total,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mindhatch-cafepos-report.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-8 lg:px-10">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Reporting dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Sales, sessions, and product performance</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Filter by time period, register session, responsible staff member, or product to inspect shift performance
          and export the current result to PDF or Excel.
        </p>
      </section>

      {message ? <section className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">{message}</section> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Total sales</div>
          <div className="mt-3 text-3xl font-semibold text-slate-950">${summary.totalSales.toFixed(2)}</div>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Orders</div>
          <div className="mt-3 text-3xl font-semibold text-slate-950">{summary.orderCount}</div>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Avg ticket</div>
          <div className="mt-3 text-3xl font-semibold text-slate-950">${summary.avgTicket.toFixed(2)}</div>
        </article>
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-500">Top product</div>
          <div className="mt-3 text-2xl font-semibold text-slate-950">{summary.topProduct}</div>
        </article>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Period</span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as FilterPeriod)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white"
            >
              <option value="today">Today</option>
              <option value="week">Week</option>
              <option value="custom">Custom</option>
              <option value="all">All time</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Session</span>
            <select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white"
            >
              <option value="all">All sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.terminalName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Responsible</span>
            <select
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white"
            >
              <option value="all">All staff</option>
              {responsibleOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Product</span>
            <select
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white"
            >
              <option value="all">All products</option>
              {productOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              disabled={period !== "custom"}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              disabled={period !== "custom"}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white disabled:opacity-60"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => void fetchData()} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            Refresh
          </button>
          <button onClick={() => void exportPdf()} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Export PDF
          </button>
          <button onClick={() => void exportXls()} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Export XLS
          </button>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Filtered orders</h2>
            <p className="text-sm text-slate-500">{filteredOrders.length} matching orders</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_0.9fr_0.8fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Order</span>
            <span>Session</span>
            <span>Responsible</span>
            <span>Table</span>
            <span>Status</span>
            <span>Total</span>
          </div>
          {filteredOrders.length === 0 ? (
            <div className="px-4 py-8 text-sm text-slate-500">No orders match the current filters.</div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_0.9fr_0.8fr_0.8fr] border-t border-slate-200 px-4 py-4 text-sm text-slate-700"
              >
                <span className="font-semibold text-slate-950">{order.orderNumber}</span>
                <span>{order.sessionName ?? order.sessionId}</span>
                <span>{order.responsibleName ?? "Unknown"}</span>
                <span>{order.tableNumber ?? "Walk-in"}</span>
                <span>{order.paymentStatus}</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}