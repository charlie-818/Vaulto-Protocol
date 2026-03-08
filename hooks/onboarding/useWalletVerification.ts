"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";

interface WalletScreenInput {
  walletAddress: string;
  chainId: number;
  signature: string;
  timestamp: string;
}

interface WalletScreenResult {
  success: boolean;
  status: string;
  riskLevel?: string;
  riskScore?: number;
  reason?: string;
  alreadyVerified?: boolean;
}

interface VerificationMessageResult {
  message: string;
  timestamp: string;
}

export function useWalletVerification() {
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();

  // Get verification message
  const getMessageMutation = useMutation<
    VerificationMessageResult,
    Error,
    string
  >({
    mutationFn: async (walletAddress: string) => {
      const response = await fetch(
        `/api/onboarding/wallet/screen?walletAddress=${walletAddress}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get verification message");
      }

      return response.json();
    },
  });

  // Screen wallet
  const screenMutation = useMutation<WalletScreenResult, Error, WalletScreenInput>(
    {
      mutationFn: async (input) => {
        const response = await fetch("/api/onboarding/wallet/screen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Wallet screening failed");
        }

        return response.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      },
    }
  );

  // Combined verify function
  const verifyWallet = async (walletAddress: string, chainId: number) => {
    // Step 1: Get verification message
    const messageData = await getMessageMutation.mutateAsync(walletAddress);

    // Step 2: Sign the message
    const signature = await signMessageAsync({
      message: messageData.message,
    });

    // Step 3: Submit for screening
    return screenMutation.mutateAsync({
      walletAddress,
      chainId,
      signature,
      timestamp: messageData.timestamp,
    });
  };

  return {
    verifyWallet,
    getMessage: getMessageMutation.mutateAsync,
    screenWallet: screenMutation.mutateAsync,
    isGettingMessage: getMessageMutation.isPending,
    isScreening: screenMutation.isPending,
    isVerifying: getMessageMutation.isPending || screenMutation.isPending,
    messageError: getMessageMutation.error,
    screenError: screenMutation.error,
    screenResult: screenMutation.data,
  };
}
