import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const archivo = localFont({ src: "./fonts/archivo-variable.ttf", variable: "--font-archivo", display: "swap" });
const geist = localFont({ src: "./fonts/geist-variable.ttf", variable: "--font-geist", display: "swap" });
const geistMono = localFont({ src: "./fonts/geist-mono-variable.ttf", variable: "--font-geist-mono", display: "swap" });
const myanmar = localFont({ src: "./fonts/myanmar-sagar.ttf", variable: "--font-myanmar", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Project Peak Control Room", template: "%s · Project Peak Admin" },
  description: "Project Peak websites နှစ်ခုလုံးအတွက် unified admin dashboard။",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/icon.png", apple: "/brand/icon.png" },
};

export const viewport: Viewport = { themeColor: "#07131c", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="my" className={`${archivo.variable} ${geist.variable} ${geistMono.variable} ${myanmar.variable}`}>
      <body>{children}<Toaster richColors position="top-right" /></body>
    </html>
  );
}
