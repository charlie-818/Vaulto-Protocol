"use client";

import { useState } from "react";
import { Clock, Shield, AlertCircle, Loader2, Calendar } from "lucide-react";

interface CompliancePeriodStepProps {
  onComplete: () => void;
}

export function CompliancePeriodStep({ onComplete }: CompliancePeriodStepProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const handleActivate = async () => {
    if (!agreed) {
      setError("Please acknowledge the compliance period terms");
      return;
    }

    setIsActivating(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to activate compliance period");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsActivating(false);
    }
  };

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 40);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Clock className="mx-auto h-12 w-12 text-foreground" />
        <h2 className="mt-4 text-2xl font-semibold">40-Day Compliance Period</h2>
        <p className="mt-2 text-muted">
          Activate your Regulation S compliance period
        </p>
      </div>

      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">What is the Compliance Period?</h3>
        <p className="text-sm text-muted">
          Under Regulation S, there is a 40-day distribution compliance period
          during which certain transfer restrictions apply. This period begins
          when you activate your account.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-background border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-5 w-5 text-muted" />
              <span className="text-sm text-muted">Start Date</span>
            </div>
            <p className="font-medium">
              {startDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="rounded-lg bg-background border border-border p-4">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-5 w-5 text-muted" />
              <span className="text-sm text-muted">End Date</span>
            </div>
            <p className="font-medium">
              {endDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-6 space-y-4">
        <h3 className="font-medium">During this period:</h3>
        <ul className="space-y-3 text-sm text-muted">
          <li className="flex items-start gap-3">
            <Shield className="h-5 w-5 flex-shrink-0 text-green-500" />
            <span>
              <strong>Full trading access</strong> - You can trade, mint, and
              participate in all platform features
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Shield className="h-5 w-5 flex-shrink-0 text-amber-500" />
            <span>
              <strong>Transfer restrictions</strong> - Transfers to addresses
              outside the platform require compliance verification
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Shield className="h-5 w-5 flex-shrink-0 text-green-500" />
            <span>
              <strong>After 40 days</strong> - Transfer restrictions are lifted
              for fully verified accounts
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-blue-700 dark:text-blue-400">
        <p className="text-sm">
          <strong>Why 40 days?</strong> The Securities Act requires this
          compliance period for Regulation S offerings to ensure securities are
          not being sold to U.S. Persons. This protects both you and the platform.
        </p>
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="agree-compliance"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-border"
        />
        <label htmlFor="agree-compliance" className="text-sm text-muted">
          I understand and agree to the 40-day compliance period. I acknowledge
          that transfer restrictions will apply during this period, and I will
          not attempt to transfer tokens to U.S. Persons or circumvent these
          restrictions.
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleActivate}
        disabled={isActivating || !agreed}
        className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isActivating ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Activating...
          </span>
        ) : (
          "Activate My Account"
        )}
      </button>
    </div>
  );
}
