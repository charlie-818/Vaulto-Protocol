"use client";

import { useState, useEffect } from "react";
import { Banknote, AlertCircle, Loader2 } from "lucide-react";

interface SourceOfFundsStepProps {
  onComplete: () => void;
}

interface TemplateData {
  declarationText: string;
  primarySources: string[];
  netWorthRanges: string[];
  tradingVolumeRanges: string[];
  existingDeclaration: {
    primarySource: string;
    isApproved: boolean;
  } | null;
}

const SOURCE_LABELS: Record<string, string> = {
  employment: "Employment / Salary",
  self_employment: "Self-Employment",
  business_ownership: "Business Ownership",
  investments: "Investment Returns",
  inheritance: "Inheritance",
  gift: "Gift",
  pension: "Pension / Retirement",
  savings: "Personal Savings",
  crypto_trading: "Cryptocurrency Trading",
  other: "Other",
};

const NET_WORTH_LABELS: Record<string, string> = {
  under_10k: "Under $10,000",
  "10k_50k": "$10,000 - $50,000",
  "50k_100k": "$50,000 - $100,000",
  "100k_500k": "$100,000 - $500,000",
  "500k_1m": "$500,000 - $1,000,000",
  "1m_5m": "$1,000,000 - $5,000,000",
  over_5m: "Over $5,000,000",
};

const VOLUME_LABELS: Record<string, string> = {
  under_1k: "Under $1,000 / month",
  "1k_10k": "$1,000 - $10,000 / month",
  "10k_50k": "$10,000 - $50,000 / month",
  "50k_100k": "$50,000 - $100,000 / month",
  "100k_500k": "$100,000 - $500,000 / month",
  over_500k: "Over $500,000 / month",
};

export function SourceOfFundsStep({ onComplete }: SourceOfFundsStepProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateData | null>(null);

  const [primarySource, setPrimarySource] = useState("");
  const [secondarySources, setSecondarySources] = useState<string[]>([]);
  const [employerName, setEmployerName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [estimatedNetWorth, setEstimatedNetWorth] = useState("");
  const [expectedTradingVolume, setExpectedTradingVolume] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch("/api/onboarding/source-of-funds");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load form");
        }

        setTemplate(data);

        if (data.existingDeclaration?.isApproved) {
          onComplete();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();
  }, [onComplete]);

  const handleSubmit = async () => {
    if (!primarySource || !estimatedNetWorth || !expectedTradingVolume || !agreed) {
      setError("Please complete all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Generate signature hash
      const encoder = new TextEncoder();
      const data = encoder.encode(
        template?.declarationText + primarySource + Date.now()
      );
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signatureHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const response = await fetch("/api/onboarding/source-of-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primarySource,
          secondarySources,
          employerName: employerName || undefined,
          occupation: occupation || undefined,
          estimatedNetWorth,
          expectedTradingVolume,
          signatureHash,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Submission failed");
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Banknote className="mx-auto h-12 w-12 text-foreground" />
        <h2 className="mt-4 text-2xl font-semibold">Source of Funds</h2>
        <p className="mt-2 text-muted">
          Tell us about the origin of funds you&apos;ll use on Vaulto
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Primary Source of Funds <span className="text-red-500">*</span>
          </label>
          <select
            value={primarySource}
            onChange={(e) => setPrimarySource(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
          >
            <option value="">Select primary source</option>
            {template?.primarySources.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABELS[source] || source}
              </option>
            ))}
          </select>
        </div>

        {(primarySource === "employment" ||
          primarySource === "self_employment") && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">
                Employer / Company Name
              </label>
              <input
                type="text"
                value={employerName}
                onChange={(e) => setEmployerName(e.target.value)}
                placeholder="Company name"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Occupation</label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Your role"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Estimated Net Worth <span className="text-red-500">*</span>
          </label>
          <select
            value={estimatedNetWorth}
            onChange={(e) => setEstimatedNetWorth(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
          >
            <option value="">Select range</option>
            {template?.netWorthRanges.map((range) => (
              <option key={range} value={range}>
                {NET_WORTH_LABELS[range] || range}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Expected Monthly Trading Volume <span className="text-red-500">*</span>
          </label>
          <select
            value={expectedTradingVolume}
            onChange={(e) => setExpectedTradingVolume(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground"
          >
            <option value="">Select range</option>
            {template?.tradingVolumeRanges.map((range) => (
              <option key={range} value={range}>
                {VOLUME_LABELS[range] || range}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <h3 className="font-medium mb-2">Declaration</h3>
        <div className="max-h-32 overflow-y-auto text-sm text-muted whitespace-pre-wrap">
          {template?.declarationText}
        </div>
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="agree-declaration"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-5 w-5 rounded border-border"
        />
        <label htmlFor="agree-declaration" className="text-sm text-muted">
          I confirm that the information provided is accurate and complete. I
          understand that providing false information may result in account
          termination and legal consequences.
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !agreed}
        className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Submitting...
          </span>
        ) : (
          "Submit Declaration"
        )}
      </button>
    </div>
  );
}
