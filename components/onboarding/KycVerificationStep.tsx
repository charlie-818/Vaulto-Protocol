"use client";

import { useState, useEffect } from "react";
import { UserCheck, FileText, Camera, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface KycVerificationStepProps {
  onComplete: () => void;
  onRejected: () => void;
}

type KycState = "init" | "loading" | "ready" | "pending" | "in_review" | "error";

export function KycVerificationStep({
  onComplete,
  onRejected,
}: KycVerificationStepProps) {
  const [state, setState] = useState<KycState>("init");
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const initializeKyc = async () => {
    setState("loading");
    setError(null);

    try {
      // Initialize KYC
      const initResponse = await fetch("/api/onboarding/kyc/init", {
        method: "POST",
      });
      const initData = await initResponse.json();

      if (!initResponse.ok) {
        throw new Error(initData.error || "Failed to initialize KYC");
      }

      // Get access token
      const tokenResponse = await fetch("/api/onboarding/kyc/token", {
        method: "POST",
      });
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData.error || "Failed to get access token");
      }

      setAccessToken(tokenData.token);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setState("error");
    }
  };

  const checkStatus = async () => {
    try {
      const response = await fetch("/api/onboarding/kyc/status");
      const data = await response.json();

      if (data.status === "APPROVED") {
        onComplete();
      } else if (data.status === "REJECTED") {
        onRejected();
      } else if (data.status === "IN_REVIEW") {
        setState("in_review");
      }
    } catch {
      // Ignore status check errors
    }
  };

  useEffect(() => {
    // Check status periodically when in review
    if (state === "in_review") {
      const interval = setInterval(checkStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [state]);

  const handleSumsubComplete = () => {
    setState("pending");
    // Check status after completion
    setTimeout(checkStatus, 2000);
  };

  if (state === "init") {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <UserCheck className="mx-auto h-12 w-12 text-foreground" />
          <h2 className="mt-4 text-2xl font-semibold">Identity Verification</h2>
          <p className="mt-2 text-muted">
            Complete KYC/AML verification to continue
          </p>
        </div>

        <div className="rounded-lg border border-border p-6 space-y-4">
          <h3 className="font-medium">What you&apos;ll need:</h3>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <FileText className="h-5 w-5 flex-shrink-0 text-foreground" />
              <span>
                <strong>Government-issued ID</strong> - Passport, national ID card,
                or driver&apos;s license
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Camera className="h-5 w-5 flex-shrink-0 text-foreground" />
              <span>
                <strong>Selfie verification</strong> - A clear photo of your face
                for liveness check
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-blue-700 dark:text-blue-400">
          <p className="text-sm">
            <strong>Privacy:</strong> Your personal information is handled securely
            by our KYC partner, Sumsub. We only receive verification status and do
            not store copies of your documents.
          </p>
        </div>

        <button
          onClick={initializeKyc}
          className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
        >
          Start Verification
        </button>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-foreground" />
          <p className="mt-4 text-muted">Preparing verification...</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
          <AlertCircle className="h-6 w-6 flex-shrink-0" />
          <div>
            <p className="font-medium">Verification Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>

        <button
          onClick={initializeKyc}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
        >
          <RefreshCw className="h-5 w-5" />
          Try Again
        </button>
      </div>
    );
  }

  if (state === "ready" && accessToken) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <UserCheck className="mx-auto h-12 w-12 text-foreground" />
          <h2 className="mt-4 text-2xl font-semibold">Complete Verification</h2>
          <p className="mt-2 text-muted">
            Follow the instructions to verify your identity
          </p>
        </div>

        {/* In production, this would embed the Sumsub WebSDK */}
        <div className="rounded-lg border border-border p-8 text-center bg-gray-50 dark:bg-gray-900/50">
          <div className="space-y-4">
            <FileText className="mx-auto h-16 w-16 text-muted" />
            <p className="text-muted">
              Sumsub verification widget would appear here
            </p>
            <p className="text-sm text-muted">
              Access Token: {accessToken.substring(0, 20)}...
            </p>

            {/* Mock completion button for development */}
            {process.env.NODE_ENV === "development" && (
              <button
                onClick={handleSumsubComplete}
                className="mt-4 rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition-opacity hover:opacity-90"
              >
                [Dev] Simulate Completion
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-muted">
          Having trouble? Make sure to allow camera access and use good lighting.
        </p>
      </div>
    );
  }

  if (state === "pending" || state === "in_review") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Loader2 className="h-10 w-10 animate-spin text-amber-600 dark:text-amber-400" />
          </div>

          <h2 className="mb-2 text-2xl font-semibold">Verification In Progress</h2>
          <p className="mb-6 text-muted">
            {state === "pending"
              ? "Your documents have been submitted and are being processed."
              : "Your verification is under review. This typically takes a few minutes."}
          </p>

          <div className="rounded-lg border border-border p-4 text-left">
            <h3 className="mb-2 font-medium">What happens next?</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li>1. Our system automatically verifies your documents</li>
              <li>2. A compliance officer reviews the results</li>
              <li>3. You&apos;ll receive the result within minutes</li>
            </ul>
          </div>

          <button
            onClick={checkStatus}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 font-medium text-foreground transition-colors hover:bg-border/50"
          >
            <RefreshCw className="h-5 w-5" />
            Check Status
          </button>
        </div>
      </div>
    );
  }

  return null;
}
