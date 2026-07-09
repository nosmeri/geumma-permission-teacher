import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      orderBy: {
        name: "asc",
      },
    });
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Failed to fetch locations:", error);
    return NextResponse.json(
      { error: "위치 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, adminPassword } = body;

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      );
    }

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "위치 이름을 입력해주세요." },
        { status: 400 }
      );
    }

    // Check if duplicate location
    const existing = await prisma.location.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "이미 존재하는 위치입니다." },
        { status: 400 }
      );
    }

    const newLocation = await prisma.location.create({
      data: {
        name: name.trim(),
      },
    });

    return NextResponse.json(newLocation, { status: 201 });
  } catch (error) {
    console.error("Failed to create location:", error);
    return NextResponse.json(
      { error: "위치 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { locationId, adminPassword } = body;

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "권한이 없습니다." },
        { status: 401 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        { error: "삭제할 위치 ID가 누락되었습니다." },
        { status: 400 }
      );
    }

    await prisma.location.delete({
      where: { id: locationId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete location:", error);
    return NextResponse.json(
      { error: "위치 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
