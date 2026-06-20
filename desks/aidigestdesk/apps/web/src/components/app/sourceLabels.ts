import type { SourceRef } from "@aidigestdesk/content";

export type SourceKindFilter = SourceRef["kind"] | "all";

export function sourceKindLabel(kind: SourceRef["kind"]) {
  switch (kind) {
    case "official":
      return "공식";
    case "benchmark":
      return "벤치마크";
    case "publisher":
      return "출판사/기관";
    case "community":
      return "커뮤니티";
  }
}

export const sourceKindFilters: Array<{
  id: SourceKindFilter;
  label: string;
}> = [
  { id: "all", label: "전체" },
  { id: "official", label: sourceKindLabel("official") },
  { id: "benchmark", label: sourceKindLabel("benchmark") },
  { id: "publisher", label: sourceKindLabel("publisher") },
  { id: "community", label: sourceKindLabel("community") },
];
