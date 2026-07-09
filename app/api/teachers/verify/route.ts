import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "기기 토큰이 누락되었습니다." },
        { status: 400 }
      );
    }

    const teacher = await prisma.teacher.findUnique({
      where: { deviceToken: token },
    });

    if (!teacher) {
      return NextResponse.json({ verified: false, status: null, teacher: null });
    }

    return NextResponse.json({
      verified: teacher.status === "APPROVED",
      status: teacher.status,
      teacher,
    });
  } catch (error) {
    console.error("Failed to verify teacher token:", error);
    return NextResponse.json(
      { error: "교사 인증 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
