import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "인증 토큰이 누락되었습니다." },
        { status: 401 }
      );
    }

    // Verify teacher is approved
    const teacher = await prisma.teacher.findUnique({
      where: { deviceToken: token },
    });

    if (!teacher || teacher.status !== "APPROVED") {
      return NextResponse.json(
        { error: "승인되지 않은 교사 계정입니다." },
        { status: 403 }
      );
    }

    // Get the start of today in KST (UTC+9)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstTime = new Date(now.getTime() + kstOffset);
    kstTime.setUTCHours(0, 0, 0, 0);
    const kstTodayStart = new Date(kstTime.getTime() - kstOffset);

    // Fetch permits submitted today, newest first
    const permits = await prisma.permit.findMany({
      where: {
        createdAt: {
          gte: kstTodayStart,
        },
      },
      include: {
        approver: {
          select: {
            name: true,
            subject: true,
          },
        },
      },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(permits);
  } catch (error) {
    console.error("Failed to fetch permits list:", error);
    return NextResponse.json(
      { error: "허가원 목록을 가져오는 데 실패했습니다." },
      { status: 500 }
    );
  }
}
