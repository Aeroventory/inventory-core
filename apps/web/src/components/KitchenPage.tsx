import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Edit3,
  Package,
  Search,
  ShieldAlert,
  Trash2,
  UploadCloud,
  Warehouse,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { palette } from "@/lib/design";

type BadgeTone = "green" | "neutral" | "warning" | "danger" | "blue" | "purple";

const swatches = [
  { nameKey: "kitchen.palette.swatches.background", hex: palette.background },
  { nameKey: "kitchen.palette.swatches.surface", hex: palette.surface },
  { nameKey: "kitchen.palette.swatches.surfaceMuted", hex: palette.surfaceMuted },
  { nameKey: "kitchen.palette.swatches.border", hex: palette.border },
  { nameKey: "kitchen.palette.swatches.textPrimary", hex: palette.textPrimary },
  { nameKey: "kitchen.palette.swatches.textMuted", hex: palette.textMuted },
  { nameKey: "kitchen.palette.swatches.primaryGreen", hex: palette.primary },
  { nameKey: "kitchen.palette.swatches.primaryHover", hex: palette.primaryHover },
  { nameKey: "kitchen.palette.swatches.softGreen", hex: palette.softGreen },
  { nameKey: "kitchen.palette.swatches.brightAccent", hex: palette.brightAccent },
  { nameKey: "kitchen.palette.swatches.warning", hex: palette.warning },
  { nameKey: "kitchen.palette.swatches.danger", hex: palette.danger },
  { nameKey: "kitchen.palette.swatches.info", hex: palette.info },
] as const;

const sampleRows = [
  {
    skuKey: "kitchen.table.rows.mouse.sku",
    productKey: "kitchen.table.rows.mouse.product",
    locationKey: "kitchen.table.rows.mouse.location",
    statusKey: "kitchen.table.rows.mouse.status",
    confidenceKey: "kitchen.table.rows.mouse.confidence",
    statusTone: "green",
    confidenceTone: "green",
  },
  {
    skuKey: "kitchen.table.rows.keyboard.sku",
    productKey: "kitchen.table.rows.keyboard.product",
    locationKey: "kitchen.table.rows.keyboard.location",
    statusKey: "kitchen.table.rows.keyboard.status",
    confidenceKey: "kitchen.table.rows.keyboard.confidence",
    statusTone: "warning",
    confidenceTone: "warning",
  },
  {
    skuKey: "kitchen.table.rows.monitor.sku",
    productKey: "kitchen.table.rows.monitor.product",
    locationKey: "kitchen.table.rows.monitor.location",
    statusKey: "kitchen.table.rows.monitor.status",
    confidenceKey: "kitchen.table.rows.monitor.confidence",
    statusTone: "danger",
    confidenceTone: "neutral",
  },
] as const;

