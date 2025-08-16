// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redis Dashboard",
  description: "Live metrics for a Redis host",
};

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  return (
    // Ignore extension-injected attrs (e.g., Grammarly) during hydration
    <html lang="en" suppressHydrationWarning>
    {/* Also suppress on <body> */}
    <body suppressHydrationWarning className="min-h-screen bg-neutral-50 text-neutral-900">
    {children}
    </body>
    </html>
  );
}
