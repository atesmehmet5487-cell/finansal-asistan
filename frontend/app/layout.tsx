import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Finansal Asistan — BIST & Emtia Analiz",
  description: "Türk borsası ve emtia odaklı gerçek zamanlı finansal bilgi sistemi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body
        className="frame"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          padding: 18,
        }}
      >
        <div className="bot" />
        <Navbar />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
