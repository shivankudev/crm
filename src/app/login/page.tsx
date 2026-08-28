import { redirect } from "next/navigation";
import { Zap, ShieldCheck, PhoneCall, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LoginForm } from "@/app/login/login-form";

const HIGHLIGHTS = [
  { icon: PhoneCall, text: "Daily calling queue, follow-ups scheduled for you" },
  { icon: TrendingUp, text: "Live pipeline, reports, and team performance" },
  { icon: ShieldCheck, text: "Role-based access for every team member" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen bg-slate-50">
      {/* Brand panel — hidden on small screens, shown from md up */}
      <div className="from-brand-600 to-brand-800 relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br p-10 text-white md:flex lg:p-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <Zap size={19} strokeWidth={2.25} fill="currentColor" />
          </div>
          <div>
            <p className="text-sm leading-tight font-semibold">Gatti E-Rickshaw</p>
            <p className="text-xs leading-tight text-white/70">CRM</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight lg:text-4xl">
            Run your entire sales floor from one screen.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-white/75">
            Leads, follow-ups, dealers, and reporting — built for how your team actually sells e-rickshaws.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <h.icon size={15} strokeWidth={2.25} />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Gatti E-Rickshaw</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 md:hidden">
            <div className="from-brand-500 to-brand-700 shadow-brand-500/30 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm">
              <Zap size={18} strokeWidth={2.25} fill="currentColor" />
            </div>
            <div>
              <p className="text-sm leading-tight font-semibold text-slate-900">Gatti E-Rickshaw</p>
              <p className="text-xs leading-tight text-slate-400">CRM</p>
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to your account to continue.</p>
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
