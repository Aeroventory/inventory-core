import { CalendarDays, ClipboardList, Factory, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const planRows = [
  { line: "Line A", sku: "SKU-1001", target: "420 units", status: "Ready" },
  { line: "Line B", sku: "SKU-1002", target: "180 units", status: "Review" },
  { line: "Line C", sku: "SKU-1003", target: "260 units", status: "Queued" },
];

function statusTone(status: string): "green" | "warning" | "blue" {
  if (status === "Ready") return "green";
  if (status === "Review") return "warning";
  return "blue";
}

export default function ProductionPlanPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge tone="purple">Planner</Badge>
        <h1 className="mt-3 text-3xl font-light text-[#10231B]">Production Plan</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
          A planner workspace for inventory-driven production scheduling.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#00684A] text-white">
            <Factory size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">Lines</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">3</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">Active planning lanes</p>
        </Card>
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#2563EB] text-white">
            <PackageCheck size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">Planned Units</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">860</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">Placeholder weekly target</p>
        </Card>
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#B7791F] text-white">
            <CalendarDays size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">Window</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">7d</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">Rolling planning view</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planning board</CardTitle>
          <CardDescription>Initial route shell for planner/admin access.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                  {["Line", "SKU", "Target", "Status"].map((heading) => (
                    <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {planRows.map((row) => (
                  <tr key={row.line} className="hover:bg-[#F7FAF8]">
                    <td className="border-b border-[#D9E4DD] px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium text-[#10231B]">
                        <ClipboardList size={15} />
                        {row.line}
                      </span>
                    </td>
                    <td className="border-b border-[#D9E4DD] px-4 py-3 text-[#5B6B63]">{row.sku}</td>
                    <td className="border-b border-[#D9E4DD] px-4 py-3 font-semibold text-[#00684A]">{row.target}</td>
                    <td className="border-b border-[#D9E4DD] px-4 py-3">
                      <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
