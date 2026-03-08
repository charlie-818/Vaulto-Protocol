"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { OnboardingStatusResponse } from "@/app/api/onboarding/status/route";

export function useOnboardingStatus() {
  const queryClient = useQueryClient();

  const query = useQuery<OnboardingStatusResponse>({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      const response = await fetch("/api/onboarding/status");
      if (!response.ok) {
        throw new Error("Failed to fetch onboarding status");
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const refetch = () => {
    return queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
  };

  return {
    status: query.data?.status,
    steps: query.data?.steps,
    canProceed: query.data?.canProceed ?? true,
    nextStep: query.data?.nextStep,
    isFullyOnboarded: query.data?.isFullyOnboarded ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}
