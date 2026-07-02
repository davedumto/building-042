import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Display: bold geometric sans for the oversized editorial headlines.
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Body: highly legible sans for copy and form fields.
const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

// Mono: powers the "Builder No. 0042 / Enugu" serial motif and labels.
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "The Enugu Creative Movement · Who Is Building Enugu?",
  description:
    "Not a community. A movement. Claim your spot among the builders of Enugu: creatives, founders, and students turning skill into income.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base text-ink">{children}</body>
    </html>
  );
}
