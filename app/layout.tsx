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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ello-tonights-story.onrender.com";
const TITLE = "Tonight's Story by Ello";
const DESCRIPTION =
  "A free bedtime story about the thing your kid loves, written at exactly their reading level so they can read it themselves. From Ello, the AI reading teacher for ages 5–9.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Tonight's Story by Ello" },
  description: DESCRIPTION,
  applicationName: TITLE,
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
