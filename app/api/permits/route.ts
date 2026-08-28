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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { token, permitId, periods, location, reason, applicants } = body;

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

    if (!permitId) {
      return NextResponse.json(
        { error: "수정할 허가원 ID가 누락되었습니다." },
        { status: 400 }
      );
    }

    if (!periods || !Array.isArray(periods) || periods.length === 0) {
      return NextResponse.json(
        { error: "교시를 1개 이상 선택해 주세요." },
        { status: 400 }
      );
    }

    if (!location || typeof location !== "string" || !location.trim()) {
      return NextResponse.json(
        { error: "장소를 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        { error: "이동 사유를 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!applicants || !Array.isArray(applicants) || applicants.length === 0) {
      return NextResponse.json(
        { error: "신청 학생을 1명 이상 입력해 주세요." },
        { status: 400 }
      );
    }

    const idRegex = /^\d{4}$/;
    for (let i = 0; i < applicants.length; i++) {
      const app = applicants[i];
      if (!app.id || !idRegex.test(app.id)) {
        return NextResponse.json(
          { error: `${i + 1}번째 학생의 학번이 올바르지 않습니다. (4자리 숫자)` },
          { status: 400 }
        );
      }
      if (!app.name || !app.name.trim()) {
        return NextResponse.json(
          { error: `${i + 1}번째 학생의 이름을 입력해 주세요.` },
          { status: 400 }
        );
      }
    }

    // Update the permit
    const updatedPermit = await prisma.permit.update({
      where: { id: permitId },
      data: {
        periods,
        location: location.trim(),
        reason: reason.trim(),
        applicants,
      },
      include: {
        approver: {
          select: {
            name: true,
            subject: true,
          },
        },
      },
    });

    return NextResponse.json(updatedPermit);
  } catch (error) {
    console.error("Failed to update permit:", error);
    return NextResponse.json(
      { error: "허가원 수정에 실패했습니다." },
      { status: 500 }
    );
  }
}

