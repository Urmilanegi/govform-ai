import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FillKaro — AI Form Filler",
  description: "Sarkari forms 5 minute mein — SSC, Railway, UPSC, Banking. AI sab kuch automatic bharega.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <div className="app-shell">
          {children}
        </div>
      </body>
    </html>
  );
}
