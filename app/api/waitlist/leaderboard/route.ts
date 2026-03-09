import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";

export interface LeaderboardUser {
  rank: number;
  maskedEmail: string;
  points: number;
  bonusPoints: number;
  createdAt: string;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardUser[];
  currentUser: {
    rank: number;
    points: number;
    bonusPoints: number;
    createdAt: string;
    hasSharedToX: boolean;
  } | null;
  totalUsers: number;
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***@***";

  const maskedLocal =
    localPart.length > 1
      ? localPart[0] + "***"
      : localPart[0] + "***";

  const domainParts = domain.split(".");
  const maskedDomain =
    domainParts[0].length > 1
      ? domainParts[0][0] + "***"
      : domainParts[0] + "***";

  return `${maskedLocal}@${maskedDomain}...`;
}

function calculatePoints(createdAt: Date, bonusPoints: number): number {
  const now = new Date();
  const timeBasedPoints = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
  return timeBasedPoints + bonusPoints;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    // Get all waitlist users (NOT_STARTED onboarding status)
    const waitlistUsers = await db.user.findMany({
      where: {
        onboardingStatus: "NOT_STARTED",
        isVaultoEmployee: false,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        bonusPoints: true,
        hasSharedToX: true,
      },
      orderBy: {
        createdAt: "asc", // Oldest first = most points
      },
    });

    // Calculate points and create leaderboard
    const now = new Date();
    const leaderboardWithPoints = waitlistUsers.map((user) => ({
      ...user,
      points: calculatePoints(user.createdAt, user.bonusPoints),
    }));

    // Sort by points descending
    leaderboardWithPoints.sort((a, b) => b.points - a.points);

    // Find current user's position
    const currentUserIndex = leaderboardWithPoints.findIndex(
      (u) => u.email === session.user?.email
    );
    const currentUserData = currentUserIndex >= 0 ? leaderboardWithPoints[currentUserIndex] : null;

    // Build leaderboard response (top 50 users)
    const leaderboard: LeaderboardUser[] = leaderboardWithPoints
      .slice(0, 50)
      .map((user, index) => ({
        rank: index + 1,
        maskedEmail: maskEmail(user.email),
        points: user.points,
        bonusPoints: user.bonusPoints,
        createdAt: user.createdAt.toISOString(),
        isCurrentUser: user.email === session.user?.email,
      }));

    // If current user is not in top 50, add them at the end
    if (currentUserIndex >= 50 && currentUserData) {
      leaderboard.push({
        rank: currentUserIndex + 1,
        maskedEmail: maskEmail(currentUserData.email),
        points: currentUserData.points,
        bonusPoints: currentUserData.bonusPoints,
        createdAt: currentUserData.createdAt.toISOString(),
        isCurrentUser: true,
      });
    }

    return NextResponse.json({
      leaderboard,
      currentUser: currentUserData
        ? {
            rank: currentUserIndex + 1,
            points: currentUserData.points,
            bonusPoints: currentUserData.bonusPoints,
            createdAt: currentUserData.createdAt.toISOString(),
            hasSharedToX: currentUserData.hasSharedToX,
          }
        : null,
      totalUsers: waitlistUsers.length,
    } as LeaderboardResponse);
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to get leaderboard" },
      { status: 500 }
    );
  }
}
