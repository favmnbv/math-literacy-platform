import type { Metadata } from "next";
import "@fontsource-variable/golos-text";
import "@fontsource-variable/literata";
import "./globals.css";
import "katex/dist/katex.min.css";
export const metadata: Metadata = {
  title: "Талан · Математическая грамотность",
  description: "Учебная платформа образовательного центра Талан",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
