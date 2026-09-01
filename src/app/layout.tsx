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
  description: "Project Peak websites သုံးခုလုံးအတွက် unified admin dashboard။",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/brand/favicon-32.png",
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = { themeColor: "#07131c", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="my" className={`${archivo.variable} ${geist.variable} ${geistMono.variable} ${myanmar.variable}`}>
      <body>{children}<Toaster richColors position="top-right" /></body>
    </html>
  );
}
