"use client";

import { LogOut, Menu, Search } from "lucide-react";
import { logoutAction } from "@/app/(app)/actions";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function Topbar({
  name,
  role,
  onMenuClick,
  onSearchClick,
}: {
  name: string;
  role: string;
  onMenuClick: () => void;
  onSearchClick: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
        title="Open menu"
      >
        <Menu size={20} />
      </button>

      <button
        onClick={onSearchClick}
        className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-400 transition hover:border-slate-300 hover:text-slate-500"
      >
        <Search size={14} />
        <span className="hidden sm:inline">Search leads, dealers…</span>
        <span className="tnum ml-auto hidden items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:flex">
          ⌘K
        </span>
      </button>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials(name)}
          </div>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium text-slate-900">{name}</p>
            <p className="text-xs text-slate-400">{role.replaceAll("_", " ")}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Sign out"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 sm:px-3"
          >
            <LogOut size={14} strokeWidth={2} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
