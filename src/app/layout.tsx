import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lightweight ATS",
  description: "Lightweight Applicant Tracking System",
};

import { RecruiterProvider } from "@/context/RecruiterContext";
import { getRecruiters } from "@/app/actions/recruiters";

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const recruiters = await getRecruiters();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RecruiterProvider initialRecruiters={recruiters}>
          {children}
        </RecruiterProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
