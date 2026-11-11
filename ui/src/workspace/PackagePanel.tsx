import { useEffect, useState } from "react";
import { PromptView } from "./PromptView";
import { Button } from "@astryxdesign/core/Button";
import { api, asError, WorkspaceError } from "./api";
import { dateText, Failure, kindName, Notes } from "./shared";
import type { PackageDetail, Prompt, Receipt, Verification } from "./types";

const receiptLabels: Record<string, string> = {
  read: "报告：目标已读取",
  written: "报告：已写入",
  recognized: "报告：目标已识别",
  verified: "报告声称：调用已验证",
  needs_action: "报告：需要处理",
  failed: "报告：失败",
  unknown: "报告：未知",
};
export function PackagePanel({ id }: { id: string }) {
  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [error, setError] = useState<WorkspaceError | null>(null);
  const [verify, setVerify] = useState<Verification | null>(null);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setDetail(null);
    setPrompt(null);
    setReceipts(null);
    setError(null);
    setVerify(null);
    Promise.allSettled([
      api.package(id),
      api.prompt(id),
      api.receipts(id),
    ]).then((results) => {
      if (!active) return;
      if (results[0].status === "fulfilled") setDetail(results[0].value);
      if (results[1].status === "fulfilled") setPrompt(results[1].value);
      if (results[2].status === "fulfilled") setReceipts(results[2].value);
      const failed = results.find((r) => r.status === "rejected");
      if (failed?.status === "rejected") setError(asError(failed.reason));
    });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  async function verifyFiles() {
    setChecking(true);
    try {
      setVerify(await api.verify(id));
    } catch (e) {
      setError(asError(e));
    } finally {
      setChecking(false);
    }
  }
  return (
    <div className="panel-content package-panel">
      {error && (
        <Failure error={error} onRetry={() => setAttempt((n) => n + 1)} />
      )}
      <div className="handoff-heading">
        <div>
          <h2>{detail?.manifest.task?.description || "交接包"}</h2>
          {detail && <p>包已生成 · {dateText(detail.createdAt)}</p>}
        </div>
      </div>
      {!detail && !error && <p role="status">正在读取交接包…</p>}
      {detail && (
        <>
          <label className="readonly-field">
            包位置
            <input aria-label="交接包位置" readOnly value={detail.path} />
          </label>
          <p className="muted-copy">
            {detail.manifest.items.length} 项资料 ·{" "}
            {detail.manifest.files.length} 个文件
          </p>
          <section className="detail-section">
            <h3>实际交接内容</h3>
            {detail.manifest.items.map((item) => (
              <div className="history-row" key={item.assetId}>
                <strong>{item.title}</strong>
                <span>
                  {kindName(item.kind)} · {item.entry}
                </span>
              </div>
            ))}
          </section>
          <Notes title="排除项" items={detail.manifest.omissions} />
          <Notes title="待补事项" items={detail.manifest.followUps} />
        </>
      )}
      <section className="detail-section">
        <h3>后端生成的提示词</h3>
        {prompt ? (
          <PromptView prompt={prompt} />
        ) : (
          <p className="muted-copy">提示词尚未取得，不能复制。</p>
        )}
      </section>
      <section className="detail-section">
        <h3>文件完整性</h3>
        <Button
          label={checking ? "正在校验…" : "校验包文件"}
          isDisabled={checking}
          onClick={() => void verifyFiles()}
        />
        {verify && (
          <>
            <p className={verify.valid ? "success-box" : "warning-box"}>
              {verify.valid ? "包文件与清单一致" : "包文件校验发现问题"}
            </p>
            {verify.problems.length > 0 && (
              <Notes title="校验问题" items={verify.problems} />
            )}
            <p className="muted-copy">
              仅校验文件完整性，未独立验证目标环境运行。
            </p>
          </>
        )}
      </section>
      <section className="detail-section">
        <h3>接收结果</h3>
        {receipts === null ? (
          <p className="muted-copy">接收报告尚未读取，请重试。</p>
        ) : receipts.length === 0 ? (
          <p className="muted-copy">
            尚未收到接收报告，目标读取、识别与调用结果均未知。
          </p>
        ) : (
          receipts.map((r) => (
            <article className="receipt" key={r.id}>
              <strong>{r.source}</strong>
              <p>
                {r.target.harness || "未标明目标"} · {dateText(r.createdAt)}
              </p>
              {r.items.map((item, i) => (
                <div key={`${item.assetId}:${i}`}>
                  <span className="receipt-status">
                    {receiptLabels[item.status] || item.status}
                  </span>
                  <p>
                    {detail?.manifest.items.find(
                      (a) => a.assetId === item.assetId,
                    )?.title || item.assetId}
                  </p>
                  <p>{item.evidence || "未提供证据说明"}</p>
                </div>
              ))}
              <small>
                来源为提交方自述（reported），不代表 SkillBridge 独立运行验证。
              </small>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
