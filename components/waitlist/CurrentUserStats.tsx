"use client";

import { PointsCounter } from "./PointsCounter";
import { ShareToXButton } from "./ShareToXButton";
import { useLeaderboard } from "@/hooks/waitlist";

export function CurrentUserStats() {
  const { currentUser, isLoading, shareToX, isSharing } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 h-4 w-24 rounded bg-[var(--muted)]/20" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-6">
            <div className="h-10 w-20 rounded bg-[var(--muted)]/20" />
            <div className="h-10 w-32 rounded bg-[var(--muted)]/20" />
          </div>
          <div className="h-10 w-40 rounded bg-[var(--muted)]/20" />
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        Your Stats
      </h3>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="text-sm text-[var(--muted)]">Rank</div>
            <div className="text-2xl font-semibold text-[var(--foreground)]">
              #{currentUser.rank}
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--muted)]">Points</div>
            <div className="text-2xl font-semibold text-[var(--foreground)]">
              <PointsCounter
                createdAt={currentUser.createdAt}
                bonusPoints={currentUser.bonusPoints}
              />
            </div>
          </div>
        </div>
        <ShareToXButton
          hasShared={currentUser.hasSharedToX}
          onShare={shareToX}
          isSharing={isSharing}
        />
      </div>
    </div>
  );
}
