"use client";

import type { FundingRound } from "@/lib/vaulto/companies";
import { formatValuation } from "@/lib/vaulto/companies";

type FundingBarChartProps = {
  fundingHistory: FundingRound[];
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function FundingBarChart({ fundingHistory }: FundingBarChartProps) {
  if (!fundingHistory || fundingHistory.length === 0) {
    return (
      <p className="text-sm text-muted">No funding history available</p>
    );
  }

  // Filter out rounds without funding amounts (e.g., M&A rounds) and sort by date ascending
  const sortedRounds = [...fundingHistory]
    .filter((r) => r.amountRaisedUsd != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sortedRounds.length === 0) {
    return (
      <p className="text-sm text-muted">No funding history available</p>
    );
  }

  // Find max amount for scaling
  const maxAmount = Math.max(...sortedRounds.map((r) => r.amountRaisedUsd!));

  return (
    <div className="space-y-2">
      {sortedRounds.map((round, index) => {
        const percentWidth = maxAmount > 0
          ? Math.max(8, Math.round((round.amountRaisedUsd! / maxAmount) * 100))
          : 50;

        return (
          <div key={`${round.type}-${round.date}-${index}`} className="flex items-center gap-3">
            {/* Bar */}
            <div className="flex-1 min-w-0">
              <div className="relative h-6 rounded bg-muted/30 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-indigo-500 transition-all"
                  style={{ width: `${percentWidth}%` }}
                />
              </div>
            </div>

            {/* Amount */}
            <span className="w-16 shrink-0 text-xs font-medium text-foreground text-right">
              {formatValuation(round.amountRaisedUsd!)}
            </span>

            {/* Date */}
            <span className="w-20 shrink-0 text-xs text-muted text-right">
              {formatDate(round.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
