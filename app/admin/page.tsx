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
      <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased justify-center items-center px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-sm h-64 bg-gradient-to-r from-red-500/10 via-orange-500/5 to-purple-600/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight">금마 관리자 모드</h2>
            <p className="text-sm text-zinc-400 mt-1.5">
              관리를 시작하려면 관리자 비밀번호를 입력하세요.
            </p>
          </div>

          {authError && (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-300 text-sm">
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
                className="w-full h-11 px-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 focus:outline-none focus:border-teal-500/80 transition-colors text-sm text-center font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex-1 h-11 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-semibold text-xs rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              >
                교사 메인으로
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="flex-1 h-11 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-zinc-950 font-semibold text-xs rounded-xl flex items-center justify-center cursor-pointer shadow-[0_4px_15px_rgba(20,184,166,0.1)] transition-all"
              >
                {verifying ? (
                  <span className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
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
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-teal-500 selection:text-black">
      {/* Decorative gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-72 bg-gradient-to-r from-teal-500/10 via-blue-600/5 to-purple-600/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight">
            금마 전자허가원 (관리자)
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
          >
            교사 대시보드로
          </button>
          <button
            onClick={handleLogout}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-950/20 text-rose-400 hover:text-rose-300 border border-rose-950/30 hover:border-rose-500/30 transition-all cursor-pointer"
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
            <h2 className="text-xl font-bold tracking-tight">교사 가입 승인 대기</h2>
            <p className="text-xs text-zinc-400 mt-1">
              신규 등록을 신청한 교사 계정을 승인하거나 거절합니다.
            </p>
          </div>

          {pendingTeachers.length === 0 ? (
            <div className="py-8 text-center border border-zinc-900 rounded-2xl bg-zinc-900/10 text-sm text-zinc-500 font-medium">
              승인 대기 중인 교사가 없습니다.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {pendingTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/20 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-zinc-200">{teacher.name}</div>
                    <div className="text-xs text-zinc-500">담당 과목: {teacher.subject}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTeacherApproval(teacher.id, "APPROVE")}
                      className="h-8 px-3 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleTeacherApproval(teacher.id, "REJECT")}
                      className="h-8 px-3 bg-zinc-900 hover:bg-zinc-800 text-rose-400 hover:text-rose-300 border border-zinc-800 hover:border-zinc-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
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
              <h2 className="text-lg font-bold tracking-tight">위치 관리</h2>
              <p className="text-xs text-zinc-400 mt-1">
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
                className="flex-1 h-10 px-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-teal-500/80 transition-colors text-xs"
              />
              <button
                type="submit"
                disabled={addingLocation}
                className="h-10 px-4 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
              >
                {addingLocation ? "추가 중" : "추가"}
              </button>
            </form>

            {/* Location list */}
            {locations.length === 0 ? (
              <div className="py-8 text-center border border-zinc-900 rounded-2xl bg-zinc-900/10 text-xs text-zinc-500">
                등록된 위치가 없습니다.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-zinc-900 rounded-2xl divide-y divide-zinc-900/60 bg-zinc-900/10">
                {locations.map((loc) => (
                  <div key={loc.id} className="p-3.5 flex items-center justify-between gap-4 text-xs font-semibold text-zinc-300">
                    <span>{loc.name}</span>
                    <button
                      onClick={() => handleDeleteLocation(loc.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
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
              <h2 className="text-lg font-bold tracking-tight">승인된 교사 목록</h2>
              <p className="text-xs text-zinc-400 mt-1">
                현재 가입 승인되어 허가원을 처리할 수 있는 교사들입니다.
              </p>
            </div>

            {approvedTeachers.length === 0 ? (
              <div className="py-8 text-center border border-zinc-900 rounded-2xl bg-zinc-900/10 text-xs text-zinc-500">
                승인된 교사가 없습니다.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto border border-zinc-900 rounded-2xl divide-y divide-zinc-900/60 bg-zinc-900/10">
                {approvedTeachers.map((t) => (
                  <div key={t.id} className="p-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-zinc-300">{t.name}</div>
                      <div className="text-[10px] text-zinc-500">담당: {t.subject}</div>
                    </div>
                    <button
                      onClick={() => handleTeacherApproval(t.id, "REJECT")}
                      className="text-xs text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer border border-zinc-800 hover:border-rose-500/20 px-2.5 py-1 rounded-lg hover:bg-rose-950/10"
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
