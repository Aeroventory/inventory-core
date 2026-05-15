import { useTranslation } from "react-i18next";
import { CalendarDays, ClipboardList, Factory, PackageCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const planRows = [
  {
    lineKey: "productionPlan.rows.lineA.line",
    skuKey: "productionPlan.rows.lineA.sku",
    targetKey: "productionPlan.rows.lineA.target",
    statusKey: "productionPlan.rows.lineA.status",
    tone: "green",
  },
  {
    lineKey: "productionPlan.rows.lineB.line",
    skuKey: "productionPlan.rows.lineB.sku",
    targetKey: "productionPlan.rows.lineB.target",
    statusKey: "productionPlan.rows.lineB.status",
    tone: "warning",
  },
  {
    lineKey: "productionPlan.rows.lineC.line",
    skuKey: "productionPlan.rows.lineC.sku",
    targetKey: "productionPlan.rows.lineC.target",
    statusKey: "productionPlan.rows.lineC.status",
    tone: "blue",
  },
];

export default function ProductionPlanPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <Badge tone="purple">{t("productionPlan.badge")}</Badge>
        <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("productionPlan.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
          {t("productionPlan.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#00684A] text-white">
            <Factory size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">{t("productionPlan.metrics.lines.label")}</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">{t("productionPlan.metrics.lines.value")}</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">{t("productionPlan.metrics.lines.description")}</p>
        </Card>
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#2563EB] text-white">
            <PackageCheck size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">{t("productionPlan.metrics.plannedUnits.label")}</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">{t("productionPlan.metrics.plannedUnits.value")}</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">{t("productionPlan.metrics.plannedUnits.description")}</p>
        </Card>
        <Card className="p-4">
          <div className="mb-5 grid h-10 w-10 place-items-center rounded-2xl bg-[#B7791F] text-white">
            <CalendarDays size={19} />
          </div>
          <p className="text-sm font-medium text-[#5B6B63]">{t("productionPlan.metrics.window.label")}</p>
          <p className="mt-1 text-3xl font-medium text-[#10231B]">{t("productionPlan.metrics.window.value")}</p>
          <p className="mt-2 text-xs font-semibold text-[#5B6B63]">{t("productionPlan.metrics.window.description")}</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("productionPlan.board.title")}</CardTitle>
          <CardDescription>{t("productionPlan.board.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                  {[t("common.labels.line"), t("common.labels.sku"), t("common.labels.target"), t("common.labels.status")].map((heading) => (
                    <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {planRows.map((row) => (
                  <tr key={row.lineKey} className="hover:bg-[#F7FAF8]">
                    <td className="border-b border-[#D9E4DD] px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium text-[#10231B]">
                        <ClipboardList size={15} />
                        {t(row.lineKey)}
                      </span>
                    </td>
                    <td className="border-b border-[#D9E4DD] px-4 py-3 text-[#5B6B63]">{t(row.skuKey)}</td>
                    <td className="border-b border-[#D9E4DD] px-4 py-3 font-semibold text-[#00684A]">{t(row.targetKey)}</td>
                    <td className="border-b border-[#D9E4DD] px-4 py-3">
                      <Badge tone={row.tone as "green" | "warning" | "blue"}>{t(row.statusKey)}</Badge>
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
