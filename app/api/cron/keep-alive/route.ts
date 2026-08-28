import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Verify Vercel Cron Secret if set
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Ping the Supabase database to prevent inactivity pause
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        success: true,
        message: "Database pinged successfully to keep alive",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Cron Keep-Alive Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to ping database",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
