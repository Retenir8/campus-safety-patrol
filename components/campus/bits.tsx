import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { KnowledgeCard, RiskLevel } from "@/lib/campus/types";
import { levelLabel } from "@/lib/campus/engine";

export function PageHeader({
  kicker,
  title,
  desc,
  action,
}: {
  kicker?: string;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {kicker ? <div className="page-kicker">{kicker}</div> : null}
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      {action ? <div className="page-head-actions">{action}</div> : null}
    </div>
  );
}

export function LevelBadge({ level }: { level: RiskLevel }) {
  return <span className={clsx("level-badge", level.toLowerCase())}>{levelLabel(level)}</span>;
}

export function ClauseBox({
  card,
  extra,
}: {
  card: Pick<KnowledgeCard, "source" | "clause" | "text">;
  extra?: ReactNode;
}) {
  return (
    <div className="clause-box">
      <span>{card.source} · {card.clause}</span>
      <strong>{card.text}</strong>
      {extra}
    </div>
  );
}

export function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function formatDue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}
