import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vextrus",
  description: "Drawing to estimate to bid.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
