// Stand-in for Ello's yellow mascot: a rounded yellow blob with two dark eyes.
// Pure SVG, no client JS. Sizes: sm 40px, md 72px, lg 120px.
type Size = "sm" | "md" | "lg";
const PX: Record<Size, number> = { sm: 40, md: 72, lg: 120 };

export function Yello({
  size = "md",
  className,
  title,
}: {
  size?: Size;
  className?: string;
  /** Accessible label; omit to mark it decorative. */
  title?: string;
}) {
  const px = PX[size];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* soft ground shadow */}
      <ellipse cx="50" cy="93" rx="30" ry="4" fill="var(--ello-ink-lighter, #deebf1)" />
      {/* body: squishy blob, slightly wider at the bottom */}
      <path
        d="M50 8c22 0 38 16 39 40 1 22-10 40-39 40S10 70 11 48C12 24 28 8 50 8z"
        fill="var(--ello-yellow-light, #ffc800)"
      />
      {/* highlight */}
      <ellipse cx="34" cy="26" rx="9" ry="5" fill="#fff" opacity=".45" transform="rotate(-25 34 26)" />
      {/* eyes */}
      <ellipse cx="38" cy="48" rx="5" ry="7" fill="var(--ello-ink-darker, #0f3a4d)" />
      <ellipse cx="62" cy="48" rx="5" ry="7" fill="var(--ello-ink-darker, #0f3a4d)" />
      <circle cx="39.5" cy="45.5" r="1.6" fill="#fff" />
      <circle cx="63.5" cy="45.5" r="1.6" fill="#fff" />
      {/* cheeks */}
      <ellipse cx="28" cy="60" rx="5" ry="3" fill="var(--ello-red-light, #ff8d8d)" opacity=".55" />
      <ellipse cx="72" cy="60" rx="5" ry="3" fill="var(--ello-red-light, #ff8d8d)" opacity=".55" />
    </svg>
  );
}

export default Yello;
