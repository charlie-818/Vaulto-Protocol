"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CurrentUserStats, WaitlistLeaderboard } from "./waitlist";

interface WaitlistSuccessProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  userData?: {
    createdAt: string;
    bonusPoints: number;
    hasSharedToX: boolean;
  } | null;
}

export function WaitlistSuccess({ user, userData }: WaitlistSuccessProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-[var(--background)]">
      {/* Animated gradient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-gradient-shift absolute -inset-[100%] opacity-30">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 blur-3xl" />
        </div>
      </div>

      {/* Floating orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-float-1 absolute left-[10%] top-[20%] h-64 w-64 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="animate-float-2 absolute right-[15%] top-[60%] h-96 w-96 rounded-full bg-gradient-to-br from-purple-500/10 to-cyan-500/10 blur-3xl" />
        <div className="animate-float-3 absolute bottom-[20%] left-[60%] h-72 w-72 rounded-full bg-gradient-to-br from-cyan-500/10 to-blue-500/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-6 py-12">
        {/* Logo */}
        <div className="animate-scale-in mb-12">
          {mounted && (
            <Image
              src={isDark ? "/vaulto-logo-dark.png" : "/vaulto-logo-light.png"}
              alt="Vaulto"
              width={180}
              height={48}
              priority
              className="h-12 w-auto"
            />
          )}
        </div>

        {/* Success message */}
        <h1 className="animate-fade-in-up animation-delay-200 mb-6 text-center text-3xl font-light text-[var(--foreground)] sm:text-4xl">
          You&apos;re on the list
        </h1>

        <p className="animate-fade-in-up animation-delay-300 mb-8 max-w-md text-center text-[var(--muted)]">
          We&apos;ll notify{" "}
          <span className="text-[var(--foreground)]">{user.email}</span> when
          Vaulto is ready.
        </p>

        {/* Stats and Leaderboard */}
        {userData && (
          <div className="animate-fade-in-up animation-delay-400 w-full space-y-6">
            <CurrentUserStats />
            <WaitlistLeaderboard />
          </div>
        )}

        {/* Subtle animated line */}
        <div className="animate-fade-in-up animation-delay-400 mt-12 h-px w-32 overflow-hidden bg-[var(--border)]">
          <div className="animate-shimmer h-full w-full bg-gradient-to-r from-transparent via-[var(--foreground)] to-transparent opacity-50" />
        </div>
      </div>
    </div>
  );
}
