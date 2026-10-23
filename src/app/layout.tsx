import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AppTabBar, AppTopBar } from "@/app/_components/app-nav";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fitness & Self-Improvement OS",
  description:
    "Track daily metrics and macros, build habits, and log progressive-overload workouts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Bottom bar reservation on phones; the desktop bar is at the top. */}
      <body className="min-h-full flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <AppTopBar />
        {children}
        <AppTabBar />
        {/* Top-center clears the fixed bottom tab bar and its safe-area inset. */}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
