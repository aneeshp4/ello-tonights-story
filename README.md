# Tonight's Story

Lead gen prototype for Ello: a decodable, printable story about your kid's obsession, at their reading level.

## Develop

```bash
npm install
cp .env.example .env.local   # add OPENROUTER_API_KEY + Supabase keys
npm run dev                  # http://localhost:3000
```

`npm run build && npm start` runs the production server (respects `$PORT`). Deployed on Render via `render.yaml`.

## Styling

- `styles/ello.css` is the single source of truth for brand values (`--ello-*` variables) plus base styles and `.ello-*` component classes.
- `app/globals.css` maps those variables onto Tailwind v4 theme tokens with `@theme inline` (`bg-teal`, `text-ink-dark`, `bg-pastel-cyan`, `font-story`, `text-h1`, `rounded-ello-lg`, `shadow-press`, …). Tailwind's default color palette is cleared, so only brand colors exist.
- Fonts: Nunito (UI) and Andika (story text) via `next/font`, standing in for the commercial brand font Wallop.
