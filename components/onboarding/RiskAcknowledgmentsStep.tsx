"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

interface RiskAcknowledgmentsStepProps {
  onComplete: () => void;
}

interface Acknowledgment {
  key: string;
  title: string;
  text: string;
}

interface AcknowledgmentData {
  documentVersion: string;
  acknowledgments: Acknowledgment[];
  existingAcknowledgment: { signedAt: string } | null;
}

export function RiskAcknowledgmentsStep({
  onComplete,
}: RiskAcknowledgmentsStepProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AcknowledgmentData | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchAcknowledgments = async () => {
      try {
        const response = await fetch("/api/onboarding/acknowledgments");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load acknowledgments");
        }

        setData(result);

        if (result.existingAcknowledgment) {
          onComplete();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAcknowledgments();
  }, [onComplete]);

  const handleCheck = (key: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allChecked =
    data?.acknowledgments.every((ack) => checkedItems[ack.key]) ?? false;

  const handleSubmit = async () => {
    if (!allChecked) {
      setError("Please acknowledge all risk disclosures");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Generate signature hash
      const encoder = new TextEncoder();
      const dataStr = JSON.stringify(checkedItems) + Date.now();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(dataStr)
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signatureHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const response = await fetch("/api/onboarding/acknowledgments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acknowledgesVolatility: checkedItems["acknowledgesVolatility"],
          acknowledgesLiquidityRisk: checkedItems["acknowledgesLiquidityRisk"],
          acknowledgesRegulatoryRisk: checkedItems["acknowledgesRegulatoryRisk"],
          acknowledgesNoInsurance: checkedItems["acknowledgesNoInsurance"],
          acknowledgesLossRisk: checkedItems["acknowledgesLossRisk"],
          acknowledgesExperimental: checkedItems["acknowledgesExperimental"],
          acknowledgesRegSCompliance: checkedItems["acknowledgesRegSCompliance"],
          acknowledgesTransferRestrictions:
            checkedItems["acknowledgesTransferRestrictions"],
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
        <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="mt-4 text-2xl font-semibold">Risk Acknowledgments</h2>
        <p className="mt-2 text-muted">
          Please read and acknowledge the following risk disclosures
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          <strong>Important:</strong> Trading synthetic securities tokens involves
          significant risk. Please carefully read each disclosure below before
          proceeding.
        </p>
      </div>

      <div className="space-y-4">
        {data?.acknowledgments.map((ack) => (
          <div
            key={ack.key}
            className={`rounded-lg border p-4 transition-colors cursor-pointer ${
              checkedItems[ack.key]
                ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                : "border-border hover:border-foreground/50"
            }`}
            onClick={() => handleCheck(ack.key)}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-5 w-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                  checkedItems[ack.key]
                    ? "border-green-500 bg-green-500"
                    : "border-muted"
                }`}
              >
                {checkedItems[ack.key] && (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-foreground">{ack.title}</h3>
                <p className="mt-1 text-sm text-muted">{ack.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Acknowledgments completed</span>
          <span className="font-medium">
            {Object.values(checkedItems).filter(Boolean).length} /{" "}
            {data?.acknowledgments.length || 0}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{
              width: `${
                (Object.values(checkedItems).filter(Boolean).length /
                  (data?.acknowledgments.length || 1)) *
                100
              }%`,
            }}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !allChecked}
        className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Submitting...
          </span>
        ) : (
          "I Acknowledge All Risks"
        )}
      </button>

      <p className="text-center text-xs text-muted">
        By clicking above, you confirm that you have read, understood, and agree
        to all risk disclosures. Document version: {data?.documentVersion}
      </p>
    </div>
  );
}
