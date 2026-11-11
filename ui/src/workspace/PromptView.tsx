import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Glyph } from "./Glyph";
import { api, asError, type WorkspaceError } from "./api";
import { Failure } from "./shared";
import type { Prompt } from "./types";
export function PromptView({ prompt }: { prompt: Prompt }) {
  const [copied, setCopied] = useState(0),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    setCopied(0);
    setFailed(false);
  }, [prompt.text]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt.text);
      setCopied((n) => n + 1);
      setFailed(false);
    } catch {
      setCopied(0);
      setFailed(true);
    }
  }
  return (
    <>
      <div className="ho-ready">
        <div className="ho-badge">
          <Glyph name="sparkle" size={14} />
          后端提示词
        </div>
        <textarea
          className={`ho-text prompt-preview ${copied ? "flash" : ""}`}
          key={"prompt-" + copied}
          aria-label="交接提示词"
          readOnly
          value={prompt.text}
          rows={9}
        />
      </div>
      <div className="ho-actions">
        <span className={`copy ${copied ? "done" : ""}`}>
          {copied > 0 && (
            <span key={copied} className="burst big" aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <i key={i} style={{ "--a": `${i * 30}deg` } as CSSProperties} />
              ))}
            </span>
          )}
          <Button
            label={copied ? "已复制" : "复制提示词"}
            variant="primary"
            size="lg"
            icon={<Glyph name={copied ? "check" : "copy"} size={17} />}
            onClick={() => void copy()}
          />
        </span>
      </div>
      {failed && (
        <p className="warning-box" role="alert">
          剪贴板写入失败，请在上方文本框中手动全选并复制。
        </p>
      )}
      <span className="sr-only" role="status">
        {copied ? "提示词已复制到剪贴板" : ""}
      </span>
    </>
  );
}
export function PackagePrompt({ id }: { id: string }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null),
    [error, setError] = useState<WorkspaceError | null>(null),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setPrompt(null);
    setError(null);
    api
      .prompt(id)
      .then((p) => {
        if (active) setPrompt(p);
      })
      .catch((e) => {
        if (active) setError(asError(e));
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  return error ? (
    <Failure error={error} onRetry={() => setAttempt((n) => n + 1)} />
  ) : prompt ? (
    <PromptView prompt={prompt} />
  ) : (
    <p className="muted-copy" role="status">
      正在读取提示词…
    </p>
  );
}
