import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pips Poker",
  description:
    "A split-pot Texas Hold'em variant: half the pot to the best 5-card poker hand, half to the highest pip total of your 3 hole cards.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-felt-dark font-sans antialiased">{children}</body>
    </html>
  );
}
