import { ImageResponse } from "next/og";
import { ELLO_TEAL, WORDMARK_PATHS, WORDMARK_RATIO, WORDMARK_VIEWBOX } from "@/components/brand/ElloWordmark";

// Home-screen icon (iOS needs PNG): the white Ello wordmark on teal. The browser-tab icon is app/icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const h = 92;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: ELLO_TEAL }}>
        <svg width={Math.round(h * WORDMARK_RATIO)} height={h} viewBox={WORDMARK_VIEWBOX} fill="none">
          {WORDMARK_PATHS.map((d, i) => (
            <path key={i} d={d} fill="#ffffff" />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
