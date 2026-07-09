import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const adminPassword = searchParams.get("adminPassword");

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      );
    }

    const teachers = await prisma.teacher.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(teachers);
  } catch (error) {
    console.error("Failed to fetch teachers:", error);
    return NextResponse.json(
      { error: "교사 목록 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
