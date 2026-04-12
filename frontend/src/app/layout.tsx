import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import SettlementPopup from "@/components/SettlementPopup";
import ToastNotifications from "@/components/ToastNotifications";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "odds.",
  description: "Prediction markets for your friend group",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "odds.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AuthProvider>
          {children}
          <SettlementPopup />
          <ToastNotifications />
        </AuthProvider>
      </body>
    </html>
  );
}
