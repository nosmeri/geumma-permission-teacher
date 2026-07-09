import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { permitId, action, token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "교사 인증 토큰이 누락되었습니다." },
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

    if (!permitId || !action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "올바르지 않은 파라미터입니다." },
        { status: 400 }
      );
    }

    const status = action === "APPROVE" ? "APPROVED" : "REJECTED";

    const updatedPermit = await prisma.permit.update({
      where: { id: permitId },
      data: {
        status,
        approverId: teacher.id,
      },
    });

    return NextResponse.json(updatedPermit);
  } catch (error) {
    console.error("Failed to update permit status:", error);
    return NextResponse.json(
      { error: "허가원 상태 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }
}
