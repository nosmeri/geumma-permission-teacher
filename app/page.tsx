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
  const [viewMode, setViewMode] = useState<"LIST" | "LOCATION">("LIST");

  // Edit Modal States
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null);
  const [editPeriods, setEditPeriods] = useState<string[]>([]);
  const [editLocation, setEditLocation] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [editApplicants, setEditApplicants] = useState<{ id: string; name: string }[]>([]);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch locations list on mount
  useEffect(() => {
    fetch("/api/locations")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLocations(data);
      })
      .catch((err) => console.error("Failed to load locations:", err));
  }, []);

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedViewMode = localStorage.getItem("teacher_view_mode");
    if (savedViewMode === "LIST" || savedViewMode === "LOCATION") {
      setViewMode(savedViewMode);
    }
  }, []);

  const handleSetViewMode = (mode: "LIST" | "LOCATION") => {
    setViewMode(mode);
    localStorage.setItem("teacher_view_mode", mode);
  };

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

  // Open Edit Modal
  const handleOpenEditModal = (permit: Permit) => {
    setEditingPermit(permit);
    setEditPeriods([...permit.periods]);
    setEditLocation(permit.location);
    setEditReason(permit.reason);
    const apps = Array.isArray(permit.applicants)
      ? permit.applicants.map((a) => ({ id: a.id, name: a.name }))
      : [{ id: "", name: "" }];
    setEditApplicants(apps.length > 0 ? apps : [{ id: "", name: "" }]);
    setEditError(null);
  };

  // Close Edit Modal
  const handleCloseEditModal = () => {
    if (savingEdit) return;
    setEditingPermit(null);
    setEditError(null);
  };

  // Toggle period in edit form
  const toggleEditPeriod = (period: string) => {
    if (editPeriods.includes(period)) {
      setEditPeriods(editPeriods.filter((p) => p !== period));
    } else {
      setEditPeriods([...editPeriods, period]);
    }
  };

  // Applicant row change in edit form
  const handleEditApplicantChange = (index: number, field: "id" | "name", value: string) => {
    const updated = [...editApplicants];
    updated[index] = { ...updated[index], [field]: value };
    setEditApplicants(updated);
  };

  // Add applicant row in edit form
  const handleAddEditApplicantRow = () => {
    setEditApplicants([...editApplicants, { id: "", name: "" }]);
  };

  // Remove applicant row in edit form
  const handleRemoveEditApplicantRow = (index: number) => {
    if (editApplicants.length <= 1) return;
    setEditApplicants(editApplicants.filter((_, i) => i !== index));
  };

  // Submit edit form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermit || !token) return;
    setEditError(null);

    if (editPeriods.length === 0) {
      setEditError("교시를 1개 이상 선택해 주세요.");
      return;
    }
    if (!editLocation.trim()) {
      setEditError("장소를 선택하거나 입력해 주세요.");
      return;
    }
    if (!editReason.trim()) {
      setEditError("이동 사유를 입력해 주세요.");
      return;
    }

    const idRegex = /^\d{4}$/;
    for (let i = 0; i < editApplicants.length; i++) {
      const app = editApplicants[i];
      if (!app.id || !idRegex.test(app.id)) {
        setEditError(`${i + 1}번째 학생의 학번이 올바르지 않습니다. (4자리 숫자)`);
        return;
      }
      if (!app.name.trim()) {
        setEditError(`${i + 1}번째 학생의 이름을 입력해 주세요.`);
        return;
      }
    }

    setSavingEdit(true);

    try {
      const res = await fetch("/api/permits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          permitId: editingPermit.id,
          periods: editPeriods,
          location: editLocation.trim(),
          reason: editReason.trim(),
          applicants: editApplicants,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error || "허가원 수정에 실패했습니다.");
        return;
      }

      // Update state immediately
      setPermits((prev) =>
        prev.map((p) => (p.id === editingPermit.id ? { ...p, ...data } : p))
      );

      setEditingPermit(null);
    } catch (error) {
      console.error("Failed to edit permit:", error);
      setEditError("서버와의 통신에 실패했습니다.");
    } finally {
      setSavingEdit(false);
    }
  };

  const formatPermitDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  const formatCreatedAt = (dateStr: string) => {
    const d = new Date(dateStr);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${month}월 ${date}일 ${hours}:${minutes}`;
  };

  const filteredPermits = permits.filter((p) => {
    if (filter === "ALL") return true;
    return p.status === filter;
  });

  // Group permits by location
  const groupPermitsByLocation = (permitsList: Permit[]) => {
    const groups: Record<string, Permit[]> = {};
    permitsList.forEach((permit) => {
      const loc = permit.location || "미지정";
      if (!groups[loc]) {
        groups[loc] = [];
      }
      groups[loc].push(permit);
    });
    return groups;
  };

  const groupedPermits = groupPermitsByLocation(filteredPermits);
  const sortedLocations = Object.keys(groupedPermits).sort((a, b) => a.localeCompare(b));

  const renderPermitCard = (permit: Permit) => {
    const applicantsList = Array.isArray(permit.applicants)
      ? permit.applicants
      : [];

    return (
      <div
        key={permit.id}
        className="p-5 rounded-2xl border border-zinc-200 bg-white space-y-4 hover:border-zinc-300 hover:shadow-xs transition-all duration-200"
      >
        {/* Top Header: Location, Period Chips, and Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-zinc-900 flex items-center gap-1">
                📍 {permit.location}
              </span>
              <span className="text-xs text-zinc-300">|</span>
              <div className="flex items-center gap-1 flex-wrap">
                {permit.periods.map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 text-[11px] font-semibold"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
              <span>{formatPermitDate(permit.date)}</span>
              <span>•</span>
              <span>신청 {formatCreatedAt(permit.createdAt)}</span>
            </div>
          </div>

          {/* Top-Right Status Badge */}
          {permit.status === "PENDING" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              승인 대기
            </span>
          ) : permit.status === "APPROVED" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-emerald-600">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
              </svg>
              승인 완료
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-rose-600">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
              </svg>
              반려됨
            </span>
          )}
        </div>

        {/* Applicants List Chips */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            신청 학생 ({applicantsList.length}명)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {applicantsList.map((app, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-800"
              >
                <span className="font-mono text-zinc-400 text-[11px] font-medium">
                  {app.id}
                </span>
                <span>{app.name}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Movement Reason */}
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            이동 사유
          </span>
          <p className="text-xs text-zinc-700 font-medium bg-zinc-50/80 p-3 rounded-xl border border-zinc-100 leading-relaxed break-all">
            {permit.reason}
          </p>
        </div>

        {/* Card Footer: Approver info on left + Action Buttons on right */}
        <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3 text-xs">
          {/* Left info: Approver name if approved/rejected */}
          <div className="flex items-center gap-1.5 text-zinc-500">
            {permit.status !== "PENDING" && permit.approver ? (
              <span className="text-[11px]">
                <span className="text-zinc-400 font-medium">{permit.status === "APPROVED" ? "승인:" : "처리:"} </span>
                <span className="text-zinc-800 font-bold">{permit.approver.name} 선생님</span>
                <span className="text-zinc-400 ml-1">({permit.approver.subject})</span>
              </span>
            ) : (
              <span className="text-[11px] text-zinc-400 font-medium">교사 확인 대기 중</span>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 justify-end shrink-0">
            {/* Edit Button */}
            <button
              onClick={() => handleOpenEditModal(permit)}
              className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
              title="허가원 내용 수정"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-zinc-500">
                <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
              </svg>
              <span>수정</span>
            </button>

            {/* Status-specific action buttons */}
            {permit.status === "PENDING" ? (
              <>
                <button
                  onClick={() => handlePermitAction(permit.id, "REJECT")}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                  </svg>
                  <span>반려</span>
                </button>
                <button
                  onClick={() => handlePermitAction(permit.id, "APPROVE")}
                  className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-white">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  <span>승인</span>
                </button>
              </>
            ) : permit.status === "APPROVED" ? (
              <button
                onClick={() => handlePermitAction(permit.id, "REJECT")}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                title="승인을 취소하고 반려 상태로 변경합니다"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                </svg>
                <span>반려로 변경</span>
              </button>
            ) : (
              <button
                onClick={() => handlePermitAction(permit.id, "APPROVE")}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                title="반려된 허가원을 다시 승인합니다"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
                <span>다시 승인</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render LOADING screen
  if (verificationStatus === "LOADING") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 text-zinc-800">
        <span className="w-8 h-8 border-3 border-zinc-800 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">교사 정보 인증 확인 중...</p>
      </div>
    );
  }

  // Render REGISTER form screen
  if (verificationStatus === "NOT_REGISTERED" || verificationStatus === "REJECTED") {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 font-sans antialiased">
        <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-2 backdrop-blur-md">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-zinc-900 whitespace-nowrap flex items-center gap-1.5">
              <span className="hidden sm:inline">전북과학고 </span><span>전자허가원</span>
              <span className="text-[10px] sm:text-xs font-semibold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded-md">교사용</span>
            </h1>
          </div>
          <button
            onClick={() => router.push("/admin")}
            className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="hidden sm:inline">관리자 모드</span>
            <span className="sm:hidden">관리자</span>
          </button>
        </header>

        <main className="flex-1 flex flex-col justify-center items-center px-6 py-12">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">교사 등록 신청</h2>
              <p className="text-xs text-zinc-500 mt-1.5 font-medium">
                {verificationStatus === "REJECTED"
                  ? "승인이 거절되었습니다. 담당 정보를 수정하여 다시 신청하세요."
                  : "시스템 사용을 위해 이름과 과목을 등록해 주세요."}
              </p>
            </div>

            {registerError && (
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium">
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
                  className="w-full h-11 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">담당 과목</label>
                <input
                  type="text"
                  placeholder="담당 과목을 입력하세요 (예: 수학, 정보)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={registering}
                className="w-full h-12 bg-zinc-900 hover:bg-black text-white font-semibold text-xs rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
              >
                {registering ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 text-zinc-800 font-sans px-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
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
            <h2 className="text-xl font-bold text-zinc-900">승인 대기 중</h2>
            <p className="text-xs text-zinc-500 leading-relaxed font-medium">
              교사 등록 신청이 대기 상태입니다.<br />
              관리자가 승인할 때까지 기다려 주세요.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-600 space-y-1 text-left">
            <div>신청 이름: <span className="text-zinc-900 font-semibold">{teacher?.name}</span></div>
            <div>신청 과목: <span className="text-zinc-900 font-semibold">{teacher?.subject}</span></div>
          </div>

          <button
            onClick={() => verifyTeacherToken(token!)}
            className="text-xs font-semibold px-4 py-2 rounded-full border border-zinc-200 text-zinc-650 hover:text-zinc-900 hover:border-zinc-300 transition-colors cursor-pointer"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  // Render APPROVED teacher dashboard screen
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900 font-sans antialiased selection:bg-zinc-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-2 backdrop-blur-md">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-zinc-900 whitespace-nowrap flex items-center gap-1.5">
            <span className="hidden sm:inline">전북과학고 </span><span>전자허가원</span>
            <span className="text-[10px] sm:text-xs font-semibold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded-md">교사용</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-600 whitespace-nowrap">
            <span className="font-bold text-zinc-900">{teacher?.name}</span>
            <span className="text-zinc-400 font-normal ml-0.5">({teacher?.subject})</span>
          </span>
          <button
            onClick={() => router.push("/admin")}
            className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border border-zinc-200 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="hidden sm:inline">관리 메뉴</span>
            <span className="sm:hidden">관리</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-8 z-10 space-y-6">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">허가원 신청 목록</h2>
            <p className="text-xs text-zinc-500 mt-1">
              학생들이 제출한 야간 자율학습 이동 허가원을 승인하거나 반려합니다.
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loadingDashboard}
            className="h-9 px-3.5 rounded-xl bg-zinc-100 hover:bg-zinc-205 border border-zinc-200 hover:border-zinc-300 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
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
        <div className="flex gap-2 border-b border-zinc-200 pb-3 overflow-x-auto">
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
                  ? "bg-zinc-900 text-white border border-zinc-900"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase">보기 설정 (View Mode)</span>
            <p className="text-xs text-zinc-500 font-medium">허가원을 전체 목록 또는 장소별로 모아서 볼 수 있습니다.</p>
          </div>
          <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 w-full sm:w-auto shrink-0">
            <button
              onClick={() => handleSetViewMode("LIST")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "LIST"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-3.75 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              전체 목록 보기
            </button>
            <button
              onClick={() => handleSetViewMode("LOCATION")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "LOCATION"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              장소별 모아보기
            </button>
          </div>
        </div>

        {/* Dashboard Error */}
        {dashboardError && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium">
            {dashboardError}
          </div>
        )}

        {/* Permits list */}
        {loadingDashboard ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 w-full rounded-2xl bg-zinc-100 border border-zinc-200 animate-pulse"
              />
            ))}
          </div>
        ) : filteredPermits.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-200 rounded-2xl bg-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8 text-zinc-400 mx-auto mb-3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801-12c.065.21.1.433.1.664a2.25 2.25 0 0 1-2.25 2.25 2.25 2.25 0 0 1-2.25-2.25c0-.231.035-.454.1-.664M6.75 7.5H4.853c-1.132 0-2.078.96-2.172 2.096a48.42 48.42 0 0 0-.08 1.123v6.75A2.25 2.25 0 0 0 4.853 19.5h1.9c.066-.21.1-.433.1-.664a2.25 2.25 0 0 1 2.25-2.25 2.25 2.25 0 0 1 2.25 2.25c0 .231-.035.454-.1.664Z"
              />
            </svg>
            <p className="text-xs text-zinc-550 font-medium">조회된 허가원 신청이 없습니다.</p>
          </div>
        ) : viewMode === "LOCATION" ? (
          <div className="space-y-8">
            {sortedLocations.map((locationName) => {
              const locationPermits = groupedPermits[locationName];
              return (
                <div key={locationName} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                        </svg>
                      </div>
                      <h3 className="font-bold text-sm text-zinc-800">
                        {locationName}
                      </h3>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {locationPermits.length}건
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4 pl-3 border-l-2 border-indigo-100/70">
                    {locationPermits.map((permit) => renderPermitCard(permit))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPermits.map((permit) => renderPermitCard(permit))}
          </div>
        )}
      </main>

      {/* Edit Permit Modal */}
      {editingPermit && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
          onClick={handleCloseEditModal}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90dvh] my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-200/80 flex items-center justify-center text-zinc-800">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">허가원 내용 수정</h3>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {formatPermitDate(editingPermit.date)} 신청 내역
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseEditModal}
                disabled={savingEdit}
                className="w-8 h-8 rounded-xl hover:bg-zinc-200/70 text-zinc-400 hover:text-zinc-700 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {editError && (
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium">
                    {editError}
                  </div>
                )}

                {/* 1. 교시 선택 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    1. 교시 선택
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {["야자 1교시", "야자 2교시"].map((p) => {
                      const isSelected = editPeriods.includes(p);
                      return (
                        <button
                          type="button"
                          key={p}
                          onClick={() => toggleEditPeriod(p)}
                          className={`h-10 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                          }`}
                        >
                          {p}
                          {isSelected && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-white">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 장소 선택 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    2. 장소 선택
                  </label>
                  <div className="relative">
                    <select
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl border border-zinc-200 bg-white text-zinc-800 focus:outline-none focus:border-zinc-900 transition-colors text-xs appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundPosition: "right 0.85rem center",
                        backgroundSize: "1.2rem",
                        backgroundRepeat: "no-repeat",
                      }}
                    >
                      <option value="" disabled>장소를 선택하세요</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                          {loc.name}
                        </option>
                      ))}
                      {editLocation && !locations.some((l) => l.name === editLocation) && (
                        <option value={editLocation}>{editLocation}</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* 3. 이동 사유 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    3. 이동 사유
                  </label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="이동 사유를 입력하세요"
                    className="w-full min-h-[70px] p-3 rounded-xl border border-zinc-200 bg-white text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors text-xs resize-none leading-relaxed"
                  />
                </div>

                {/* 4. 신청 학생 목록 */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      4. 신청 학생 ({editApplicants.length}명)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddEditApplicantRow}
                      className="text-xs font-bold text-zinc-800 hover:text-black flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                      </svg>
                      학생 추가
                    </button>
                  </div>

                  <div className="space-y-2">
                    {editApplicants.map((app, index) => (
                      <div key={index} className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          pattern="\d*"
                          maxLength={4}
                          placeholder="학번 (4자리)"
                          value={app.id}
                          onChange={(e) => handleEditApplicantChange(index, "id", e.target.value)}
                          className="w-24 shrink-0 h-10 px-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-800 text-xs text-center font-mono focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                        <input
                          type="text"
                          placeholder="이름"
                          value={app.name}
                          onChange={(e) => handleEditApplicantChange(index, "name", e.target.value)}
                          className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-zinc-200 bg-white text-zinc-800 text-xs focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveEditApplicantRow(index)}
                          disabled={editApplicants.length <= 1}
                          className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl border border-zinc-200 transition-colors ${
                            editApplicants.length <= 1
                              ? "opacity-30 cursor-not-allowed bg-zinc-50 text-zinc-300"
                              : "bg-zinc-50 text-zinc-500 hover:border-rose-200 hover:text-rose-600 hover:bg-rose-50/50 cursor-pointer"
                          }`}
                          title="삭제"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM7.5 3.75A1.25 1.25 0 0 1 8.75 2.5h2.5A1.25 1.25 0 0 1 12.5 3.75v.404c-.833-.035-1.67-.054-2.5-.054s-1.667.019-2.5.054V3.75Zm5.624 2.017-1.127 12.395A1.25 1.25 0 0 1 12.403 17.5H7.597a1.25 1.25 0 0 1-1.246-1.138L5.224 5.767c1.72-.258 3.486-.39 5.276-.39s3.556.132 5.276.39Z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="shrink-0 px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/80 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-black text-white transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs active:scale-[0.98]"
                >
                  {savingEdit ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>저장 중...</span>
                    </>
                  ) : (
                    "수정 완료"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
