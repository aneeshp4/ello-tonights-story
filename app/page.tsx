import { Landing } from "@/components/landing/Landing";

// proxy.ts rewrites `/` to `/landing/{a|b}` based on the `ello_v` cookie, so this
// only renders if the proxy is bypassed. Falls back to headline A.
export default function Home() {
  return <Landing h="a" />;
}
