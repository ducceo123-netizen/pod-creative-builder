import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POD Creative Builder",
  description: "Turn competitor product research into original POD creative packs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
