import type { Asset } from "./types";
import { sourceNames } from "./provenance";

export interface AssetPresentation {
  schemaVersion: 1;
  sourceFile: string;
  sourceSha256: string;
  title: string;
  summary?: string;
  originalName?: string;
  originalDescription?: string;
  titleSource?: string;
  translation?: string;
  locationLabel?: string;
  threadId?: string;
  date?: string;
}

/** Display metadata only; identity, revisions and exports remain backend-owned. */
export function presentationOf(asset: Asset): AssetPresentation | null {
  const raw = asset.environment?.presentation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (p.schemaVersion !== 1 || typeof p.title !== "string" ||
      typeof p.sourceFile !== "string" || typeof p.sourceSha256 !== "string" ||
      !asset.files.some(f => f.path === p.sourceFile && f.sha256 === p.sourceSha256)) return null;
  const result: AssetPresentation = {schemaVersion: 1, title: p.title, sourceFile: p.sourceFile, sourceSha256: p.sourceSha256};
  for (const key of ["summary", "originalName", "originalDescription", "titleSource", "translation", "locationLabel", "threadId", "date"] as const) {
    if (typeof p[key] === "string") result[key] = p[key];
  }
  return result;
}

export function displayTitle(asset: Asset) {
  const p = presentationOf(asset);
  return p ? p.title + (asset.environment?.enabled === false ? " · 已禁用" : "") : asset.title;
}

export function presentationSearch(asset: Asset) {
  const p = presentationOf(asset);
  return [displayTitle(asset), asset.title, p?.originalName, p?.summary, asset.scope.path,
    asset.source.path, ...sourceNames(asset)].filter(Boolean).join(" ").toLocaleLowerCase();
}

export function shortProject(path: string) {
  return path.replace(/\\/g, "/").replace(/\/$/, "").split("/").pop() || path;
}

const cardDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", month: "short", day: "numeric",
});
export function cardDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : cardDateFormatter.format(date);
}
