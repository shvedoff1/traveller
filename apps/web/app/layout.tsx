import "./globals.css";

import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";

import { Header } from "../components/header";
import { Toaster } from "../components/ui/Toaster";
import { THEME_INIT_SCRIPT } from "../lib/theme";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Traveller",
  description: "Mark the countries you have visited on an interactive globe.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below stamps `data-theme`
    // on <html> before hydration, which React must not try to reconcile.
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <head>
        {/* Apply the persisted/OS theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <Providers>
          <Header />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
