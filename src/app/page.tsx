const metrics = [
  { value: "24/7", label: "session-ready operations" },
  { value: "4", label: "payment paths at checkout" },
  { value: "6", label: "core flows in one workspace" },
  { value: "1", label: "real-time kitchen feed" },
];

const modules = [
  "Table-first ordering with floor cards and quick register actions",
  "Multiple payment methods: Cash, Card/Bank, and UPI QR",
  "Kitchen Display with To Cook, Preparing, and Completed stages",
  "Customer Display for clear payment and order transparency",
  "Sales reporting with period, session, responsible, and product filters",
  "Optional token-based self ordering and booking-ready expansion",
];

const flowSteps = [
  "Sign in, configure products, payments, floors, and tables",
  "Open a POS session and select a table from the floor plan",
  "Build the order, send it to kitchen, then complete payment",
  "Review dashboard reports and session totals after closing the register",
];

const stacks = [
  "Next.js 16 App Router",
  "Tailwind CSS UI system",
  "Prisma + PostgreSQL / SQLite",
  "TanStack Query for live sync",
  "NextAuth v5 and RBAC",
  "PDF / Excel export support",
];

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6 sm:px-8 lg:px-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1220] text-white shadow-[0_28px_120px_rgba(2,6,23,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(31,148,255,0.28),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,145,77,0.24),transparent_30%),linear-gradient(135deg,rgba(6,11,23,0.98),rgba(13,20,39,0.94))]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35" />

          <div className="relative grid gap-10 px-6 py-8 lg:grid-cols-[1.3fr_0.7fr] lg:px-10 lg:py-10">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-white/5 px-4 py-2 text-sm text-cyan-100 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.12)]" />
                MindHatch CafePOS
              </div>

              <div className="max-w-3xl space-y-5">
                <p className="text-sm uppercase tracking-[0.32em] text-cyan-200/75">
                  Restaurant POS for fast service and clean kitchen handoff
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  A table-first cafe POS that moves from order to kitchen to payment without friction.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  MindHatch CafePOS is designed for restaurant staff, kitchen teams, and customer-facing displays.
                  It combines floor/table ordering, payment flexibility, live order routing, and reporting in one
                  clean web app.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#modules"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Explore modules
                </a>
                <a
                  href="#flow"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  View end-to-end flow
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <article
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm"
                  >
                    <div className="text-2xl font-semibold text-white">{metric.value}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{metric.label}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="grid gap-4 self-start rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-5 backdrop-blur-sm">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-amber-200/80">Operational snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Session, table, and payment at a glance</h2>
              </div>

              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Register status</span>
                  <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-emerald-300">Open</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Open table</span>
                  <span className="font-medium text-white">Table 6</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Payment options</span>
                  <span className="font-medium text-white">Cash / Card / UPI</span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Kitchen stage</span>
                  <span className="font-medium text-white">To Cook</span>
                </div>
              </div>

              <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-200/80">Included displays</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                  <li>Customer-facing status board</li>
                  <li>Kitchen ticket feed with item completion states</li>
                  <li>Reporting dashboard with export-ready summaries</li>
                </ul>
              </div>
            </aside>
          </div>
        </section>

        <section id="modules" className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.26em] text-cyan-700">Feature scope</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Built around the complete restaurant POS loop.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
              The app is organized to support backend configuration, front-of-house order taking, kitchen routing,
              customer transparency, and post-shift reporting without leaving the same workspace.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {stacks.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {modules.map((module) => (
              <article
                key={module}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="mb-4 h-10 w-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600" />
                <p className="text-base leading-7 text-slate-700">{module}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="flow" className="mt-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.26em] text-amber-600">End-to-end flow</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                The cashier, kitchen, and customer screens stay in sync.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              The first version focuses on the operational backbone. Each screen can later be wired to live API
              routes, Prisma models, and role-based actions without changing the app structure.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            {flowSteps.map((step, index) => (
              <article key={step} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                  0{index + 1}
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">{step}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
