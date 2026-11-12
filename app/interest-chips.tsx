"use client";

import { useState } from "react";

const INTERESTS = [
  { id: "dinosaurs", label: "🦖 Dinosaurs" },
  { id: "fire-trucks", label: "🚒 Fire trucks" },
  { id: "sharks", label: "🦈 Sharks" },
];

export function InterestChips() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Interests">
      {INTERESTS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className="ello-chip"
          aria-pressed={selected === id}
          onClick={() => setSelected(selected === id ? null : id)}
        >
          {label}
        </button>
      ))}
      {/* Same chip built purely from Tailwind token classes */}
      <button
        type="button"
        aria-pressed={selected === "space"}
        onClick={() => setSelected(selected === "space" ? null : "space")}
        className="cursor-pointer rounded-full border-2 border-ink-lighter bg-white px-4 py-3 font-semibold leading-none text-ink-dark aria-pressed:border-grape aria-pressed:bg-pastel-purple aria-pressed:text-grape-darker"
      >
        🚀 Space
      </button>
    </div>
  );
}
