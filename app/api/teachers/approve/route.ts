import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { teacherId, action, adminPassword } = body;

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "권한이 없습니다. 올바른 관리자 비밀번호를 입력해주세요." },
        { status: 401 }
      );
    }

    if (!teacherId || !action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "올바르지 않은 요청 파라미터입니다." },
        { status: 400 }
      );
    }

    const status = action === "APPROVE" ? "APPROVED" : "REJECTED";

    const updatedTeacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: { status },
    });

    return NextResponse.json(updatedTeacher);
  } catch (error) {
    console.error("Failed to update teacher status:", error);
    return NextResponse.json(
      { error: "교사 상태 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }
}
