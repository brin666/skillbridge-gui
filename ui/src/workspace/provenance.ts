import type { Asset, Environment } from "./types";

/** One backend asset can be referenced by several Harnesses. */
export function sourceEnvironments(asset: Asset): Environment[] {
  const env = asset.environment;
  const refs = env?.sources;
  if (Array.isArray(refs)) {
    const sources = refs.filter((item): item is Environment =>
      !!item && typeof item === "object" && !Array.isArray(item) &&
      typeof item.harness === "string" && !!item.harness.trim());
    if (sources.length) return sources;
  }
  return env ? [env] : [];
}

export function sourceNames(asset: Asset): string[] {
  const names = [...new Set(sourceEnvironments(asset).map(e => e.harness).filter((s): s is string => !!s))];
  return names.length ? names : ["未标明应用"];
}
