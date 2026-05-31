"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../../lib/formatCurrency";
import type { FormEvent } from "react";

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
};

type Category = { id: string; name: string };

type Table = {
  id: string;
  floorId: string;
  floorName: string;
  tableNumber: string;
  seats: number;
  active: boolean;
  appointmentResource: string | null;
  status: string;
};

type Floor = { id: string; name: string; tableCount: number };

type Session = {
  id: string;
  terminalName: string;
  status: string;
  closingSaleAmount: number;
  openedAt: string;
};

type Settings = { upiId: string; cash: boolean; card: boolean; upi: boolean };

const defaultSettings: Settings = { upiId: "123@ybl.com", cash: true, card: true, upi: true };

export default function BackendPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") return defaultSettings;
    try {
      const saved = window.localStorage.getItem("mindhatch-pos-settings");
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [floorDrafts, setFloorDrafts] = useState<Record<string, string>>({});
  const [productDrafts, setProductDrafts] = useState<
    Record<
      string,
      { name: string; categoryId: string; price: string; unit: string; tax: string; description: string; isKitchenItem: boolean; active: boolean }
    >
  >({});
  const [tableDrafts, setTableDrafts] = useState<
    Record<
      string,
      { floorId: string; tableNumber: string; seats: string; appointmentResource: string; status: "AVAILABLE" | "OCCUPIED" | "RESERVED"; active: boolean }
    >
  >({});

  const floorOptions = useMemo(() => floors.map((floor) => ({ id: floor.id, name: floor.name })), [floors]);

  const [productForm, setProductForm] = useState({ name: "", categoryId: "", price: "", unit: "plate", tax: "5", description: "", isKitchenItem: true });
  const [tableForm, setTableForm] = useState({ floorId: "", tableNumber: "", seats: "4", active: true, appointmentResource: "", status: "AVAILABLE" });
  const [floorForm, setFloorForm] = useState({ name: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "" });

  async function fetchData() {
    const [categoryResponse, productResponse, floorResponse, tableResponse, sessionResponse] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/products"),
      fetch("/api/floors"),
      fetch("/api/tables"),
      fetch("/api/sessions"),
    ]);

    if (!categoryResponse.ok || !productResponse.ok || !floorResponse.ok || !tableResponse.ok || !sessionResponse.ok) {
      throw new Error("Unable to load backend configuration.");
    }

    const [categoryPayload, productPayload, floorPayload, tablePayload, sessionPayload] = await Promise.all([
      categoryResponse.json(),
      productResponse.json(),
      floorResponse.json(),
      tableResponse.json(),
      sessionResponse.json(),
    ]);

    setCategories(categoryPayload.categories);
    setProducts(productPayload.products);
    setFloors(floorPayload.floors);
    setTables(tablePayload.tables);
    setSessions(sessionPayload.sessions);
    setCategoryDrafts(Object.fromEntries(categoryPayload.categories.map((category: Category) => [category.id, category.name])));
    setFloorDrafts(Object.fromEntries(floorPayload.floors.map((floor: Floor) => [floor.id, floor.name])));
    setProductDrafts(
      Object.fromEntries(
        productPayload.products.map((product: Product) => [
          product.id,
          {
            name: product.name,
            categoryId: product.categoryId,
            price: product.price.toString(),
            unit: product.unit,
            tax: product.tax === null ? "" : product.tax.toString(),
            description: product.description ?? "",
            isKitchenItem: product.isKitchenItem,
            active: product.active,
          },
        ]),
      ),
    );
    setTableDrafts(
      Object.fromEntries(
        tablePayload.tables.map((table: Table) => [
          table.id,
          {
            floorId: table.floorId,
            tableNumber: table.tableNumber,
            seats: table.seats.toString(),
            appointmentResource: table.appointmentResource ?? "",
            status: table.status as "AVAILABLE" | "OCCUPIED" | "RESERVED",
            active: table.active,
          },
        ]),
      ),
    );
    setProductForm((current) => ({
      ...current,
      categoryId: current.categoryId || categoryPayload.categories[0]?.id || productPayload.products[0]?.categoryId || "",
    }));
    setTableForm((current) => ({
      ...current,
      floorId: current.floorId || floorPayload.floors[0]?.id || tablePayload.tables[0]?.floorId || "",
    }));
  }

  function handleInitialLoadError(error: unknown) {
    setMessage(error instanceof Error ? error.message : "Unable to load backend.");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData().catch(handleInitialLoadError);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("mindhatch-pos-settings", JSON.stringify(settings));
  }, [settings]);

  async function submitJson(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string };
    return { response, payload };
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const { response, payload } = await submitJson("/api/products", "POST", {
      name: productForm.name,
      categoryId: productForm.categoryId,
      price: Number(productForm.price),
      unit: productForm.unit,
      tax: productForm.tax ? Number(productForm.tax) : undefined,
      description: productForm.description,
      isKitchenItem: productForm.isKitchenItem,
    });
    if (!response.ok) return setMessage(payload.error ?? "Unable to create product.");
    setMessage("Product created.");
    setProductForm((current) => ({ ...current, name: "", price: "", description: "" }));
    await fetchData();
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const { response, payload } = await submitJson("/api/categories", "POST", { name: categoryForm.name });
    if (!response.ok) return setMessage(payload.error ?? "Unable to create category.");
    setMessage("Category created.");
    setCategoryForm({ name: "" });
    await fetchData();
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const { response, payload } = await submitJson("/api/tables", "POST", {
      floorId: tableForm.floorId,
      tableNumber: tableForm.tableNumber,
      seats: Number(tableForm.seats),
      active: tableForm.active,
      appointmentResource: tableForm.appointmentResource || null,
      status: tableForm.status,
    });
    if (!response.ok) return setMessage(payload.error ?? "Unable to create table.");
    setMessage("Table created.");
    setTableForm((current) => ({ ...current, tableNumber: "", appointmentResource: "" }));
    await fetchData();
  }

  async function createFloor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const { response, payload } = await submitJson("/api/floors", "POST", { name: floorForm.name });
    if (!response.ok) return setMessage(payload.error ?? "Unable to create floor.");
    setMessage("Floor created.");
    setFloorForm({ name: "" });
    await fetchData();
  }

  async function updateCategory(categoryId: string) {
    setMessage(null);
    const { response, payload } = await submitJson("/api/categories", "PATCH", { categoryId, name: categoryDrafts[categoryId] });
    if (!response.ok) return setMessage(payload.error ?? "Unable to update category.");
    setMessage("Category updated.");
    await fetchData();
  }

  async function deleteCategory(categoryId: string) {
    setMessage(null);
    const { response, payload } = await submitJson("/api/categories", "DELETE", { categoryId });
    if (!response.ok) return setMessage(payload.error ?? "Unable to delete category.");
    setMessage("Category deleted.");
    await fetchData();
  }

  async function updateFloor(floorId: string) {
    setMessage(null);
    const { response, payload } = await submitJson("/api/floors", "PATCH", { floorId, name: floorDrafts[floorId] });
    if (!response.ok) return setMessage(payload.error ?? "Unable to update floor.");
    setMessage("Floor updated.");
    await fetchData();
  }

  async function deleteFloor(floorId: string) {
    setMessage(null);
    const { response, payload } = await submitJson("/api/floors", "DELETE", { floorId });
    if (!response.ok) return setMessage(payload.error ?? "Unable to delete floor.");
    setMessage("Floor deleted.");
    await fetchData();
  }

  async function updateTable(tableId: string) {
    setMessage(null);
    const draft = tableDrafts[tableId];
    const { response, payload } = await submitJson("/api/tables", "PATCH", {
      tableId,
      floorId: draft.floorId,
      tableNumber: draft.tableNumber,
      seats: Number(draft.seats),
      status: draft.status,
      active: draft.active,
      appointmentResource: draft.appointmentResource || null,
    });
    if (!response.ok) return setMessage(payload.error ?? "Unable to update table.");
    setMessage("Table updated.");
    await fetchData();
  }

  async function deleteTable(tableId: string) {
    setMessage(null);
    const { response, payload } = await submitJson("/api/tables", "DELETE", { tableId });
    if (!response.ok) return setMessage(payload.error ?? "Unable to delete table.");
    setMessage("Table deleted.");
    await fetchData();
  }

  async function updateProduct(productId: string) {
    setMessage(null);
    const draft = productDrafts[productId];
    const { response, payload } = await submitJson("/api/products", "PATCH", {
      productId,
      name: draft.name,
      categoryId: draft.categoryId,
      price: Number(draft.price),
      unit: draft.unit,
      tax: draft.tax ? Number(draft.tax) : null,
      description: draft.description,
      isKitchenItem: draft.isKitchenItem,
      active: draft.active,
    });
    if (!response.ok) return setMessage(payload.error ?? "Unable to update product.");
    setMessage("Product updated.");
    await fetchData();
  }

  async function deleteProduct(productId: string) {
    setMessage(null);
    const { response, payload } = await submitJson("/api/products", "DELETE", { productId });
    if (!response.ok) return setMessage(payload.error ?? "Unable to delete product.");
    setMessage("Product deleted.");
    await fetchData();
  }

  const openSession = sessions.find((session) => session.status === "OPEN") ?? null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 sm:px-8 lg:px-10">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Backend configuration</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Products, tables, sessions, and payment settings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">Manage the catalog, floor plan, and terminal setup from one place.</p>
      </section>

      {message ? <section className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">{message}</section> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <form onSubmit={createProduct} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Product management</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Product name</span>
              <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Category</span>
              <select value={productForm.categoryId} onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" required disabled={categories.length === 0}>
                {categories.length === 0 ? <option value="">Create a category first</option> : null}
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Price</span>
              <input type="number" step="0.01" value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Unit</span>
              <input value={productForm.unit} onChange={(event) => setProductForm((current) => ({ ...current, unit: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Tax %</span>
              <input type="number" step="0.01" value={productForm.tax} onChange={(event) => setProductForm((current) => ({ ...current, tax: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
              <textarea value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={productForm.isKitchenItem} onChange={(event) => setProductForm((current) => ({ ...current, isKitchenItem: event.target.checked }))} />
              Send to kitchen
            </label>
            <button type="submit" className="h-12 rounded-2xl bg-slate-950 text-sm font-semibold text-white sm:col-span-1">Save product</button>
          </div>
        </form>

        <div className="space-y-6">
          <form onSubmit={createCategory} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Category management</h2>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Category name</span>
                <input value={categoryForm.name} onChange={(event) => setCategoryForm({ name: event.target.value })} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" placeholder="Food, Drinks, Desserts" required />
              </label>
              <button type="submit" className="h-12 rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950">Save category</button>
            </div>
          </form>

          <form onSubmit={createFloor} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Floor management</h2>
            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Floor name</span>
                <input value={floorForm.name} onChange={(event) => setFloorForm({ name: event.target.value })} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" placeholder="Ground Floor, First Floor, Patio" required />
              </label>
              <button type="submit" className="h-12 rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950">Save floor</button>
            </div>
          </form>

          <form onSubmit={createTable} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Table management</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Floor</span>
                <select value={tableForm.floorId} onChange={(event) => setTableForm((current) => ({ ...current, floorId: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" required disabled={floorOptions.length === 0}>
                  {floorOptions.length === 0 ? <option value="">Create a floor first</option> : null}
                  {floorOptions.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Table number</span>
                <input value={tableForm.tableNumber} onChange={(event) => setTableForm((current) => ({ ...current, tableNumber: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" required />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Seats</span>
                <input type="number" value={tableForm.seats} onChange={(event) => setTableForm((current) => ({ ...current, seats: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" required />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Appointment resource</span>
                <input value={tableForm.appointmentResource} onChange={(event) => setTableForm((current) => ({ ...current, appointmentResource: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select value={tableForm.status} onChange={(event) => setTableForm((current) => ({ ...current, status: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white">
                  <option value="AVAILABLE">Available</option>
                  <option value="OCCUPIED">Occupied</option>
                  <option value="RESERVED">Reserved</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={tableForm.active} onChange={(event) => setTableForm((current) => ({ ...current, active: event.target.checked }))} />
                Active table
              </label>
              <button type="submit" className="h-12 rounded-2xl bg-cyan-500 text-sm font-semibold text-slate-950 sm:col-span-1">Save table</button>
            </div>
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Saved categories</h2>
            <div className="mt-4 grid gap-3">
              {categories.map((category) => (
                <div key={category.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Name</span>
                      <input value={categoryDrafts[category.id] ?? category.name} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category.id]: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                    </label>
                    <div className="flex gap-2 sm:justify-end">
                      <button type="button" onClick={() => void updateCategory(category.id)} className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white">Save</button>
                      <button type="button" onClick={() => void deleteCategory(category.id)} className="h-11 rounded-2xl border border-rose-200 px-4 text-sm font-semibold text-rose-700">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
              {categories.length === 0 ? <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No categories yet.</div> : null}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Saved products</h2>
            <div className="mt-4 grid gap-3">
              {products.map((product) => {
                const draft = productDrafts[product.id] ?? { name: product.name, categoryId: product.categoryId, price: product.price.toString(), unit: product.unit, tax: product.tax === null ? "" : product.tax.toString(), description: product.description ?? "", isKitchenItem: product.isKitchenItem, active: product.active };
                return (
                  <div key={product.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Name</span>
                        <input value={draft.name} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { ...draft, name: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Category</span>
                        <select value={draft.categoryId} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { ...draft, categoryId: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white">
                          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Price</span>
                        <input type="number" step="0.01" value={draft.price} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { ...draft, price: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Unit</span>
                        <input value={draft.unit} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { ...draft, unit: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tax %</span>
                        <input type="number" step="0.01" value={draft.tax} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { ...draft, tax: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Description</span>
                        <textarea value={draft.description} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { ...draft, description: event.target.value } }))} className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <input type="checkbox" checked={draft.isKitchenItem} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { ...draft, isKitchenItem: event.target.checked } }))} />
                        Send to kitchen
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <input type="checkbox" checked={draft.active} onChange={(event) => setProductDrafts((current) => ({ ...current, [product.id]: { ...draft, active: event.target.checked } }))} />
                        Active
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void updateProduct(product.id)} className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white">Save</button>
                      <button type="button" onClick={() => void deleteProduct(product.id)} className="h-11 rounded-2xl border border-rose-200 px-4 text-sm font-semibold text-rose-700">Delete</button>
                      <div className="ml-auto text-sm text-slate-500">{product.categoryName} · {product.isKitchenItem ? "Kitchen" : "Bar"} · {formatCurrency(product.price)}</div>
                    </div>
                  </div>
                );
              })}
              {products.length === 0 ? <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No products yet.</div> : null}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Saved floors</h2>
            <div className="mt-4 grid gap-3">
              {floors.map((floor) => (
                <div key={floor.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Name</span>
                      <input value={floorDrafts[floor.id] ?? floor.name} onChange={(event) => setFloorDrafts((current) => ({ ...current, [floor.id]: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                    </label>
                    <div className="flex gap-2 sm:justify-end">
                      <button type="button" onClick={() => void updateFloor(floor.id)} className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white">Save</button>
                      <button type="button" onClick={() => void deleteFloor(floor.id)} className="h-11 rounded-2xl border border-rose-200 px-4 text-sm font-semibold text-rose-700">Delete</button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{floor.tableCount} tables</div>
                </div>
              ))}
              {floors.length === 0 ? <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No floors yet.</div> : null}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Saved tables</h2>
            <div className="mt-4 grid gap-3">
              {tables.map((table) => {
                const draft = tableDrafts[table.id] ?? { floorId: table.floorId, tableNumber: table.tableNumber, seats: table.seats.toString(), appointmentResource: table.appointmentResource ?? "", status: table.status as "AVAILABLE" | "OCCUPIED" | "RESERVED", active: table.active };
                return (
                  <div key={table.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Floor</span>
                        <select value={draft.floorId} onChange={(event) => setTableDrafts((current) => ({ ...current, [table.id]: { ...draft, floorId: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white">
                          {floorOptions.map((floor) => <option key={floor.id} value={floor.id}>{floor.name}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Table number</span>
                        <input value={draft.tableNumber} onChange={(event) => setTableDrafts((current) => ({ ...current, [table.id]: { ...draft, tableNumber: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Seats</span>
                        <input type="number" value={draft.seats} onChange={(event) => setTableDrafts((current) => ({ ...current, [table.id]: { ...draft, seats: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Status</span>
                        <select value={draft.status} onChange={(event) => setTableDrafts((current) => ({ ...current, [table.id]: { ...draft, status: event.target.value as "AVAILABLE" | "OCCUPIED" | "RESERVED" } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white">
                          <option value="AVAILABLE">Available</option>
                          <option value="OCCUPIED">Occupied</option>
                          <option value="RESERVED">Reserved</option>
                        </select>
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Appointment resource</span>
                        <input value={draft.appointmentResource} onChange={(event) => setTableDrafts((current) => ({ ...current, [table.id]: { ...draft, appointmentResource: event.target.value } }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
                      </label>
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        <input type="checkbox" checked={draft.active} onChange={(event) => setTableDrafts((current) => ({ ...current, [table.id]: { ...draft, active: event.target.checked } }))} />
                        Active table
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void updateTable(table.id)} className="h-11 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white">Save</button>
                      <button type="button" onClick={() => void deleteTable(table.id)} className="h-11 rounded-2xl border border-rose-200 px-4 text-sm font-semibold text-rose-700">Delete</button>
                      <div className="ml-auto text-sm text-slate-500">{table.floorName} · {table.seats} seats · {table.status}</div>
                    </div>
                  </div>
                );
              })}
              {tables.length === 0 ? <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">No tables yet.</div> : null}
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Payment settings</h2>
            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">UPI ID</span>
                <input value={settings.upiId} onChange={(event) => setSettings((current) => ({ ...current, upiId: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-cyan-400 focus:bg-white" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[["cash", "Cash"], ["card", "Card / Bank"], ["upi", "UPI QR"]].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={settings[key as keyof Settings] as boolean} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>
              <button onClick={() => window.localStorage.setItem("mindhatch-pos-settings", JSON.stringify(settings))} className="h-12 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white">Save payment settings</button>
            </div>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Sessions</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">Open session: {openSession ? openSession.terminalName : "None"}</div>
              {sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{session.terminalName}</div>
                      <div className="text-sm text-slate-500">{session.status} · {formatCurrency(session.closingSaleAmount)}</div>
                    </div>
                    <div className="text-right text-sm text-slate-700">{new Date(session.openedAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
