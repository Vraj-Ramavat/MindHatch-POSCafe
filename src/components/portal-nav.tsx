"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";

const pages = [
  { href: "/", label: "Home" },
  { href: "/backend", label: "Backend" },
  { href: "/terminal", label: "Terminal" },
  { href: "/kitchen", label: "Kitchen" },
  { href: "/customer", label: "Customer" },
  { href: "/reports", label: "Reports" },
];

export function PortalNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-slate-950 sm:tracking-[0.28em]"
        >
          <img src="/MindHatch Logo.png" alt="MindHatch logo" className="h-10 w-10 rounded-2xl object-contain" />
          <span className="hidden sm:inline">MindHatch CafePOS</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm text-slate-600">
          <div className="hidden items-center gap-2 sm:flex">
            {pages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="whitespace-nowrap rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {page.label}
              </Link>
            ))}

            <Link
              href="/auth/login"
              className="whitespace-nowrap rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Login
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="whitespace-nowrap rounded-full bg-slate-950 px-3 py-1.5 font-medium text-white transition hover:bg-slate-800"
            >
              Logout
            </button>
          </div>

          <div className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Pages ▾
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-3xl border border-slate-200 bg-white p-2 shadow-xl">
                {pages.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-2xl px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                  >
                    {page.label}
                  </Link>
                ))}

                <div className="my-2 border-t border-slate-200" />

                <Link
                  href="/auth/login"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  Login
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: "/auth/login" });
                  }}
                  className="mt-1 block w-full rounded-2xl bg-slate-950 px-4 py-3 text-left text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}