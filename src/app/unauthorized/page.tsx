import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-16 text-center">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-600">Access denied</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">You do not have permission to view this page.</h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          Switch to an admin, manager, or kitchen account depending on the area you need to use.
        </p>
        <Link href="/auth/login" className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white">
          Back to login
        </Link>
      </section>
    </main>
  );
}