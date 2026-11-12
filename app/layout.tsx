import type { Metadata, Viewport } from "next";
import { Andika, Nunito } from "next/font/google";
import "./globals.css";

// Brand font "Wallop" is commercial; Nunito (UI) and Andika (early-reader story
// text) stand in. Exposed as CSS variables consumed by styles/ello.css.
// Nunito is a variable font, so the 450/550 weights in the brand scale render exactly.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const andika = Andika({
  variable: "--font-andika",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tonight's Story · Ello",
  description:
    "A decodable bedtime story about your kid's favorite thing, at their reading level. From Ello, the AI reading teacher for kids 5–9.",
};

export const viewport: Viewport = {
  themeColor: "#E5FFFD",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${andika.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
