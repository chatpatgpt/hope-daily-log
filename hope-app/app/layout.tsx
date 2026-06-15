import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hope's Walk Tracker",
  description: "Track Hope's daily walks and bathroom habits",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
