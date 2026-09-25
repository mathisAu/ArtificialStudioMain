import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";

import { themeAttribute } from "@/lib/theme";
import { readTheme } from "@/lib/theme-server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Artificial Studio · Projecten",
    template: "%s · Artificial Studio",
  },
  description:
    "Projectmanagement en klantportaal: projecten, taken, feedback, documenten en facturen op één plek.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // De keuze staat al in de HTML die de server stuurt, dus je ziet geen flits
  // van het verkeerde thema. Zonder attribuut geldt `prefers-color-scheme`.
  const theme = themeAttribute(await readTheme());

  return (
    <html
      lang="nl"
      data-theme={theme}
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            },
          }}
        />
      </body>
    </html>
  );
}