export default function KitchenPage() {
  const { t } = useTranslation();

  const statusCards = [
    { icon: Package, label: t("kitchen.statusCards.totalSkus"), value: t("kitchen.statusCards.totalSkusValue"), tone: "bg-[#00684A]" },
    { icon: Warehouse, label: t("kitchen.statusCards.warehouses"), value: t("kitchen.statusCards.warehousesValue"), tone: "bg-[#2563EB]" },
    { icon: AlertTriangle, label: t("kitchen.statusCards.lowStock"), value: t("kitchen.statusCards.lowStockValue"), tone: "bg-[#B7791F]" },
    { icon: Database, label: t("kitchen.statusCards.db"), value: t("kitchen.statusCards.dbValue"), tone: "bg-[#00684A]" },
  ];

  const feedbackItems = [
    {
      icon: CheckCircle2,
      title: t("kitchen.feedback.snapshotSaved.title"),
      body: t("kitchen.feedback.snapshotSaved.body"),
      tone: "text-[#00684A] bg-[#E3F6EC] border-[#B6E8CC]",
    },
    {
      icon: Bell,
      title: t("kitchen.feedback.lowConfidence.title"),
      body: t("kitchen.feedback.lowConfidence.body"),
      tone: "text-[#B7791F] bg-[#FFF7E6] border-[#F4D7A2]",
    },
    {
      icon: XCircle,
      title: t("kitchen.feedback.uploadFailed.title"),
      body: t("kitchen.feedback.uploadFailed.body"),
      tone: "text-[#C2410C] bg-[#FFF1ED] border-[#F7B8A4]",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mt-3 text-3xl font-light text-[#10231B]">{t("kitchen.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
          {t("kitchen.description")}
        </p>
      </div>

      <div className="grid gap-5 2xl:grid-cols-12">
        <Card className="2xl:col-span-5">
          <CardHeader>
            <CardTitle>{t("kitchen.palette.title")}</CardTitle>
            <CardDescription>{t("kitchen.palette.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {swatches.map(({ nameKey, hex }) => (
                <div key={nameKey}>
                  <div className="h-16 rounded-2xl border border-[#D9E4DD] shadow-inner" style={{ background: hex }} />
                  <p className="mt-2 text-xs font-medium text-[#10231B]">{t(nameKey)}</p>
                  <p className="text-xs text-[#5B6B63]">{hex}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-3">
          <CardHeader>
            <CardTitle>{t("kitchen.typography.title")}</CardTitle>
            <CardDescription>{t("kitchen.typography.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-4xl font-light">{t("kitchen.typography.h1")}</p>
              <p className="text-xs text-[#5B6B63]">{t("kitchen.typography.h1Spec")}</p>
            </div>
            <div>
              <p className="text-2xl font-normal">{t("kitchen.typography.h2")}</p>
              <p className="text-xs text-[#5B6B63]">{t("kitchen.typography.h2Spec")}</p>
            </div>
            <div>
              <p className="text-sm leading-6 text-[#5B6B63]">
                {t("kitchen.typography.body")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-4">
          <CardHeader>
            <CardTitle>{t("kitchen.buttons.title")}</CardTitle>
            <CardDescription>{t("kitchen.buttons.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button><UploadCloud size={16} /> {t("kitchen.buttons.primary")}</Button>
            <Button variant="secondary"><Edit3 size={16} /> {t("kitchen.buttons.secondary")}</Button>
            <Button variant="soft"><CheckCircle2 size={16} /> {t("kitchen.buttons.soft")}</Button>
            <Button variant="ghost">{t("kitchen.buttons.ghost")}</Button>
            <Button variant="warning"><AlertTriangle size={16} /> {t("kitchen.buttons.warning")}</Button>
            <Button variant="danger"><ShieldAlert size={16} /> {t("kitchen.buttons.emergency")}</Button>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-5">
          <CardHeader>
            <CardTitle>{t("kitchen.forms.title")}</CardTitle>
            <CardDescription>{t("kitchen.forms.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase text-[#5B6B63]">{t("kitchen.forms.search")}</span>
              <Input leftSlot={<Search size={16} />} placeholder={t("kitchen.forms.searchPlaceholder")} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase text-[#5B6B63]">{t("kitchen.forms.quantity")}</span>
              <Input type="number" placeholder={t("kitchen.forms.quantityPlaceholder")} />
            </label>
            <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4 md:col-span-2">
              <p className="mb-3 text-sm font-medium text-[#10231B]">{t("kitchen.forms.binaryControls")}</p>
              <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#10231B]">
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-[#00684A] text-white">
                    <CheckCircle2 size={13} />
                  </span>
                  {t("kitchen.forms.autoRefresh")}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-5 w-9 rounded-full bg-[#00684A] p-0.5">
                    <span className="block h-4 w-4 translate-x-4 rounded-full bg-white" />
                  </span>
                  {t("kitchen.forms.healthChecks")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-3">
          <CardHeader>
            <CardTitle>{t("kitchen.badges.title")}</CardTitle>
            <CardDescription>{t("kitchen.badges.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge tone="green">{t("kitchen.badges.healthy")}</Badge>
            <Badge tone="blue">{t("kitchen.badges.incoming")}</Badge>
            <Badge tone="warning">{t("kitchen.badges.lowConfidence")}</Badge>
            <Badge tone="danger">{t("kitchen.badges.blocked")}</Badge>
            <Badge tone="neutral">{t("kitchen.badges.pending")}</Badge>
            <Badge tone="purple">{t("kitchen.badges.planner")}</Badge>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-4">
          <CardHeader>
            <CardTitle>{t("kitchen.statusCards.title")}</CardTitle>
            <CardDescription>{t("kitchen.statusCards.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {statusCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#D9E4DD] bg-white p-4">
                <div className={`mb-4 grid h-9 w-9 place-items-center rounded-xl text-white ${item.tone}`}>
                  <item.icon size={17} />
                </div>
                <p className="text-xs font-semibold text-[#5B6B63]">{item.label}</p>
                <p className="mt-1 text-xl font-medium text-[#10231B]">{item.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden 2xl:col-span-8">
          <CardHeader>
            <CardTitle>{t("kitchen.table.title")}</CardTitle>
            <CardDescription>{t("kitchen.table.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                    {[
                      t("kitchen.table.headings.sku"),
                      t("kitchen.table.headings.product"),
                      t("kitchen.table.headings.location"),
                      t("kitchen.table.headings.status"),
                      t("kitchen.table.headings.confidence"),
                      t("kitchen.table.headings.actions"),
                    ].map((heading) => (
                      <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row) => (
                    <tr key={row.skuKey} className="hover:bg-[#F7FAF8]">
                      <td className="border-b border-[#D9E4DD] px-4 py-3 font-semibold text-[#10231B]">{t(row.skuKey)}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">{t(row.productKey)}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3 text-[#5B6B63]">{t(row.locationKey)}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3"><Badge tone={row.statusTone as BadgeTone}>{t(row.statusKey)}</Badge></td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3"><Badge tone={row.confidenceTone as BadgeTone}>{t(row.confidenceKey)}</Badge></td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="icon" aria-label={t("common.actions.edit")}><Edit3 size={15} /></Button>
                          <Button variant="danger" size="icon" aria-label={t("common.actions.delete")}><Trash2 size={15} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-4">
          <CardHeader>
            <CardTitle>{t("kitchen.feedback.title")}</CardTitle>
            <CardDescription>{t("kitchen.feedback.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedbackItems.map((item) => (
              <div key={item.title} className={`flex items-start gap-3 rounded-2xl border p-3 ${item.tone}`}>
                <item.icon size={18} className="mt-0.5" />
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm opacity-80">{item.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
