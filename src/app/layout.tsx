import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BluePlanet CRM | Stone Operations",
  description: "Natural stone inventory, logistics, and sales pipeline — basalt, vein gold, operational clarity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${fraunces.variable} bg-[var(--color-basalt-850)] text-[var(--color-text-primary)] antialiased h-screen overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
