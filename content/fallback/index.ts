// Registry of pre-written, human-reviewed fallback stories (AGENT_PLAN.md §13).
// Keyed "{stage}/{interest|generic}". Text uses the {{hero}} token.
import type { Scene, Stage } from "../../lib/contracts";
import s0generic from "./0/generic.json";
import s1generic from "./1/generic.json";
import s2generic from "./2/generic.json";
import s3generic from "./3/generic.json";
import s4generic from "./4/generic.json";
import s1trucks from "./1/trucks.json";
import s2trucks from "./2/trucks.json";
import s3trucks from "./3/trucks.json";
import s1dinosaurs from "./1/dinosaurs.json";
import s2dinosaurs from "./2/dinosaurs.json";
import s3dinosaurs from "./3/dinosaurs.json";
import s1space from "./1/space.json";
import s2space from "./2/space.json";
import s3space from "./3/space.json";
import s1sharks from "./1/sharks.json";
import s2sharks from "./2/sharks.json";
import s3sharks from "./3/sharks.json";

export interface FallbackStory {
  title: string;
  theme_words: string[];
  pages: { n: number; text: string; scene: Scene }[];
}

export const FALLBACKS = {
  "0/generic": s0generic, "1/generic": s1generic, "2/generic": s2generic, "3/generic": s3generic, "4/generic": s4generic,
  "1/trucks": s1trucks, "2/trucks": s2trucks, "3/trucks": s3trucks,
  "1/dinosaurs": s1dinosaurs, "2/dinosaurs": s2dinosaurs, "3/dinosaurs": s3dinosaurs,
  "1/space": s1space, "2/space": s2space, "3/space": s3space,
  "1/sharks": s1sharks, "2/sharks": s2sharks, "3/sharks": s3sharks,
} as Record<string, FallbackStory>;

export function fallbackStory(stage: Stage, interest: string): FallbackStory {
  return FALLBACKS[`${stage}/${interest}`] ?? FALLBACKS[`${stage}/generic`];
}
