"use client";

import Link from "next/link";
import { pauseJob, useCampusStore, useLocations } from "@/lib/campus/store";
import { formatTime, PageHeader } from "./bits";

export default function BatchView() {
  const { jobs, findings } = useCampusStore();
  const locations = useLocations();
  return (
    <div className="page-stack">
      <PageHeader
        kicker="BATCH CENTER"
        title="批量任务"
        desc="一次处理多张巡检图片，查看任务进度。"
        action={<Link className="primary-action" href="/inspect">去监测</Link>}
      />
      <section className="panel">
        {jobs.length === 0 ? (
          <div className="empty-block"><p>还没有批量任务。可到隐患识别监测摄像头。</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>任务</th><th>位置</th><th>进度</th><th>状态</th><th>时间</th><th /></tr></thead>
              <tbody>
                {jobs.map((job) => {
                  const loc = locations.find((item) => item.id === job.locationId);
                  return (
                    <tr key={job.id}>
                      <td>{job.title}</td>
                      <td>{loc?.short}</td>
                      <td>{job.done} / {job.total}</td>
                      <td>{job.status === "done" ? "已完成" : job.status === "paused" ? "已暂停" : "进行中"}</td>
                      <td>{formatTime(job.createdAt)}</td>
                      <td>
                        {job.status !== "done" ? <button className="secondary-action" onClick={() => pauseJob(job.id)}>暂停 / 续跑</button> : null}
                        <div className="muted">{job.findingIds.length} 条写入台账，高风险 {findings.filter((item) => job.findingIds.includes(item.id) && item.level === "HIGH").length}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
