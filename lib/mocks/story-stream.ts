// Client-side mocks for APIs owned by other agents.
//
// Used when NEXT_PUBLIC_MOCK_STORY=1, or automatically when the real endpoint
// returns 404 (i.e. the route isn't merged yet). To turn mocks off: unset
// NEXT_PUBLIC_MOCK_STORY (or set it to anything but "1") once /api/story and
// /api/lead exist. The 404 fallback is then never hit.
//
// Testing hooks (mock only): hero "Reject" -> {type:"rejected", field:"hero"};
// custom interest "reject" -> {type:"rejected", field:"interest", suggestion:"trucks"};
// hero "Oops" -> {type:"error"} after page 2.
import type { LeadRequest, LeadResponse, StoryPage, StoryRequest, StreamMsg } from "../contracts";
import { HERO_TOKEN } from "../contracts";

export const MOCK_ENABLED = process.env.NEXT_PUBLIC_MOCK_STORY === "1";

export const MOCK_STORY = {
  title: `${HERO_TOKEN} and the Big Red Truck`,
  theme_words: ["bulldozer"],
  pages: [
    { n: 1, scene: "outdoors-day", text: `${HERO_TOKEN} has a big red truck. The truck can dump sand and mud. ${HERO_TOKEN} sits in the cab. It is a fun job!` },
    { n: 2, scene: "city", text: `${HERO_TOKEN} must fix the path to the shop. ${HERO_TOKEN} fills the truck with rocks. Crunch! Thud! The truck is full.` },
    { n: 3, scene: "forest", text: `Then the truck gets stuck in a big mud pit. ${HERO_TOKEN} pushes and pulls. The truck will not budge. Splash!` },
    { n: 4, scene: "farm", text: `A bulldozer stops next to ${HERO_TOKEN}. It has a strong chain. Chug, chug! It drags the red truck from the mud.` },
    { n: 5, scene: "outdoors-night", text: `${HERO_TOKEN} dumps the rocks. The path is fixed! At dusk, ${HERO_TOKEN} spots a shell in the sand. It has a lock on it. What is in the shell?` },
  ] as Omit<StoryPage, "source">[],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockId(): string {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

const fill = (t: string, hero: string) => t.split(HERO_TOKEN).join(hero);

/** NDJSON stream shaped exactly like POST /api/story (see lib/contracts.ts StreamMsg). */
export function mockStoryStream(req: StoryRequest): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (m: StreamMsg) => controller.enqueue(enc.encode(JSON.stringify(m) + "\n"));
      await sleep(250);
      if (req.hero.trim().toLowerCase() === "reject") {
        send({ type: "rejected", field: "hero" });
        return controller.close();
      }
      if (req.interest_custom && req.interest.trim().toLowerCase() === "reject") {
        send({ type: "rejected", field: "interest", suggestion: "trucks" });
        return controller.close();
      }
      send({ type: "story", id: mockId(), title: fill(MOCK_STORY.title, req.hero), theme_words: MOCK_STORY.theme_words });
      await sleep(950); // ~1.2s to page 1
      for (const p of MOCK_STORY.pages) {
        send({ type: "page", ...p, text: fill(p.text, req.hero), source: "model" });
        if (p.n === 2 && req.hero.trim().toLowerCase() === "oops") {
          send({ type: "error", message: "mock error" });
          return controller.close();
        }
        if (p.n < 5) await sleep(1500);
      }
      send({ type: "done", status: "complete" });
      controller.close();
    },
  });
}

export async function mockLead(req: LeadRequest): Promise<LeadResponse> {
  await sleep(400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.email.trim())) return { ok: false, error: "invalid_email" };
  return { ok: true, lead_id: `mock-${mockId()}` };
}
