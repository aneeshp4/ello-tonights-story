import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintView } from "@/components/story/PrintView";
import { Yello } from "@/components/story/Scene";
import { getStory } from "@/lib/db/stories";

export const metadata: Metadata = { title: "Print · Tonight's Story", robots: { index: false } };

export default function PrintPage({ params }: PageProps<"/print/[id]">) {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Yello /></div>}>
      <PrintLoader params={params} />
    </Suspense>
  );
}

async function PrintLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = await getStory(id).catch(() => null);
  return <PrintView id={id} stored={stored} />;
}
