import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, subject, deviceToken } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "이름을 입력해주세요." },
        { status: 400 }
      );
    }
    if (!subject || typeof subject !== "string" || subject.trim() === "") {
      return NextResponse.json(
        { error: "담당 과목을 입력해주세요." },
        { status: 400 }
      );
    }
    if (!deviceToken || typeof deviceToken !== "string") {
      return NextResponse.json(
        { error: "유효하지 않은 기기 토큰입니다." },
        { status: 400 }
      );
    }

    // Check if device token already registered
    const existing = await prisma.teacher.findUnique({
      where: { deviceToken },
    });

    if (existing) {
      // If they were rejected, allow updating their details and re-requesting approval
      if (existing.status === "REJECTED") {
        const updated = await prisma.teacher.update({
          where: { id: existing.id },
          data: {
            name,
            subject,
            status: "PENDING",
          },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json(existing);
    }

    const teacher = await prisma.teacher.create({
      data: {
        name,
        subject,
        deviceToken,
        status: "PENDING",
      },
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error("Failed to register teacher:", error);
    return NextResponse.json(
      { error: "교사 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
