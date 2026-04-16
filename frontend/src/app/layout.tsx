import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Conciliacao Philips-Stankhelp",
  description: "Sistema de conciliacao de reembolsos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
