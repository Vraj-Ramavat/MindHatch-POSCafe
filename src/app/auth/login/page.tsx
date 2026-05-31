import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { safeAuth } from "@/auth";
import { ensureDemoAuthUser } from "@/lib/demo-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  await ensureDemoAuthUser();
  const session = await safeAuth();
  const { callbackUrl } = await searchParams;

  if (session?.user) {
    redirect(callbackUrl ?? "/terminal");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-6">
      <section className="rounded-[1.75rem] border border-cyan-200 bg-cyan-50 p-5 text-center shadow-sm">
        <div className="flex justify-center">
          <img src="/MindHatch Logo.png" alt="MindHatch logo" className="h-20 w-20 rounded-[1.5rem] object-contain shadow-sm" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-800">Customer access</p>
        <p className="mt-3 text-base font-medium text-slate-950">
          If customer no need to login directly go to Customer page
        </p>
        <Link
          href="/customer"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600"
        >
          Go to Customer Page
        </Link>
      </section>

      <LoginForm callbackUrl={callbackUrl ?? "/terminal"} />
    </main>
  );
}