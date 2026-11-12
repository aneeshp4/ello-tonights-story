import type { Metadata } from "next";
import { Suspense } from "react";
import { HERO_TOKEN } from "@/lib/contracts";
import { SharedStory } from "@/components/story/SharedStory";
import { Yello } from "@/components/story/Scene";
import { getStory } from "@/lib/db/stories";

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await getStory(id).catch(() => null);
  const title = s ? `${(s.title || "A bedtime story").split(HERO_TOKEN).join(s.fun_name)} · Tonight's Story` : "Tonight's Story · Ello";
  const description = "A story a kid read by themselves tonight. Make a free one about the thing your kid loves, from Ello.";
  return { title, description, openGraph: { title, description, type: "article", siteName: "Tonight's Story by Ello" } };
}

// Read-only shared story. Hero is always the fun_name (the real name is never stored).
export default function SharedPage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Yello /></div>}>
      <SharedLoader params={params} />
    </Suspense>
  );
}

async function SharedLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = await getStory(id).catch(() => null);
  return <SharedStory id={id} stored={stored} />;
}
