"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Teacher {
  id: string;
  name: string;
  subject: string;
  deviceToken: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface Permit {
  id: string;
  date: string;
  periods: string[];
  location: string;
  reason: string;
  applicants: { id: string; name: string }[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  approver?: {
    name: string;
    subject: string;
  } | null;
  createdAt: string;
}

export default function TeacherHome() {
  const router = useRouter();

  // Authentication & Verification States
  const [token, setToken] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"LOADING" | "NOT_REGISTERED" | "PENDING" | "APPROVED" | "REJECTED">("LOADING");

  // Registration Form States
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Dashboard States
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");

  // Check registration on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("teacher_device_token");
    if (!storedToken) {
      setVerificationStatus("NOT_REGISTERED");
      return;
    }

    setToken(storedToken);
    verifyTeacherToken(storedToken);
  }, []);

  // Fetch permits when teacher is approved
  useEffect(() => {
    if (verificationStatus === "APPROVED" && token) {
      fetchDashboardData();
    }
  }, [verificationStatus, token]);

  const verifyTeacherToken = async (deviceToken: string) => {
    try {
      const res = await fetch(`/api/teachers/verify?token=${deviceToken}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status) {
          setTeacher(data.teacher);
          setVerificationStatus(data.status);
        } else {
          setVerificationStatus("NOT_REGISTERED");
        }
      } else {
        setVerificationStatus("NOT_REGISTERED");
      }
    } catch (error) {
      console.error("Token verification failed:", error);
      setVerificationStatus("NOT_REGISTERED");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (!name.trim()) {
      setRegisterError("이름을 입력해 주세요.");
      return;
    }
    if (!subject.trim()) {
      setRegisterError("담당 과목을 입력해 주세요.");
      return;
    }

    setRegistering(true);

    try {
      // Generate a simple device token if not exists
      const newToken =
        token ||
        Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);
      
      const res = await fetch("/api/teachers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, deviceToken: newToken }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("teacher_device_token", newToken);
        setToken(newToken);
        setTeacher(data);
        setVerificationStatus(data.status);
      } else {
        setRegisterError(data.error || "등록에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      setRegisterError("서버와 통신하는 중 오류가 발생했습니다.");
    } finally {
      setRegistering(false);
    }
  };

  const fetchDashboardData = async () => {
    if (!token) return;
    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      const res = await fetch(`/api/permits?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setPermits(data);
      } else {
        const errData = await res.json();
        setDashboardError(errData.error || "허가원 목록을 불러오지 못했습니다.");
      }
    } catch (error) {
      console.error(error);
      setDashboardError("서버와 통신하는 중 오류가 발생했습니다.");
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Permit status update logic (Approve/Reject)
  const handlePermitAction = async (permitId: string, action: "APPROVE" | "REJECT") => {
    if (!token || !teacher) return;

    // Optimistic UI update
    const previousPermits = [...permits];
    setPermits(
      permits.map((p) =>
        p.id === permitId
          ? {
              ...p,
              status: action === "APPROVE" ? "APPROVED" : "REJECTED",
              approver: { name: teacher.name, subject: teacher.subject },
            }
          : p
      )
    );

    try {
      const res = await fetch("/api/permits/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permitId, action, token }),
      });

      if (!res.ok) {
        // Rollback on error
        setPermits(previousPermits);
        const data = await res.json();
        alert(data.error || "상태 변경에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      setPermits(previousPermits);
      alert("서버 연결에 실패했습니다.");
    }
  };

  const formatPermitDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  const filteredPermits = permits.filter((p) => {
    if (filter === "ALL") return true;
    return p.status === filter;
  });

  // Render LOADING screen
  if (verificationStatus === "LOADING") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-300">
        <span className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">교사 정보 인증 확인 중...</p>
      </div>
    );
  }

  // Render REGISTER form screen
  if (verificationStatus === "NOT_REGISTERED" || verificationStatus === "REJECTED") {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 bg-gradient-to-r from-teal-500/10 via-indigo-500/5 to-purple-600/10 blur-[100px] pointer-events-none" />
        
        <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            금마 전자허가원 (교사용)
          </h1>
          <button
            onClick={() => router.push("/admin")}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
          >
            관리자 모드
          </button>
        </header>

        <main className="flex-1 flex flex-col justify-center items-center px-6 py-12">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight">교사 등록 신청</h2>
              <p className="text-sm text-zinc-400 mt-1.5">
                {verificationStatus === "REJECTED"
                  ? "승인이 거절되었습니다. 담당 정보를 수정하여 다시 신청하세요."
                  : "시스템 사용을 위해 이름과 과목을 등록해 주세요."}
              </p>
            </div>

            {registerError && (
              <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-300 text-sm">
                {registerError}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">교사 성함</label>
                <input
                  type="text"
                  placeholder="성함을 입력하세요 (예: 김교사)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-teal-500/80 transition-colors text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">담당 과목</label>
                <input
                  type="text"
                  placeholder="담당 과목을 입력하세요 (예: 수학, 정보)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-teal-500/80 transition-colors text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={registering}
                className="w-full h-12 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-zinc-950 font-semibold text-sm rounded-xl flex items-center justify-center cursor-pointer shadow-[0_4px_20px_rgba(20,184,166,0.15)] transition-all active:scale-[0.98]"
              >
                {registering ? (
                  <span className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  "승인 신청하기"
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // Render PENDING approval screen
  if (verificationStatus === "PENDING") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-zinc-300 font-sans px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 bg-gradient-to-r from-amber-500/5 via-orange-500/5 blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8 animate-pulse"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold">승인 대기 중</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              교사 등록 신청이 대기 상태입니다.<br />
              관리자가 승인할 때까지 기다려 주세요.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-900/30 text-xs text-zinc-500 space-y-1 text-left">
            <div>신청 이름: <span className="text-zinc-300 font-medium">{teacher?.name}</span></div>
            <div>신청 과목: <span className="text-zinc-300 font-medium">{teacher?.subject}</span></div>
          </div>

          <button
            onClick={() => verifyTeacherToken(token!)}
            className="text-xs font-semibold px-4 py-2 rounded-full border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-colors cursor-pointer"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  // Render APPROVED teacher dashboard screen
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-teal-500 selection:text-black">
      {/* Decorative gradient blur background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-72 bg-gradient-to-r from-violet-600/10 via-teal-500/10 to-blue-600/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/70 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight">
            금마 전자허가원 (교사)
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">{teacher?.name}</span> ({teacher?.subject})
          </span>
          <button
            onClick={() => router.push("/admin")}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
          >
            관리 메뉴
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-8 z-10 space-y-6">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">허가원 신청 목록</h2>
            <p className="text-xs text-zinc-400 mt-1">
              학생들이 제출한 야간 자율학습 이동 허가원을 승인하거나 반려합니다.
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loadingDashboard}
            className="h-9 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className={`w-3.5 h-3.5 ${loadingDashboard ? "animate-spin" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            새로고침
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 border-b border-zinc-900 pb-3 overflow-x-auto">
          {[
            { key: "PENDING", label: "승인 대기" },
            { key: "APPROVED", label: "승인 완료" },
            { key: "REJECTED", label: "반려됨" },
            { key: "ALL", label: "전체" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filter === item.key
                  ? "bg-zinc-900 text-teal-400 border border-zinc-800"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Dashboard Error */}
        {dashboardError && (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/20 text-rose-300 text-sm">
            {dashboardError}
          </div>
        )}

        {/* Permits list */}
        {loadingDashboard ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 w-full rounded-2xl bg-zinc-900/20 border border-zinc-900 animate-pulse"
              />
            ))}
          </div>
        ) : filteredPermits.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-900 rounded-2xl bg-zinc-900/5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8 text-zinc-700 mx-auto mb-3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801-12c.065.21.1.433.1.664a2.25 2.25 0 0 1-2.25 2.25 2.25 2.25 0 0 1-2.25-2.25c0-.231.035-.454.1-.664M6.75 7.5H4.853c-1.132 0-2.078.96-2.172 2.096a48.42 48.42 0 0 0-.08 1.123v6.75A2.25 2.25 0 0 0 4.853 19.5h1.9c.066-.21.1-.433.1-.664a2.25 2.25 0 0 1 2.25-2.25 2.25 2.25 0 0 1 2.25 2.25c0 .231-.035.454-.1.664Z"
              />
            </svg>
            <p className="text-sm text-zinc-500 font-medium">조회된 허가원 신청이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPermits.map((permit) => {
              const applicantsList = Array.isArray(permit.applicants)
                ? permit.applicants.map((a) => `${a.id} ${a.name}`).join(", ")
                : "";

              return (
                <div
                  key={permit.id}
                  className="p-5 rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 hover:border-zinc-800 transition-all duration-300"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-zinc-500">
                        {formatPermitDate(permit.date)}
                      </span>
                      <span className="text-xs text-zinc-800">•</span>
                      <span className="text-sm font-bold text-zinc-200">
                        {permit.location}
                      </span>
                      <span className="text-xs text-zinc-800">•</span>
                      <span className="text-xs font-semibold text-zinc-400">
                        {permit.periods.join(", ")}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex gap-4">
                        <span className="text-zinc-500 w-14 shrink-0 font-medium">학생 목록</span>
                        <span className="text-zinc-300 break-all font-medium">{applicantsList}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-zinc-500 w-14 shrink-0 font-medium">이동 사유</span>
                        <span className="text-zinc-300 leading-relaxed">{permit.reason}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center justify-end gap-2.5 shrink-0">
                    {permit.status === "PENDING" ? (
                      <>
                        <button
                          onClick={() => handlePermitAction(permit.id, "APPROVE")}
                          className="h-10 px-5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.1)] active:scale-[0.97] transition-all cursor-pointer w-full"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handlePermitAction(permit.id, "REJECT")}
                          className="h-10 px-5 bg-zinc-900 hover:bg-zinc-800 text-rose-400 hover:text-rose-300 border border-zinc-800 hover:border-zinc-700 font-bold text-xs rounded-xl flex items-center justify-center active:scale-[0.97] transition-all cursor-pointer w-full"
                        >
                          반려
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            permit.status === "APPROVED"
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-950/40 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {permit.status === "APPROVED" ? "승인됨" : "반려됨"}
                        </span>
                        {permit.approver && (
                          <span className="text-[10px] text-zinc-500">
                            승인: {permit.approver.name}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
