import type { Finding, Report, ReportType } from "./types";

export function formatYmd(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatCnDate(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function reportTypeLabel(type: ReportType) {
  if (type === "weekly") return "周报";
  if (type === "monthly") return "月报";
  if (type === "daily") return "日报";
  if (type === "batch") return "批量报告";
  return "识别报告";
}

function findingsBetween(findings: Finding[], start: Date, end: Date) {
  const from = +start;
  const to = +end;
  return findings
    .filter((item) => {
      const time = +new Date(item.createdAt);
      return time >= from && time < to;
    })
    .map((item) => item.id);
}

export function collectScheduledReports(now: Date, findings: Finding[]): Omit<Report, "id">[] {
  const created: Omit<Report, "id">[] = [];

  function push(type: "daily" | "weekly" | "monthly", labelDate: Date, rangeStart: Date, rangeEnd: Date) {
    if (+now < +labelDate) return;
    const periodKey = `${type}:${formatYmd(labelDate)}`;
    const name = type === "daily" ? "校园安全日报" : type === "weekly" ? "校园安全周报" : "校园安全月报";
    created.push({
      type,
      periodKey,
      title: `${name} · ${formatCnDate(labelDate)}`,
      createdAt: labelDate.toISOString(),
      findingIds: findingsBetween(findings, rangeStart, rangeEnd),
    });
  }

  const today = startOfDay(now);
  for (let i = 0; i < 14; i += 1) {
    const label = addDays(today, -i);
    push("daily", label, label, addDays(label, 1));
  }

  const weekday = today.getDay();
  const monday = addDays(today, weekday === 0 ? -6 : 1 - weekday);
  for (let i = 0; i < 8; i += 1) {
    const label = addDays(monday, -7 * i);
    push("weekly", label, label, addDays(label, 7));
  }

  for (let i = 0; i < 6; i += 1) {
    const label = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const next = new Date(label.getFullYear(), label.getMonth() + 1, 1);
    push("monthly", label, label, next);
  }

  return created;
}
