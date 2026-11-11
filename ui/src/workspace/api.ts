import type {
  Asset,
  Cart,
  CartContext,
  CartPreview,
  Environment,
  ExportIntent,
  ExportJob,
  PackageDetail,
  PackageRecord,
  Preference,
  Problem,
  Prompt,
  Receipt,
  RegisterInput,
  Report,
  ScanResult,
  Status,
  Verification,
} from "./types";

const messages: Record<string, string> = {
  NETWORK_ERROR: "无法连接本地服务，或请求结果尚未确认。请检查服务后重试。",
  INVALID_RESPONSE: "服务返回了无法识别的内容。请确认启动的是 workspace 服务。",
  VERSION_CONFLICT:
    "其他操作已更新这份资料。已停止提交，请核对最新状态后继续。",
  SOURCE_CHANGED:
    "源文件已变化。请刷新资料、核对新修订，再明确替换交接包中的选择。",
  SOURCE_MISSING: "源文件不存在，请恢复文件或移出本次交接包。",
  SOURCE_UNREADABLE: "源文件无法读取，请检查路径和权限。",
  ASSET_UNAVAILABLE: "资料已归档或属于系统资产，无法用于本次交接。",
  EMPTY_CART: "交接包为空，请先选择资料。",
  MCP_SERVER_REQUIRED: "配置中包含服务集合，请填写要登记的 serverName。",
  MCP_SERVER_NOT_FOUND: "配置中找不到该服务名，请核对 serverName。",
  SENSITIVE_CONTENT: "资料包含不能放入普通交接包的凭据内容，请先处理后再登记。",
  REQUEST_MISMATCH: "这个请求编号已经用于不同内容。请核对任务记录后重新发起。",
  PROFILE_VERSION_UNSUPPORTED: "当前程序无法读取此版本档案，请使用兼容版本。",
  PROFILE_UNREADABLE: "档案无法读取，请检查目录与权限；原档案会保留。",
  PROFILE_CHANGED:
    "服务已切换到另一份档案。旧资料已移除，请刷新页面后读取当前档案。",
  PACKAGE_CHANGED: "交接包的说明或清单已被修改，不能继续使用原提示词。",
  PACKAGE_UNAVAILABLE: "交接包缺失、损坏或路径不可访问。",
  EXPORT_INTERRUPTED: "导出进程已中断，请用新请求重新生成。",
  EXPORT_CANCELLED: "导出已取消，交接包和源文件已保留。",
  EXPORT_IO_ERROR: "导出失败，请检查源文件和输出目录后重试。",
  COPY_VERIFICATION_FAILED: "文件复制校验失败，未发布交接包。",
  SCAN_ROOT_UNAVAILABLE: "扫描目录不存在或不是绝对路径。",
  SCAN_ROOT_REQUIRED: "请填写要整理的 Skill 目录。",
  ABSOLUTE_PATH_REQUIRED: "请填写本机文件或文件夹的完整绝对路径。",
  SKILL_DIRECTORY_REQUIRED: "Skill 需要提供含 SKILL.md 的完整文件夹。",
  NOT_FOUND: "记录不存在，可能已被其他操作移除。",
  QUEUE_PAUSED: "后续交接包写入已暂停，请先核对最新草稿。",
  CART_LOCKED: "导出结果尚未确认，请先查看任务结果。",
  WRITE_PENDING: "此条目正在保存，请等待保存结果。",
  PREVIEW_REQUIRED: "草稿已变化，请重新预览当前交接内容。",
  TITLE_REQUIRED: "请填写资料标题。",
  INVALID_JSON: "JSON 格式有误，请检查括号、引号和逗号。",
  LOCAL_VALUE_REQUIRED: "接收环境需要补充本机配置值。",
  URL_AUTH_REMOVED: "网址中的凭据已移除，需在接收环境单独配置。",
  EXTERNAL_RESOURCE: "包含外部资源路径，请在接收环境核对。",
  EXCLUDED_DIRECTORY: "此目录按交接规则排除，不放入文件包。",
};
export function problemText(problem: Problem) {
  return messages[problem.code] || "操作未完成，请查看详情并修正后重试。";
}
export class WorkspaceError extends Error {
  constructor(
    public problem: Problem,
    public status = 0,
  ) {
    super(problemText(problem));
    this.name = "WorkspaceError";
  }
  get code() {
    return this.problem.code;
  }
}
export function asError(error: unknown): WorkspaceError {
  return error instanceof WorkspaceError
    ? error
    : new WorkspaceError({
        code: "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : String(error),
      });
}
export function createWorkspaceApi(
  base = "/api/v1",
  transport: typeof fetch = fetch,
) {
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await transport(base + path, {
        method,
        headers:
          method === "GET" ? undefined : { "Content-Type": "application/json" },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new WorkspaceError({ code: "NETWORK_ERROR" });
    }
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new WorkspaceError({ code: "INVALID_RESPONSE" }, response.status);
    }
    if (!response.ok)
      throw new WorkspaceError(result as Problem, response.status);
    return result as T;
  }
  const list = async <T>(path: string) =>
    (await request<{ items: T[] }>(path)).items;
  const id = encodeURIComponent;
  return {
    status: () => request<Status>("/status"),
    assets: (scope = "personal") =>
      list<Asset>(`/assets?preferenceScope=${id(scope)}`),
    asset: (assetId: string) => request<Asset>(`/assets/${id(assetId)}`),
    register: (body: RegisterInput) => request<Asset>("/assets", "POST", body),
    updateAsset: (
      assetId: string,
      body: { expectedVersion: number; title?: string; confirmation?: string },
    ) => request<Asset>(`/assets/${id(assetId)}`, "PATCH", body),
    refreshAsset: (assetId: string) =>
      request<Asset>(`/assets/${id(assetId)}/refresh`, "POST", {}),
    scan: (
      roots: Array<string | { path: string; environment?: Environment }>,
    ) => request<ScanResult>("/scan", "POST", { roots, discoverAgents: false }),
    environments: () => list<Environment>("/environments"),
    reports: () => list<Report>("/reports"),
    preferences: () => list<Preference>("/preferences"),
    setPreference: (
      assetId: string,
      body: { scope: string; frequent: boolean; expectedVersion?: number },
    ) => request<Preference>(`/preferences/${id(assetId)}`, "PUT", body),
    carts: () => list<Cart>("/carts"),
    cart: (cartId: string) => request<Cart>(`/carts/${id(cartId)}`),
    createCart: (body: Partial<CartContext> = {}) =>
      request<Cart>("/carts", "POST", body),
    editCart: (cartId: string, version: number, body: Partial<CartContext>) =>
      request<Cart>(`/carts/${id(cartId)}`, "PATCH", {
        ...body,
        expectedVersion: version,
      }),
    add: (
      cartId: string,
      version: number,
      assetId: string,
      revisionId: string,
      purpose = "",
    ) =>
      request<Cart>(`/carts/${id(cartId)}/items`, "POST", {
        expectedVersion: version,
        assetId,
        revisionId,
        purpose,
      }),
    remove: (cartId: string, version: number, assetId: string) =>
      request<Cart>(`/carts/${id(cartId)}/items/${id(assetId)}`, "DELETE", {
        expectedVersion: version,
      }),
    clear: (cartId: string, version: number) =>
      request<Cart>(`/carts/${id(cartId)}/items`, "DELETE", {
        expectedVersion: version,
      }),
    preview: (cartId: string, version: number) =>
      request<CartPreview>(`/carts/${id(cartId)}/preview`, "POST", {
        expectedVersion: version,
      }),
    export: (intent: ExportIntent) =>
      request<ExportJob>(`/carts/${id(intent.cartId)}/export`, "POST", {
        expectedVersion: intent.expectedVersion,
        requestId: intent.requestId,
      }),
    exports: () => list<ExportJob>("/exports"),
    job: (jobId: string) => request<ExportJob>(`/exports/${id(jobId)}`),
    cancel: (jobId: string) =>
      request<ExportJob>(`/exports/${id(jobId)}/cancel`, "POST", {}),
    packages: () => list<PackageRecord>("/packages"),
    package: (packageId: string) =>
      request<PackageDetail>(`/packages/${id(packageId)}`),
    prompt: (packageId: string) =>
      request<Prompt>(`/packages/${id(packageId)}/prompt`),
    verify: (packageId: string) =>
      request<Verification>(`/packages/${id(packageId)}/verify`),
    receipts: (packageId: string) =>
      list<Receipt>(`/receipts?packageId=${id(packageId)}`),
  };
}
export type WorkspaceApi = ReturnType<typeof createWorkspaceApi>;
export const api = createWorkspaceApi();
