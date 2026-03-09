"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeaderboardResponse } from "@/app/api/waitlist/leaderboard/route";
import type { ShareToXResponse } from "@/app/api/waitlist/share-to-x/route";

export function useLeaderboard() {
  const queryClient = useQueryClient();

  const leaderboardQuery = useQuery<LeaderboardResponse>({
    queryKey: ["waitlist-leaderboard"],
    queryFn: async () => {
      const response = await fetch("/api/waitlist/leaderboard");
      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
  });

  const shareToXMutation = useMutation<ShareToXResponse>({
    mutationFn: async () => {
      const response = await fetch("/api/waitlist/share-to-x", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to record share");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate leaderboard to refresh data
      queryClient.invalidateQueries({ queryKey: ["waitlist-leaderboard"] });
    },
  });

  return {
    leaderboard: leaderboardQuery.data?.leaderboard ?? [],
    currentUser: leaderboardQuery.data?.currentUser ?? null,
    totalUsers: leaderboardQuery.data?.totalUsers ?? 0,
    isLoading: leaderboardQuery.isLoading,
    isError: leaderboardQuery.isError,
    error: leaderboardQuery.error,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["waitlist-leaderboard"] }),
    shareToX: shareToXMutation.mutate,
    isSharing: shareToXMutation.isPending,
    shareResult: shareToXMutation.data,
  };
}
