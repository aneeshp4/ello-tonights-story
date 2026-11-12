import type { Metadata } from "next";
import { MakePage } from "@/components/make/MakeFlow";

export const metadata: Metadata = { title: "Make tonight's story · Ello" };

export default function Make() {
  return <MakePage />;
}
