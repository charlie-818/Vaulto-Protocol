"use client";

import { usePointsCounter } from "@/hooks/waitlist";

interface PointsCounterProps {
  createdAt: Date | string;
  bonusPoints: number;
  className?: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

export function PointsCounter({
  createdAt,
  bonusPoints,
  className = "",
}: PointsCounterProps) {
  const points = usePointsCounter(createdAt, bonusPoints);

  return (
    <span className={`tabular-nums font-mono ${className}`}>
      {formatNumber(points)}
    </span>
  );
}
