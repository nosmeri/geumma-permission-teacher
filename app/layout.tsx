import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PWAUpdateHandler from "@/components/PWAUpdateHandler";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "전북과학고 전자허가원 (교사용)",
  description: "전북과학고등학교 야간 자율학습 이동 허가원 승인 및 관리 서비스 (교사용)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <PWAUpdateHandler />
        {children}
      </body>
    </html>
  );
}
