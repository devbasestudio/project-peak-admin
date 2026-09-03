import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";

const archivo = localFont({ src: "./fonts/english/heading/archivo-extra-bold.ttf", variable: "--font-archivo", weight: "800", display: "swap" });
const englishSubheading = localFont({ src: "./fonts/english/subheading/archivo-semi-bold.ttf", variable: "--font-english-subheading", weight: "600", display: "swap", preload: false });
const smallTitle = localFont({ src: "./fonts/english/small-title/albert-sans-semi-bold.ttf", variable: "--font-geist-mono", weight: "600", display: "swap", preload: false });
const geist = localFont({ src: "./fonts/english/body/geist-variable.ttf", variable: "--font-geist", weight: "100 900", display: "swap", preload: false });
const myanmarHeading = localFont({ src: "./fonts/myanmar/subheading/pt21-mandalay-bold.ttf", variable: "--font-myanmar-heading", weight: "700", display: "swap", preload: false });
const myanmarBody = localFont({ src: "./fonts/myanmar/body/shwe-pa-chi-04-medium.ttf", variable: "--font-myanmar", weight: "500", display: "swap" });

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
    <html lang="my" className={`${archivo.variable} ${englishSubheading.variable} ${smallTitle.variable} ${geist.variable} ${myanmarHeading.variable} ${myanmarBody.variable}`}>
      <body>{children}<Toaster richColors position="top-right" /></body>
    </html>
  );
}
