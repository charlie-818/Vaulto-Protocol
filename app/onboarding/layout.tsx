import type { Metadata } from "next";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Onboarding | Vaulto Protocol",
  description: "Complete your Vaulto Protocol onboarding to start trading synthetic private company tokens.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed right-0 top-0 z-20 flex items-center gap-3 pr-6 pt-6">
        <ThemeSwitch />
      </header>

      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-center py-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background font-bold text-lg">V</span>
            </div>
            <span className="text-xl font-semibold">Vaulto</span>
          </Link>
        </div>

        <main className="flex-1 px-4 pb-12">{children}</main>

        <footer className="py-6 text-center text-sm text-muted">
          <p>
            Questions?{" "}
            <a href="mailto:support@vaulto.ai" className="text-foreground underline">
              Contact Support
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
