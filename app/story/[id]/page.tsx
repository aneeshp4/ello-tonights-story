import type { Metadata } from "next";
import { Suspense } from "react";
import { Reader } from "@/components/story/Reader";
import { Yello } from "@/components/story/Scene";
import { getStory } from "@/lib/db/stories";

export const metadata: Metadata = { title: "Tonight's Story · Ello", robots: { index: false } };

// Params + getStory are request-time data (cacheComponents), so they live under Suspense.
// The live stream (if this tab started it on /make) is read from the client store inside Reader;
// getStory is only the reload fallback.
export default function StoryPage({ params }: PageProps<"/story/[id]">) {
  return (
    <Suspense fallback={<div className="flex flex-1 flex-col items-center justify-center gap-4"><Yello /><p className="text-h3">Opening the story…</p></div>}>
      <StoryLoader params={params} />
    </Suspense>
  );
}

async function StoryLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = await getStory(id).catch(() => null);
  return <Reader id={id} stored={stored} />;
}
