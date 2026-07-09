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

    // Fetch all permits, newest first
    const permits = await prisma.permit.findMany({
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
