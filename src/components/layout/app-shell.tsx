"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { ToastProvider } from "@/components/ui/toast";
import { WhatsAppConnectionReminder } from "@/components/whatsapp/whatsapp-connection-reminder";
import type { NavSection } from "@/lib/nav";

const COLLAPSE_STORAGE_KEY = "gatti-crm:sidebar-collapsed";

/**
 * Owns the mobile-drawer open/close state and the desktop collapse state
 * that Sidebar and Topbar need to share (hamburger button in Topbar opens
 * the drawer Sidebar renders) — has to be a Client Component for that, so
 * the actual data fetching and permission filtering stays in the
 * server-side layout.tsx above it.
 */
export function AppShell({
  sections,
  name,
  role,
  canCall,
  children,
}: {
  sections: NavSection[];
  name: string;
  role: string;
  /** Whether this user places calls — only they need a linked WhatsApp. */
  canCall: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Read the saved preference after mount only — keeps server/client HTML
  // identical on first paint (localStorage isn't available server-side),
  // so this genuinely can't be a lazy useState initializer without
  // risking a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true");
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-slate-50">
        <Sidebar
          sections={sections}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          collapsed={hydrated && collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar name={name} role={role} onMenuClick={() => setMobileOpen(true)} onSearchClick={() => setSearchOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {/* Keyed on the route so each navigation replays a short fade-rise —
                just enough continuity to signal "new page", never a wait. */}
            <div key={pathname} className="motion-page">
              {children}
            </div>
          </main>
        </div>
      </div>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      <WhatsAppConnectionReminder enabled={canCall} />
    </ToastProvider>
  );
}
