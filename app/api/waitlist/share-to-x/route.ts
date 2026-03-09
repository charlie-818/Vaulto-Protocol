import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";

const SHARE_BONUS_POINTS = 100000; // ~1 day equivalent

export interface ShareToXResponse {
  success: boolean;
  bonusPoints: number;
  totalBonusPoints: number;
  alreadyShared?: boolean;
}

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    // Find user
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        hasSharedToX: true,
        bonusPoints: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already shared
    if (user.hasSharedToX) {
      return NextResponse.json({
        success: false,
        bonusPoints: 0,
        totalBonusPoints: user.bonusPoints,
        alreadyShared: true,
      } as ShareToXResponse);
    }

    // Award bonus points
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        bonusPoints: user.bonusPoints + SHARE_BONUS_POINTS,
        hasSharedToX: true,
        sharedToXAt: new Date(),
      },
      select: {
        bonusPoints: true,
      },
    });

    return NextResponse.json({
      success: true,
      bonusPoints: SHARE_BONUS_POINTS,
      totalBonusPoints: updatedUser.bonusPoints,
      alreadyShared: false,
    } as ShareToXResponse);
  } catch (error) {
    console.error("Share to X error:", error);
    return NextResponse.json(
      { error: "Failed to record share" },
      { status: 500 }
    );
  }
}
