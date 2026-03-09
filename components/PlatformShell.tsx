"use client";

import { useSession } from "next-auth/react";
import { Sidebar } from "./Sidebar";
import { ThemeSwitch } from "./ThemeSwitch";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { Footer } from "./Footer";

interface PlatformShellProps {
  children: React.ReactNode;
}

export function PlatformShell({ children }: PlatformShellProps) {
  const { data: session, status } = useSession();

  // Show loading state briefly to prevent flash
  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  // Only show platform UI (sidebar, header, footer) for Vaulto employees
  const showPlatformUI = session?.user?.isVaultoEmployee === true;

  if (!showPlatformUI) {
    // Non-employees get a minimal layout with just theme toggle
    return (
      <div className="flex min-h-screen flex-col">
        <header className="fixed right-0 top-0 z-20 flex items-center gap-3 pr-6 pt-6">
          <ThemeSwitch />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  // Vaulto employees get full platform UI
  return (
    <div className="flex min-h-screen flex-col">
      <Sidebar />
      <header className="fixed right-0 top-0 z-20 flex items-center gap-3 pr-6 pt-14 md:pt-14">
        <ThemeSwitch />
        <ConnectWalletButton />
      </header>
      <main className="ml-0 flex-1 p-8 pt-28 md:ml-48 md:pt-14">{children}</main>
      <div className="md:ml-48">
        <Footer />
      </div>
    </div>
  );
}
