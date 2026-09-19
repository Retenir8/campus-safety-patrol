"use client";

import { setMatrix, useCampusStore, useLocations } from "@/lib/campus/store";
import { PageHeader } from "./bits";

const departments = ["保卫处", "后勤处", "学生处", "实验室与设备管理处", "总务/食堂"];

export default function MatrixView() {
  const { matrix } = useCampusStore();
  const locations = useLocations();
  const zones = Array.from(new Set(locations.map((item) => item.zoneType)));
  return (
    <div className="page-stack">
      <PageHeader
        kicker="ACCOUNTABILITY"
        title="责任矩阵"
        desc="设置各类点位对应的责任部门。"
      />
      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>点位类型</th><th>示例位置</th><th>责任部门</th></tr></thead>
            <tbody>
              {zones.map((zone) => {
                const sample = locations.find((item) => item.zoneType === zone);
                return (
                  <tr key={zone}>
                    <td>{zone}</td>
                    <td>{sample?.name}</td>
                    <td>
                      <select className="role-select" value={matrix[zone] ?? sample?.department} onChange={(event) => setMatrix(zone, event.target.value)}>
                        {departments.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
