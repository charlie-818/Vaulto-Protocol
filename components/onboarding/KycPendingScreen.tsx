"use client";

import { useEffect, useState } from "react";
import { Clock, RefreshCw, XCircle, CheckCircle2 } from "lucide-react";

interface KycPendingScreenProps {
  onApproved: () => void;
  onRejected: () => void;
}

export function KycPendingScreen({ onApproved, onRejected }: KycPendingScreenProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = async () => {
    setIsChecking(true);

    try {
      const response = await fetch("/api/onboarding/kyc/status");
      const data = await response.json();

      setLastChecked(new Date());

      if (data.status === "APPROVED") {
        onApproved();
      } else if (data.status === "REJECTED") {
        onRejected();
      }
    } catch {
      // Ignore errors
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Check status on mount
    checkStatus();

    // Poll every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Verification In Progress
        </h1>

        <p className="mb-6 text-muted">
          Your identity verification is being reviewed. This typically takes
          5-10 minutes but may take longer during peak times.
        </p>

        <div className="mb-6 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Status</span>
            <span className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
              </span>
              Under Review
            </span>
          </div>
          {lastChecked && (
            <p className="mt-2 text-xs text-muted">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="space-y-4 text-left">
          <h3 className="font-medium">What&apos;s happening:</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-muted">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
              <span>Documents uploaded successfully</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-muted">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
              <span>Liveness check completed</span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-amber-500 flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
              </div>
              <span className="text-foreground">Verification in progress</span>
            </li>
          </ul>
        </div>

        <button
          onClick={checkStatus}
          disabled={isChecking}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-medium text-foreground transition-colors hover:bg-border/50 disabled:opacity-50"
        >
          {isChecking ? (
            <>
              <RefreshCw className="h-5 w-5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5" />
              Check Status
            </>
          )}
        </button>

        <p className="mt-4 text-xs text-muted">
          We&apos;ll automatically notify you when the verification is complete.
          You can safely close this page and return later.
        </p>
      </div>
    </div>
  );
}

export function KycRejectedScreen() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">
          Verification Unsuccessful
        </h1>

        <p className="mb-6 text-muted">
          We were unable to verify your identity. This could be due to:
        </p>

        <ul className="mb-6 space-y-2 text-left text-sm text-muted">
          <li>- Unclear or illegible document photos</li>
          <li>- Documents not matching the required criteria</li>
          <li>- Failed liveness verification</li>
          <li>- Information mismatch with records</li>
        </ul>

        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-blue-700 dark:text-blue-400 text-left">
          <p className="text-sm">
            <strong>What you can do:</strong> You may submit a new verification
            request with clearer documents. If you believe this is an error,
            please contact our support team.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
          >
            Try Again
          </button>

          <a
            href="mailto:support@vaulto.ai"
            className="block w-full rounded-lg border border-border px-6 py-3 font-medium text-foreground transition-colors hover:bg-border/50"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
