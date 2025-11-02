// /src/app/layout.tsx
import "./globals.css";
import Providers from "@/components/Providers";
import { ReactNode } from "react";
export { metadata } from "@/components/Metadata";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`min-h-screen ${geistMono.variable} ${geistSans.variable} `}>
        <Providers>
          <div>{children}</div>
        </Providers>
      </body>
    </html>
  );
}
