import type { Metadata, Viewport } from "next";
import { Caveat, Courier_Prime, Figtree, Fraunces } from "next/font/google";
import "./globals.css";

/**
 * Four typefaces, each with one job:
 *  - Fraunces: soft, slightly wonky serif for headings - warm, not corporate
 *  - Figtree:  friendly, very readable sans for everything you actually read
 *  - Caveat:   handwriting, for the margin notes and little asides
 *  - Courier Prime: typewriter, for text lifted out of screenshots
 * next/font downloads them at build time and serves them from our own domain,
 * so no request goes to Google when someone opens the app.
 */
const fraunces = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], variable: "--font-fraunces", display: "swap" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["400"], variable: "--font-courier", display: "swap" });

export const metadata: Metadata = {
  title: "DayTrace - remembers your unfinished business",
  description:
    "Drop in notes, messages and screenshot text. DayTrace pulls out what you owe, what you're waiting on and when, connects related things, and hands you a gentle list each morning.",
  applicationName: "DayTrace",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5eddf" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1814" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${figtree.variable} ${caveat.variable} ${courier.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
