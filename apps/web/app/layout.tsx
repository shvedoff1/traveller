import "./globals.css";

import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Traveller",
  description: "Mark the countries you have visited on an interactive globe.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
