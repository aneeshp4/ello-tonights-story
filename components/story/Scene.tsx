// CSS + emoji scene art, one per SCENES key. No images.
import type { Scene as SceneKey } from "@/lib/contracts";

type Art = { bg: string; ground?: string; sky: string[]; floor: string[] };

const ART: Record<SceneKey, Art> = {
  "outdoors-day": { bg: "linear-gradient(#9cf0ff, #e5fffd)", ground: "#75f0c0", sky: ["☀️", "☁️"], floor: ["🌳", "🌼", "🌷"] },
  "outdoors-night": { bg: "linear-gradient(#0f3a4d, #175773)", ground: "#075948", sky: ["🌙", "⭐", "✨"], floor: ["🌲", "🦉"] },
  bedroom: { bg: "linear-gradient(#facaff, #fcf5ff)", ground: "#f09bff", sky: ["🪟", "🖼️"], floor: ["🛏️", "🧸", "📚"] },
  kitchen: { bg: "linear-gradient(#ffdd00, #fbf9f3)", ground: "#ffc800", sky: ["🕰️"], floor: ["🍳", "🥕", "🍪"] },
  water: { bg: "linear-gradient(#72dcff, #3dc1ff)", ground: "#4c93ff", sky: ["☀️", "🐦"], floor: ["🐟", "🐚", "🌊"] },
  space: { bg: "linear-gradient(#0f02a0, #4d0076)", sky: ["🪐", "⭐", "🌟"], floor: ["🚀", "🌑"] },
  forest: { bg: "linear-gradient(#e6fff1, #75f0c0)", ground: "#07a180", sky: ["🐦", "☁️"], floor: ["🌲", "🍄", "🌲"] },
  city: { bg: "linear-gradient(#cffafa, #f3f9fb)", ground: "#a3c0cc", sky: ["☁️", "🏢"], floor: ["🏠", "🚦", "🏪"] },
  farm: { bg: "linear-gradient(#9cf0ff, #fbf9f3)", ground: "#ffc800", sky: ["☀️"], floor: ["🐄", "🌾", "🐔"] },
  castle: { bg: "linear-gradient(#facaff, #e5fffd)", ground: "#75f0c0", sky: ["🚩", "☁️"], floor: ["🏰", "🌹"] },
  "sports-field": { bg: "linear-gradient(#9cf0ff, #e6fff1)", ground: "#0ad3a1", sky: ["☀️", "🎉"], floor: ["🥅", "⚽", "🏃"] },
};

const INTEREST_EMOJI: Record<string, string> = {
  dinosaurs: "🦕", trucks: "🚚", space: "🚀", dogs: "🐶", sharks: "🦈", soccer: "⚽",
  mermaids: "🧜", robots: "🤖", bugs: "🐛", cooking: "🍕", castles: "🏰", unicorns: "🦄",
};

export function interestEmoji(interest: string): string {
  return INTEREST_EMOJI[interest] ?? "⭐";
}

export function Scene({ scene, interest, size = "md" }: { scene: SceneKey; interest: string; size?: "sm" | "md" }) {
  const a = ART[scene] ?? ART["outdoors-day"];
  const h = size === "sm" ? "h-32" : "h-44";
  return (
    <div
      className={`relative ${h} w-full overflow-hidden rounded-ello-lg select-none`}
      style={{ background: a.bg }}
      role="img"
      aria-label={`Picture: ${scene.replace("-", " ")}`}
    >
      <div className="absolute inset-x-0 top-3 flex justify-between px-6 text-3xl">
        {a.sky.map((e, i) => <span key={i} className={i === 1 ? "mt-4" : ""}>{e}</span>)}
      </div>
      {a.ground && <div className="absolute inset-x-0 bottom-0 h-1/3 rounded-t-[50%]" style={{ background: a.ground }} />}
      <div className="absolute inset-x-0 bottom-3 flex items-end justify-between px-5 text-4xl">
        {a.floor.map((e, i) => <span key={i} className={i === 2 ? "absolute right-[28%] bottom-0 text-2xl" : ""}>{e}</span>)}
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-6xl drop-shadow-sm animate-[ello-bob_2.4s_ease-in-out_infinite]">
        {interestEmoji(interest)}
      </div>
      <style>{`@keyframes ello-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

/** Yello: a little yellow buddy, pure CSS. */
export function Yello({ size = 88, bounce = true }: { size?: number; bounce?: boolean }) {
  return (
    <div
      aria-hidden
      className={bounce ? "animate-bounce" : ""}
      style={{ width: size, height: size }}
    >
      <div className="relative h-full w-full rounded-full bg-sun-light shadow-[inset_0_-8px_0_var(--ello-yellow)]">
        <span className="absolute left-[28%] top-[34%] h-[14%] w-[11%] rounded-full bg-ink-darker" />
        <span className="absolute right-[28%] top-[34%] h-[14%] w-[11%] rounded-full bg-ink-darker" />
        <span className="absolute left-1/2 top-[56%] h-[12%] w-[30%] -translate-x-1/2 rounded-b-full bg-coral" />
      </div>
    </div>
  );
}
