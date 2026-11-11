export type Kind = "skill" | "rule" | "memory" | "mcp" | "ledger";
export type JsonObject = Record<string, unknown>;
export interface Problem {
  code: string;
  message?: string;
  assetId?: string;
  path?: string;
  field?: string;
  details?: JsonObject;
}
export interface Omission {
  path: string;
  reason: string;
  assetId?: string;
}
export interface FileEntry {
  path: string;
  size: number;
  sha256: string;
}
export interface Scope {
  type: "personal" | "project" | "environment";
  path?: string;
  [key: string]: unknown;
}
export interface Environment {
  id?: string;
  harness?: string;
  agent?: string;
  version?: string | null;
  skillRoots?: string[];
  [key: string]: unknown;
}
export interface Asset {
  id: string;
  kind: Kind;
  title: string;
  revisionId: string;
  version: number;
  source: {
    type: "path" | "inline";
    path?: string;
    sourceKey?: string;
    content?: string;
    serverName?: string;
  };
  ownership: "user" | "unknown" | "system";
  confirmation: "draft" | "confirmed" | "outdated" | "not_required";
  scope: Scope;
  environment: Environment | null;
  archived: boolean;
  frequent?: boolean;
  files: FileEntry[];
  omissions: Omission[];
  followUps: Problem[];
  preferences?: Preference[];
  createdAt: string;
  updatedAt: string;
}
export interface Preference {
  id: string;
  assetId: string;
  scope: string;
  frequent: boolean;
  version: number;
  confirmedAt: string;
  confirmedBy: string;
}
export interface Report {
  id: string;
  type: "recommendation" | "usage" | "memory_draft" | "rule_suggestion";
  source: string;
  assetIds: string[];
  evidence: string;
  observedAt?: string;
  createdAt: string;
}
export interface Status {
  dataHome: string;
  version: string;
  schemaVersion: number;
  assetCount: number;
  cartCount: number;
  packageCount: number;
  capabilities: string[];
  legacySyncUsed: boolean;
}
export interface CartContext {
  task: { description?: string; [key: string]: unknown } | null;
  project: { path?: string; label?: string; [key: string]: unknown } | null;
  targetHint: Environment | null;
  operationScope: string;
}
export interface CartItem {
  assetId: string;
  revisionId: string;
  purpose: string;
  addedAt: string;
  metadata: { title: string; scope: Scope; confirmation: string };
}
export interface Cart extends CartContext {
  id: string;
  version: number;
  status: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}
export interface PreviewItem {
  assetId: string;
  revisionId: string;
  kind: Kind;
  title: string;
  purpose: string;
  scope: Scope;
  confirmation: string;
  ownership: string;
  files: FileEntry[];
  omissions: Omission[];
  followUps: Problem[];
}
export interface CartPreview {
  cart: Cart;
  items: PreviewItem[];
  errors: Problem[];
  canExport: boolean;
  status: string;
  compatibilityChecked: false;
}
export interface ExportJob {
  id: string;
  requestId: string;
  cartId: string;
  cartVersion: number;
  status: "running" | "complete" | "failed" | "cancelled";
  phase: string;
  cancelRequested: boolean;
  packageId: string | null;
  packagePath?: string;
  error: Problem | null;
  createdAt: string;
  updatedAt: string;
}
export interface ExportIntent {
  cartId: string;
  expectedVersion: number;
  requestId: string;
  jobId?: string;
}
export interface PackageRecord {
  id: string;
  path: string;
  cartId: string;
  cartVersion: number;
  status: "ready" | "ready_with_followups";
  receiptStatus: "unknown" | "reported";
  createdAt: string;
}
export interface Manifest extends CartContext {
  packageId: string;
  items: Array<{
    assetId: string;
    revisionId: string;
    kind: Kind;
    title: string;
    confirmation: string;
    scope: Scope;
    purpose: string;
    entry: string;
    sourceDescription: string;
  }>;
  files: FileEntry[];
  omissions: Omission[];
  followUps: Problem[];
}
export interface PackageDetail extends PackageRecord {
  manifest: Manifest;
  prompt: string;
}
export interface Prompt {
  packageId: string;
  path: string;
  text: string;
}
export interface Receipt {
  id: string;
  packageId: string;
  source: string;
  target: Environment;
  verification: "reported";
  items: Array<{
    assetId: string;
    status:
      | "read"
      | "written"
      | "recognized"
      | "verified"
      | "needs_action"
      | "failed"
      | "unknown";
    evidence?: string;
  }>;
  createdAt: string;
}
export interface Verification {
  packageId: string;
  valid: boolean;
  problems: Problem[];
  runtimeVerified: false;
}
export interface ScanResult {
  assets: Asset[];
  environments: Environment[];
  errors: Problem[];
  scanned: number;
}
export interface RegisterInput {
  kind: Kind;
  title: string;
  path?: string;
  content?: string | JsonObject | unknown[];
  sourceKey?: string;
  serverName?: string;
  scope: Scope;
  environment?: Environment;
  ownership: "user" | "unknown";
  expectedVersion?: number;
}
