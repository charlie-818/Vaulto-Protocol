"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { OnboardingProgress, type OnboardingStep } from "./OnboardingProgress";
import { GeoVerificationStep } from "./GeoVerificationStep";
import { GeoBlockedScreen } from "./GeoBlockedScreen";
import { KycVerificationStep } from "./KycVerificationStep";
import { KycPendingScreen, KycRejectedScreen } from "./KycPendingScreen";
import { WalletVerificationStep } from "./WalletVerificationStep";
import { SourceOfFundsStep } from "./SourceOfFundsStep";
import { RiskAcknowledgmentsStep } from "./RiskAcknowledgmentsStep";
import { CompliancePeriodStep } from "./CompliancePeriodStep";
import { OnboardingComplete } from "./OnboardingComplete";
import type { OnboardingStatusResponse } from "@/app/api/onboarding/status/route";

type WizardState =
  | "loading"
  | "geo"
  | "geo_blocked"
  | "kyc"
  | "kyc_pending"
  | "kyc_rejected"
  | "wallet"
  | "wallet_rejected"
  | "source_of_funds"
  | "acknowledgments"
  | "compliance"
  | "complete";

export function OnboardingWizard() {
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<WizardState>("loading");
  const [blockReason, setBlockReason] = useState<string>("");
  const [compliancePeriod, setCompliancePeriod] = useState<{
    startDate: string;
    endDate: string;
    daysRemaining: number;
  } | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/onboarding/status");
      const data: OnboardingStatusResponse = await response.json();

      if (data.isFullyOnboarded) {
        setCompliancePeriod(
          data.steps.compliancePeriod.startDate
            ? {
                startDate: data.steps.compliancePeriod.startDate,
                endDate: data.steps.compliancePeriod.endDate!,
                daysRemaining: data.steps.compliancePeriod.daysRemaining!,
              }
            : null
        );
        setState("complete");
        return;
      }

      // Determine state based on status
      switch (data.nextStep) {
        case "BLOCKED":
          setBlockReason("US_INVESTOR");
          setState("geo_blocked");
          break;
        case "GEO_VERIFICATION":
          setState("geo");
          break;
        case "KYC_VERIFICATION":
          setState("kyc");
          break;
        case "KYC_PENDING":
          setState("kyc_pending");
          break;
        case "KYC_REJECTED":
          setState("kyc_rejected");
          break;
        case "WALLET_VERIFICATION":
          setState("wallet");
          break;
        case "SOURCE_OF_FUNDS":
          setState("source_of_funds");
          break;
        case "RISK_ACKNOWLEDGMENTS":
          setState("acknowledgments");
          break;
        case "COMPLIANCE_PERIOD":
        case "COMPLIANCE_PERIOD_ACTIVE":
          if (data.steps.compliancePeriod.active) {
            setCompliancePeriod({
              startDate: data.steps.compliancePeriod.startDate!,
              endDate: data.steps.compliancePeriod.endDate!,
              daysRemaining: data.steps.compliancePeriod.daysRemaining!,
            });
            setState("complete");
          } else {
            setState("compliance");
          }
          break;
        default:
          setState("geo");
      }
    } catch (error) {
      console.error("Failed to fetch onboarding status:", error);
      setState("geo");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getCompletedSteps = (): OnboardingStep[] => {
    const completed: OnboardingStep[] = [];
    const stateOrder: WizardState[] = [
      "geo",
      "kyc",
      "wallet",
      "source_of_funds",
      "acknowledgments",
      "compliance",
    ];
    const stepMap: Record<WizardState, OnboardingStep> = {
      geo: "geo",
      geo_blocked: "geo",
      kyc: "kyc",
      kyc_pending: "kyc",
      kyc_rejected: "kyc",
      wallet: "wallet",
      wallet_rejected: "wallet",
      source_of_funds: "source_of_funds",
      acknowledgments: "acknowledgments",
      compliance: "compliance",
      complete: "compliance",
      loading: "geo",
    };

    const currentIndex = stateOrder.indexOf(state as WizardState);

    for (let i = 0; i < currentIndex && i < stateOrder.length; i++) {
      const stepState = stateOrder[i];
      const step = stepMap[stepState];
      if (step && !completed.includes(step)) {
        completed.push(step);
      }
    }

    return completed;
  };

  const getCurrentStep = (): OnboardingStep => {
    const stepMap: Record<WizardState, OnboardingStep> = {
      loading: "geo",
      geo: "geo",
      geo_blocked: "geo",
      kyc: "kyc",
      kyc_pending: "kyc",
      kyc_rejected: "kyc",
      wallet: "wallet",
      wallet_rejected: "wallet",
      source_of_funds: "source_of_funds",
      acknowledgments: "acknowledgments",
      compliance: "compliance",
      complete: "compliance",
    };
    return stepMap[state];
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (state === "geo_blocked") {
    return <GeoBlockedScreen reason={blockReason} />;
  }

  if (state === "kyc_rejected") {
    return <KycRejectedScreen />;
  }

  if (state === "wallet_rejected") {
    return (
      <div className="max-w-2xl mx-auto">
        <GeoBlockedScreen reason="WALLET_HIGH_RISK" />
      </div>
    );
  }

  if (state === "complete") {
    return <OnboardingComplete compliancePeriod={compliancePeriod || undefined} />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <OnboardingProgress
        currentStep={getCurrentStep()}
        completedSteps={getCompletedSteps()}
      />

      <div className="rounded-xl border border-border bg-background p-6 md:p-8">
        {state === "geo" && (
          <GeoVerificationStep
            onComplete={() => setState("kyc")}
            onBlocked={(reason) => {
              setBlockReason(reason);
              setState("geo_blocked");
            }}
          />
        )}

        {state === "kyc" && (
          <KycVerificationStep
            onComplete={() => setState("wallet")}
            onRejected={() => setState("kyc_rejected")}
          />
        )}

        {state === "kyc_pending" && (
          <KycPendingScreen
            onApproved={() => setState("wallet")}
            onRejected={() => setState("kyc_rejected")}
          />
        )}

        {state === "wallet" && (
          <WalletVerificationStep
            onComplete={() => setState("source_of_funds")}
            onRejected={(reason) => {
              setBlockReason(reason);
              setState("wallet_rejected");
            }}
          />
        )}

        {state === "source_of_funds" && (
          <SourceOfFundsStep onComplete={() => setState("acknowledgments")} />
        )}

        {state === "acknowledgments" && (
          <RiskAcknowledgmentsStep onComplete={() => setState("compliance")} />
        )}

        {state === "compliance" && (
          <CompliancePeriodStep
            onComplete={() => {
              fetchStatus();
            }}
          />
        )}
      </div>
    </div>
  );
}
