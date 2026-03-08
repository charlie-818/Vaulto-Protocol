"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface KycInitResult {
  success: boolean;
  applicantId: string;
  status: string;
  alreadyExists?: boolean;
}

interface KycTokenResult {
  success: boolean;
  token: string;
  expiresAt: string;
}

interface KycStatusResult {
  success: boolean;
  status: string;
  initiatedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  documentVerified?: boolean;
  livenessVerified?: boolean;
  amlScreeningPassed?: boolean;
  message?: string;
}

export function useKycVerification() {
  const queryClient = useQueryClient();

  // Initialize KYC
  const initMutation = useMutation<KycInitResult, Error>({
    mutationFn: async () => {
      const response = await fetch("/api/onboarding/kyc/init", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to initialize KYC");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
    },
  });

  // Get access token
  const tokenMutation = useMutation<KycTokenResult, Error>({
    mutationFn: async () => {
      const response = await fetch("/api/onboarding/kyc/token", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get access token");
      }

      return response.json();
    },
  });

  // Get KYC status
  const statusQuery = useQuery<KycStatusResult>({
    queryKey: ["kyc-status"],
    queryFn: async () => {
      const response = await fetch("/api/onboarding/kyc/status");
      if (!response.ok) {
        throw new Error("Failed to fetch KYC status");
      }
      return response.json();
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: (query) => {
      // Poll more frequently when pending
      const status = query.state.data?.status;
      if (status === "PENDING" || status === "IN_REVIEW") {
        return 15000; // 15 seconds
      }
      return false;
    },
  });

  return {
    // Init
    initKyc: initMutation.mutateAsync,
    isInitializing: initMutation.isPending,
    initError: initMutation.error,
    initResult: initMutation.data,

    // Token
    getToken: tokenMutation.mutateAsync,
    isGettingToken: tokenMutation.isPending,
    tokenError: tokenMutation.error,
    tokenResult: tokenMutation.data,

    // Status
    status: statusQuery.data?.status,
    statusDetails: statusQuery.data,
    isLoadingStatus: statusQuery.isLoading,
    statusError: statusQuery.error,
    refetchStatus: () =>
      queryClient.invalidateQueries({ queryKey: ["kyc-status"] }),
  };
}
