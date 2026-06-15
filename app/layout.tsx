import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "3D Mood — The Gallery for 3D Graphic Designers",
  description:
    "A premium 3D artwork gallery experience for designers. Upload, light, and showcase your 3D work in a cinematic black stage environment.",
  keywords: ["3D design", "mood board", "3D gallery", "graphic design", "GLTF viewer"],
  openGraph: {
    title: "3D Mood",
    description: "Premium 3D artwork gallery for designers.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full`}
    >
      <body className="min-h-full bg-black text-white antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
