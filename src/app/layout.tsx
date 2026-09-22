import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "streambits | Flash firmware to your board",
  description: "Plug in a board, pick a firmware file, press Flash.",
};

/**
 * Playarka themes by a `.dark` class on <html> and follows the system by
 * default. This runs before paint so the first frame is already the right
 * theme, and tracks the preference while the tab stays open.
 */
const THEME_SYNC = `(function(){try{var m=window.matchMedia('(prefers-color-scheme: dark)');var r=document.documentElement;var s=function(){r.classList.toggle('dark',m.matches)};s();m.addEventListener('change',s)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SYNC }} />
      </head>
      <body className="h-full bg-background font-sans text-foreground">{children}</body>
    </html>
  );
}
