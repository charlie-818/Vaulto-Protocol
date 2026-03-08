"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export type OnboardingStep =
  | "geo"
  | "kyc"
  | "wallet"
  | "source_of_funds"
  | "acknowledgments"
  | "compliance";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
}

const STEPS: { key: OnboardingStep; label: string }[] = [
  { key: "geo", label: "Location" },
  { key: "kyc", label: "Identity" },
  { key: "wallet", label: "Wallet" },
  { key: "source_of_funds", label: "Source of Funds" },
  { key: "acknowledgments", label: "Risk Disclosure" },
  { key: "compliance", label: "Activation" },
];

export function OnboardingProgress({
  currentStep,
  completedSteps,
}: OnboardingProgressProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.key);
          const isCurrent = currentStep === step.key;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors
                    ${
                      isCompleted
                        ? "border-green-500 bg-green-500 text-white"
                        : isCurrent
                        ? "border-foreground bg-foreground text-background"
                        : "border-muted text-muted"
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isCurrent ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium
                    ${isCurrent ? "text-foreground" : "text-muted"}
                  `}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`
                    mx-2 h-0.5 flex-1 transition-colors
                    ${isCompleted ? "bg-green-500" : "bg-border"}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
