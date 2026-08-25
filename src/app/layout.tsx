import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Furigana Editor",
  description: "Japanese writing practice with furigana readings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
