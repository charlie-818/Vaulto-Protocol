"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

interface GeoVerifyResult {
  success: boolean;
  blocked: boolean;
  reason?: string;
  countryCode?: string;
  countryName?: string;
  requiresDeclaration?: boolean;
  declarationText?: string;
}

interface GeoDeclarationInput {
  declaredNonUs: boolean;
  declaredCountry: string;
  signatureHash: string;
}

export function useGeoVerification() {
  const queryClient = useQueryClient();

  const verifyMutation = useMutation<GeoVerifyResult, Error>({
    mutationFn: async () => {
      const response = await fetch("/api/onboarding/geo-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Geo verification failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
  });

  const declarationMutation = useMutation<
    { success: boolean; message: string },
    Error,
    GeoDeclarationInput
  >({
    mutationFn: async (input) => {
      const response = await fetch("/api/onboarding/geo-verify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Declaration submission failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
  });

  return {
    verify: verifyMutation.mutateAsync,
    submitDeclaration: declarationMutation.mutateAsync,
    isVerifying: verifyMutation.isPending,
    isSubmitting: declarationMutation.isPending,
    verifyError: verifyMutation.error,
    declarationError: declarationMutation.error,
    verifyResult: verifyMutation.data,
  };
}
