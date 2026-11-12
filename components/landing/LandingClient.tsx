"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { HeadlineVariant } from "@/lib/contracts";
import { attributionQuery } from "@/lib/attribution";
import { flush, track } from "@/lib/track";

/** Fires landing_viewed once per mount. */
export function LandingViewed({ h }: { h: HeadlineVariant }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("landing_viewed", { h });
  }, [h]);
  return null;
}

/** Primary CTA → /make, carrying ref/utm forward (cookie also has them). */
export function MakeStoryCta({ source = "landing", className = "ello-btn" }: { source?: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href="/make"
      className={className}
      onClick={(e) => {
        track("cta_clicked", { source });
        void flush(); // keepalive fetch: survives the navigation
        const qs = attributionQuery();
        if (qs && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          // keep ref/utm visible in the /make URL
          e.preventDefault();
          router.push(`/make${qs}`);
        }
      }}
    >
      Make tonight&apos;s story
    </Link>
  );
}
