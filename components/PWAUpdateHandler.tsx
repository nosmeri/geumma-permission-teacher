"use client";

import { useEffect } from "react";

export default function PWAUpdateHandler() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;

    // 새 서비스 워커가 제어권을 잡았을 때(controllerchange) 페이지 자동 새로고침
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    // 서비스 워커 등록 및 업데이트 확인
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // 초기 로드 시 백그라운드 업데이트 체크
        registration.update().catch(() => {});

        // 사용자가 앱/탭으로 복귀했을 때 백그라운드 업데이트 감지
        const handleVisibilityChange = () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        // 주기적 업데이트 체크 (1시간마다)
        const interval = setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);

        return () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          clearInterval(interval);
        };
      })
      .catch((error) => {
        console.error("PWA ServiceWorker registration failed:", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
