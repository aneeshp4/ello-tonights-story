import { InterestChips } from "./interest-chips";

// Style-check skeleton: proves Tailwind token utilities and .ello-* classes both work.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-h1 text-ink-dark">Tonight&apos;s Story</h1>
        <p className="text-body text-ink">
          A bedtime story about your kid&apos;s favorite thing, at just the
          right reading level.
        </p>
      </header>

      <section className="ello-card flex flex-col gap-4">
        <h2 className="text-h3 text-ink-dark">What are they into?</h2>
        <InterestChips />
      </section>

      <section className="rounded-ello-lg bg-pastel-teal p-6 shadow-card">
        <p className="mb-2 text-body-s font-bold uppercase tracking-wide text-teal-dark">
          Sample story
        </p>
        <p className="ello-story">
          Sam has a big red truck. The truck can go fast. Sam and Dad hop in
          and zip to the fire!
        </p>
        <p className="mt-4 font-story text-story text-ink-darker">
          The dog sat on a mat. It is a fun pup.
        </p>
      </section>

      <form className="flex flex-col gap-4">
        <label htmlFor="email" className="text-body font-semibold">
          Get the printable + next chapters
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="ello-input"
        />
        <button type="button" className="ello-btn">
          Make tonight&apos;s story
        </button>
        <button type="button" className="ello-btn ello-btn--secondary">
          Maybe later
        </button>
        <button
          type="button"
          className="rounded-full bg-sun px-6 py-3 text-button text-ink-darker shadow-press active:translate-y-1 active:shadow-none"
        >
          Tailwind-only button
        </button>
      </form>
    </main>
  );
}
