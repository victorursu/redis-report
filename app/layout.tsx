// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import StickyHeader from "@/components/StickyHeader";

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
    <head>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const theme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldBeDark = theme === 'dark' || (!theme && prefersDark);
                const root = document.documentElement;
                root.classList.remove('dark', 'light');
                if (shouldBeDark) {
                  root.classList.add('dark');
                } else {
                  root.classList.add('light');
                }
              } catch (e) {}
            })();
          `,
        }}
      />
    </head>
    {/* Also suppress on <body> */}
    <body suppressHydrationWarning className="min-h-screen bg-white dark:bg-gray-900 text-neutral-900 dark:text-gray-100 transition-colors">
      <ThemeProvider>
        <StickyHeader />
        <main className="bg-white dark:bg-gray-900 min-h-screen">{children}</main>
      </ThemeProvider>
    </body>
    </html>
  );
}
