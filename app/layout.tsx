import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Westijn Profiler",
  description: "Genereer professionele CV's voor Harvest kandidaten",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full">
      <body className="min-h-full flex flex-col bg-harvest-bg text-harvest-dark">
        {children}
      </body>
    </html>
  );
}
