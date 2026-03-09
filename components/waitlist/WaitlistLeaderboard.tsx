"use client";

import { useLeaderboard } from "@/hooks/waitlist";
import { PointsCounter } from "./PointsCounter";

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

export function WaitlistLeaderboard() {
  const { leaderboard, totalUsers, isLoading, isError } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--muted)]/20" />
        </div>
        <div className="p-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-[var(--border)] py-3 last:border-0"
            >
              <div className="h-6 w-8 animate-pulse rounded bg-[var(--muted)]/20" />
              <div className="h-6 w-32 animate-pulse rounded bg-[var(--muted)]/20" />
              <div className="ml-auto h-6 w-24 animate-pulse rounded bg-[var(--muted)]/20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-[var(--muted)]">
        Failed to load leaderboard
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center text-[var(--muted)]">
        No users on the waitlist yet
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
          Leaderboard
        </h3>
        <span className="text-xs text-[var(--muted)]">
          {totalUsers} {totalUsers === 1 ? "user" : "users"} on waitlist
        </span>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              <th className="px-4 py-3 w-16">#</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user, index) => {
              const showDivider =
                index > 0 &&
                user.rank > leaderboard[index - 1].rank + 1;

              return (
                <>
                  {showDivider && (
                    <tr key={`divider-${user.rank}`}>
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-center text-xs text-[var(--muted)]"
                      >
                        ...
                      </td>
                    </tr>
                  )}
                  <tr
                    key={user.rank}
                    className={`border-b border-[var(--border)] last:border-0 transition-colors ${
                      user.isCurrentUser
                        ? "bg-blue-500/5"
                        : "hover:bg-[var(--muted)]/5"
                    }`}
                  >
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {user.rank}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          user.isCurrentUser
                            ? "font-medium text-blue-500"
                            : "text-[var(--foreground)]"
                        }
                      >
                        {user.isCurrentUser ? "YOU" : user.maskedEmail}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PointsCounter
                        createdAt={user.createdAt}
                        bonusPoints={user.bonusPoints}
                        className="text-[var(--foreground)]"
                      />
                    </td>
                  </tr>
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden">
        {leaderboard.map((user, index) => {
          const showDivider =
            index > 0 &&
            user.rank > leaderboard[index - 1].rank + 1;

          return (
            <>
              {showDivider && (
                <div
                  key={`divider-${user.rank}`}
                  className="py-2 text-center text-xs text-[var(--muted)]"
                >
                  ...
                </div>
              )}
              <div
                key={user.rank}
                className={`flex items-center justify-between border-b border-[var(--border)] p-4 last:border-0 ${
                  user.isCurrentUser ? "bg-blue-500/5" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-sm text-[var(--muted)]">
                    #{user.rank}
                  </span>
                  <span
                    className={
                      user.isCurrentUser
                        ? "font-medium text-blue-500"
                        : "text-[var(--foreground)]"
                    }
                  >
                    {user.isCurrentUser ? "YOU" : user.maskedEmail}
                  </span>
                </div>
                <PointsCounter
                  createdAt={user.createdAt}
                  bonusPoints={user.bonusPoints}
                  className="text-sm text-[var(--foreground)]"
                />
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}
