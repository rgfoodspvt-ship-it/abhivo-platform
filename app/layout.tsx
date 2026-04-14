'use client';
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <title>Abhivo AI — Haryana Land Intelligence</title>
        <meta name="description" content="AI-powered land records, cadastral maps, and property intelligence for Haryana" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full flex flex-col grain sunrise" style={{ background: '#0F0D0A', color: '#F5F0E8' }}>
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
