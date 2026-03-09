"use client";

import { useState, useEffect } from "react";

export function usePointsCounter(createdAt: Date | string, bonusPoints: number): number {
  const [points, setPoints] = useState(() => {
    const createdAtDate = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    const now = new Date();
    const timeBasedPoints = Math.floor((now.getTime() - createdAtDate.getTime()) / 1000);
    return timeBasedPoints + bonusPoints;
  });

  useEffect(() => {
    const createdAtDate = typeof createdAt === "string" ? new Date(createdAt) : createdAt;

    const updatePoints = () => {
      const now = new Date();
      const timeBasedPoints = Math.floor((now.getTime() - createdAtDate.getTime()) / 1000);
      setPoints(timeBasedPoints + bonusPoints);
    };

    // Update immediately
    updatePoints();

    // Update every second
    const interval = setInterval(updatePoints, 1000);

    return () => clearInterval(interval);
  }, [createdAt, bonusPoints]);

  return points;
}
