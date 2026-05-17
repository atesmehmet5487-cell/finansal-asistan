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
      <body className="bg-bg-primary text-text-primary min-h-screen">
        <div className="bg-grid fixed inset-0 pointer-events-none opacity-30" />
        <div className="relative z-10">
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>
          <footer className="text-center text-text-muted text-xs py-6 border-t border-border mt-12">
            <p>Bu platform yalnızca bilgilendirme amacıyla hizmet vermektedir.</p>
            <p className="mt-1">Sunulan içerikler yatırım tavsiyesi niteliği taşımaz. Finansal kararlarınız için lisanslı danışmana başvurunuz.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
