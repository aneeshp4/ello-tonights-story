import { Landing } from "@/components/landing/Landing";

// Headline variant A. proxy.ts rewrites `/` here (URL stays `/`), so each variant
// is fully static HTML with the right headline in the first byte: no flash.
export default function LandingA() {
  return <Landing h="a" />;
}
