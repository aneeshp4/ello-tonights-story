import { ImageResponse } from "next/og";

// Site-wide share card (also used for twitter:image via twitter-image.tsx).
// Static: generated at build time. Uses the built-in font to stay dependency-free.
export const alt = "Tonight's Story by Ello: a story your kid can read by themselves";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#e5fffd",
          padding: 72,
          gap: 56,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 30, color: "#07a180", fontWeight: 700, marginBottom: 20 }}>
            Tonight&apos;s Story by Ello
          </div>
          <div style={{ fontSize: 64, lineHeight: 1.15, color: "#0f3a4d", fontWeight: 700 }}>
            A story your kid can read by themselves. About the thing they love.
          </div>
          <div style={{ fontSize: 28, color: "#175773", marginTop: 28 }}>
            Free · at exactly their reading level · ready in seconds
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 280, height: 280 }}>
          <div
            style={{
              width: 280,
              height: 270,
              background: "#ffc800",
              borderRadius: "50% 50% 46% 46%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 56,
            }}
          >
            <div style={{ width: 30, height: 42, borderRadius: "50%", background: "#0f3a4d" }} />
            <div style={{ width: 30, height: 42, borderRadius: "50%", background: "#0f3a4d" }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
