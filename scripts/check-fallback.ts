// Validates content/fallback/**.json with the decodable checker. Run: npx tsx scripts/check-fallback.ts
import { FALLBACKS } from "../content/fallback";
import { checkDecodable } from "../lib/story/decodable";
import { SCENES, type Stage } from "../lib/contracts";

let bad = 0;
for (const [key, story] of Object.entries(FALLBACKS)) {
  const stage = Number(key.split("/")[0]) as Stage;
  if (story.pages.length !== 5) { bad++; console.log(`${key}: expected 5 pages`); }
  for (const p of story.pages) {
    const r = checkDecodable(p.text, stage, { themeWords: story.theme_words });
    const sceneOk = (SCENES as readonly string[]).includes(p.scene);
    const hero = p.text.includes("{{hero}}");
    const flag = !r.ok || !sceneOk || !hero;
    if (flag) bad++;
    console.log(`${flag ? "FAIL" : "ok  "} ${key} p${p.n} words=${r.words} off=[${r.offList.join(",")}]${r.tooLong ? " TOO_LONG" : ""}${r.tooShort ? " TOO_SHORT" : ""}${sceneOk ? "" : " BAD_SCENE"}${hero ? "" : " NO_HERO"}`);
  }
}
console.log(bad ? `${bad} problems` : "all fallback pages pass");
process.exit(bad ? 1 : 0);
