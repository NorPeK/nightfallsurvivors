import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NORPEK: Nightfall Survivors",
  description:
    "A dark gothic horde-survival game. Survive 30 minutes, slay the Reaper, claim the dawn.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06060c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-[#06060c] text-zinc-100 antialiased select-none">
        {children}
      </body>
    </html>
  );
}
