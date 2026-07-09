"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Teacher {
  id: string;
  name: string;
  subject: string;
  deviceToken: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();

  // Authentication
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Data lists
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form states
  const [newLocationName, setNewLocationName] = useState("");
  const [addingLocation, setAddingLocation] = useState(false);

  // Try to load auth from sessionStorage
  useEffect(() => {
    const savedPassword = sessionStorage.getItem("admin_password");
    if (savedPassword) {
      handleLogin(null, savedPassword);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent | null, passToUse?: string) => {
    if (e) e.preventDefault();
    const finalPassword = passToUse ?? password;
    
    if (!finalPassword.trim()) {
      setAuthError("비밀번호를 입력해 주세요.");
      return;
    }

    setVerifying(true);
    setAuthError(null);

    try {
      const res = await fetch(`/api/teachers?adminPassword=${encodeURIComponent(finalPassword)}`);
      
      if (res.ok) {
        const teachersData = await res.json();
        setTeachers(teachersData);
        sessionStorage.setItem("admin_password", finalPassword);
        setPassword(finalPassword); // ensure state sync
        setIsAuthorized(true);
        
        // Fetch locations list too
        fetchLocations();
      } else {
        setAuthError("올바르지 않은 비밀번호입니다.");
        sessionStorage.removeItem("admin_password");
      }
    } catch (error) {
      console.error(error);
      setAuthError("서버와 통신하는 중 오류가 발생했습니다.");
    } finally {
      setVerifying(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const res = await fetch(`/api/teachers?adminPassword=${encodeURIComponent(password)}`);
      if (res.ok) {
        const data = await res.json();
        setTeachers(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Approve/Reject teacher action
  const handleTeacherApproval = async (teacherId: string, action: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch("/api/teachers/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId,
          action,
          adminPassword: password,
        }),
      });

      if (res.ok) {
        // Refresh list
        fetchTeachers();
      } else {
        const errData = await res.json();
        alert(errData.error || "교사 상태 변경 실패");
      }
    } catch (error) {
      console.error(error);
      alert("서버 연결에 실패했습니다.");
    }
  };

  // Add a new location
  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;

    setAddingLocation(true);

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLocationName,
          adminPassword: password,
        }),
      });

      if (res.ok) {
        setNewLocationName("");
        fetchLocations();
      } else {
        const errData = await res.json();
        alert(errData.error || "위치 추가 실패");
      }
    } catch (error) {
      console.error(error);
      alert("서버 연결에 실패했습니다.");
    } finally {
      setAddingLocation(false);
    }
  };

  // Delete a location
  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm("정말 이 위치를 삭제하시겠습니까?")) return;

    try {
      const res = await fetch("/api/locations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          adminPassword: password,
        }),
      });

      if (res.ok) {
        fetchLocations();
      } else {
        const errData = await res.json();
        alert(errData.error || "위치 삭제 실패");
      }
    } catch (error) {
      console.error(error);
      alert("서버 연결에 실패했습니다.");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    setIsAuthorized(false);
    setPassword("");
  };

  // --- Login Screen ---
  if (!isAuthorized) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 font-sans antialiased justify-center items-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900">금마 관리자 모드</h2>
            <p className="text-xs text-zinc-505 mt-1.5 font-semibold text-zinc-500">
              관리를 시작하려면 관리자 비밀번호를 입력하세요.
            </p>
          </div>

          {authError && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium">
              {authError}
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">관리자 비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-800 focus:outline-none focus:border-zinc-900 transition-colors text-xs text-center font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 h-11 bg-zinc-100 hover:bg-zinc-200 text-zinc-650 font-semibold text-xs rounded-xl border border-zinc-200 transition-colors cursor-pointer"
              >
                교사 메인으로
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="flex-1 h-11 bg-zinc-900 hover:bg-black text-white font-semibold text-xs rounded-xl flex items-center justify-center cursor-pointer transition-all"
              >
                {verifying ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "로그인"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Admin Dashboard Screen ---
  const pendingTeachers = teachers.filter((t) => t.status === "PENDING");
  const approvedTeachers = teachers.filter((t) => t.status === "APPROVED");

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 font-sans antialiased selection:bg-zinc-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-900" />
          <h1 className="text-md font-bold tracking-tight text-zinc-900">
            금마 전자허가원 (관리자)
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-205 text-zinc-650 border border-zinc-200 transition-all cursor-pointer"
          >
            교사 대시보드로
          </button>
          <button
            onClick={handleLogout}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100/60 text-rose-700 border border-rose-200 transition-all cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-5 py-8 z-10 space-y-10">
        
        {/* Row 1: Teacher Registration Requests */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">교사 가입 승인 대기</h2>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              신규 등록을 신청한 교사 계정을 승인하거나 거절합니다.
            </p>
          </div>

          {pendingTeachers.length === 0 ? (
            <div className="py-8 text-center border border-zinc-200 rounded-2xl bg-white text-xs text-zinc-500 font-medium">
              승인 대기 중인 교사가 없습니다.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {pendingTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="p-4 rounded-xl border border-zinc-200 bg-white flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-zinc-855">{teacher.name}</div>
                    <div className="text-[10px] text-zinc-400 font-semibold">담당 과목: {teacher.subject}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTeacherApproval(teacher.id, "APPROVE")}
                      className="h-8 px-3 bg-zinc-900 hover:bg-black text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleTeacherApproval(teacher.id, "REJECT")}
                      className="h-8 px-3 bg-rose-50 hover:bg-rose-100/60 text-rose-700 border border-rose-200 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Row 2: Location Management & Approved Teachers */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Section: Location Management */}
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-bold tracking-tight text-zinc-900">위치 관리</h2>
              <p className="text-xs text-zinc-500 mt-1 font-medium">
                학생들이 신청할 수 있는 이동 장소 목록을 관리합니다.
              </p>
            </div>

            {/* Location add form */}
            <form onSubmit={handleAddLocation} className="flex gap-2">
              <input
                type="text"
                placeholder="위치 이름 입력 (예: 컴퓨터실)"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="flex-1 h-10 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors text-xs"
              />
              <button
                type="submit"
                disabled={addingLocation}
                className="h-10 px-4 bg-zinc-900 hover:bg-black text-white font-bold text-xs rounded-xl flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
              >
                {addingLocation ? "추가 중" : "추가"}
              </button>
            </form>

            {/* Location list */}
            {locations.length === 0 ? (
              <div className="py-8 text-center border border-zinc-200 rounded-2xl bg-white text-xs text-zinc-500">
                등록된 위치가 없습니다.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-zinc-200 rounded-2xl divide-y divide-zinc-100 bg-white">
                {locations.map((loc) => (
                  <div key={loc.id} className="p-3.5 flex items-center justify-between gap-4 text-xs font-semibold text-zinc-700">
                    <span>{loc.name}</span>
                    <button
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="text-xs text-rose-650 hover:text-rose-800 transition-colors cursor-pointer"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Approved Teachers List */}
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-bold tracking-tight text-zinc-900">승인된 교사 목록</h2>
              <p className="text-xs text-zinc-500 mt-1 font-medium">
                현재 가입 승인되어 허가원을 처리할 수 있는 교사들입니다.
              </p>
            </div>

            {approvedTeachers.length === 0 ? (
              <div className="py-8 text-center border border-zinc-200 rounded-2xl bg-white text-xs text-zinc-500">
                승인된 교사가 없습니다.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto border border-zinc-200 rounded-2xl divide-y divide-zinc-100 bg-white">
                {approvedTeachers.map((t) => (
                  <div key={t.id} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-zinc-850">{t.name}</div>
                      <div className="text-[10px] text-zinc-450 font-medium">담당: {t.subject}</div>
                    </div>
                    <button
                      onClick={() => handleTeacherApproval(t.id, "REJECT")}
                      className="text-xs text-zinc-550 border border-zinc-200 hover:bg-rose-50/40 hover:text-rose-600 hover:border-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      권한 박탈
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
