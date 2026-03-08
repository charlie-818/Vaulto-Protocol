"use client";

import { XCircle, ShieldX, AlertTriangle } from "lucide-react";

interface GeoBlockedScreenProps {
  reason: string;
}

const BLOCK_REASONS: Record<string, { title: string; description: string }> = {
  US_INVESTOR: {
    title: "Service Unavailable in Your Region",
    description:
      "Vaulto Protocol is not available to U.S. Persons under Regulation S. This includes U.S. citizens, residents, and entities organized under U.S. law, regardless of their current location.",
  },
  SANCTIONED_COUNTRY: {
    title: "Service Unavailable in Your Region",
    description:
      "Vaulto Protocol is not available in your jurisdiction due to international sanctions or regulatory restrictions.",
  },
  VPN_DETECTED: {
    title: "VPN Usage Detected",
    description:
      "We detected that you may be using a VPN, proxy, or similar service. To ensure regulatory compliance, please disable any VPN services and try again from your actual location.",
  },
  PROXY_DETECTED: {
    title: "Proxy Usage Detected",
    description:
      "We detected that your connection may be routed through a proxy server. Please connect directly without proxy services and try again.",
  },
  TOR_DETECTED: {
    title: "Tor Network Detected",
    description:
      "We detected that you may be using the Tor network. To ensure regulatory compliance, please use a standard internet connection and try again.",
  },
};

export function GeoBlockedScreen({ reason }: GeoBlockedScreenProps) {
  const blockInfo = BLOCK_REASONS[reason] || {
    title: "Access Restricted",
    description:
      "We are unable to provide services in your current location due to regulatory requirements.",
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          {reason === "US_INVESTOR" || reason === "SANCTIONED_COUNTRY" ? (
            <ShieldX className="h-10 w-10 text-red-600 dark:text-red-400" />
          ) : (
            <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
          )}
        </div>

        <h1 className="mb-4 text-2xl font-bold text-foreground">
          {blockInfo.title}
        </h1>

        <p className="mb-6 text-muted">{blockInfo.description}</p>

        <div className="rounded-lg border border-border bg-background p-4 text-left">
          <h3 className="mb-2 font-medium text-foreground">
            Why am I seeing this?
          </h3>
          <p className="text-sm text-muted">
            Vaulto Protocol offers synthetic securities tokens under Regulation S,
            which requires us to ensure that our services are not accessed by U.S.
            Persons or from restricted jurisdictions. We take compliance seriously
            to protect both our users and the integrity of our platform.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {(reason === "VPN_DETECTED" ||
            reason === "PROXY_DETECTED" ||
            reason === "TOR_DETECTED") && (
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
            >
              Try Again
            </button>
          )}

          <a
            href="mailto:compliance@vaulto.ai"
            className="block w-full rounded-lg border border-border px-6 py-3 font-medium text-foreground transition-colors hover:bg-border/50"
          >
            Contact Support
          </a>
        </div>

        <p className="mt-6 text-xs text-muted">
          If you believe this is an error, please contact our compliance team at{" "}
          <a
            href="mailto:compliance@vaulto.ai"
            className="text-foreground underline"
          >
            compliance@vaulto.ai
          </a>
        </p>
      </div>
    </div>
  );
}
