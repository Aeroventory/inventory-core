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

const swatches = [
  ["Background", palette.background],
  ["Surface", palette.surface],
  ["Surface Muted", palette.surfaceMuted],
  ["Border", palette.border],
  ["Text Primary", palette.textPrimary],
  ["Text Muted", palette.textMuted],
  ["Primary Green", palette.primary],
  ["Primary Hover", palette.primaryHover],
  ["Soft Green", palette.softGreen],
  ["Bright Accent", palette.brightAccent],
  ["Warning", palette.warning],
  ["Danger", palette.danger],
  ["Info", palette.info],
];

const sampleRows = [
  ["SKU-1001", "Wireless Mouse", "WH-01 / Aisle 3 / Rack A", "In Stock", "94%"],
  ["SKU-1002", "Mechanical Keyboard", "WH-01 / Aisle 1 / Rack C", "Low Stock", "78%"],
  ["SKU-1003", "24 inch Monitor", "WH-02 / Aisle 5 / Rack B", "Out of Stock", "pending"],
];

function statusTone(status: string): "green" | "warning" | "danger" {
  if (status === "In Stock") return "green";
  if (status === "Low Stock") return "warning";
  return "danger";
}

function confidenceTone(confidence: string): "green" | "warning" | "danger" | "neutral" {
  if (confidence === "pending") return "neutral";
  const value = Number.parseInt(confidence, 10);
  if (value >= 85) return "green";
  if (value >= 65) return "warning";
  return "danger";
}

export default function KitchenPage() {
  return (
    <div className="space-y-6">
      <div>
        <Badge tone="green">Design contract</Badge>
        <h1 className="mt-3 text-3xl font-light text-[#10231B]">Kitchen</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#5B6B63]">
          Shared UI ingredients for the light green operations console. Future frontend issues should reuse these shapes before inventing new ones.
        </p>
      </div>

      <div className="grid gap-5 2xl:grid-cols-12">
        <Card className="2xl:col-span-5">
          <CardHeader>
            <CardTitle>Palette</CardTitle>
            <CardDescription>Compass-inspired white and green tokens for warehouse workflows.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {swatches.map(([name, hex]) => (
                <div key={name}>
                  <div className="h-16 rounded-2xl border border-[#D9E4DD] shadow-inner" style={{ background: hex }} />
                  <p className="mt-2 text-xs font-medium text-[#10231B]">{name}</p>
                  <p className="text-xs text-[#5B6B63]">{hex}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-3">
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Dense, readable, boring in the best way.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-4xl font-light">H1 Heading</p>
              <p className="text-xs text-[#5B6B63]">36px / 300 / #10231B</p>
            </div>
            <div>
              <p className="text-2xl font-normal">H2 Heading</p>
              <p className="text-xs text-[#5B6B63]">24px / 400 / #10231B</p>
            </div>
            <div>
              <p className="text-sm leading-6 text-[#5B6B63]">
                Body copy stays compact and clear, with enough contrast for repeated scanning.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-4">
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
            <CardDescription>Primary green for normal action, red only for destructive or emergency action.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button><UploadCloud size={16} /> Primary</Button>
            <Button variant="secondary"><Edit3 size={16} /> Secondary</Button>
            <Button variant="soft"><CheckCircle2 size={16} /> Soft</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="warning"><AlertTriangle size={16} /> Warning</Button>
            <Button variant="danger"><ShieldAlert size={16} /> Emergency</Button>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-5">
          <CardHeader>
            <CardTitle>Forms</CardTitle>
            <CardDescription>Rounded controls, soft focus rings, clear labels.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase text-[#5B6B63]">Search</span>
              <Input leftSlot={<Search size={16} />} placeholder="Search SKUs, products..." />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase text-[#5B6B63]">Quantity</span>
              <Input type="number" placeholder="120" />
            </label>
            <div className="rounded-2xl border border-[#D9E4DD] bg-[#F7FAF8] p-4 md:col-span-2">
              <p className="mb-3 text-sm font-medium text-[#10231B]">Binary controls</p>
              <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#10231B]">
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-[#00684A] text-white">
                    <CheckCircle2 size={13} />
                  </span>
                  Auto refresh
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-5 w-9 rounded-full bg-[#00684A] p-0.5">
                    <span className="block h-4 w-4 translate-x-4 rounded-full bg-white" />
                  </span>
                  Health checks
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-3">
          <CardHeader>
            <CardTitle>Badges</CardTitle>
            <CardDescription>Small, scannable state markers.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge tone="green">Healthy</Badge>
            <Badge tone="blue">Incoming</Badge>
            <Badge tone="warning">Low confidence</Badge>
            <Badge tone="danger">Blocked</Badge>
            <Badge tone="neutral">Pending</Badge>
            <Badge tone="purple">Planner</Badge>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-4">
          <CardHeader>
            <CardTitle>Status cards</CardTitle>
            <CardDescription>Compact operational metrics.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Package, label: "Total SKUs", value: "4,782", tone: "bg-[#00684A]" },
              { icon: Warehouse, label: "Warehouses", value: "12", tone: "bg-[#2563EB]" },
              { icon: AlertTriangle, label: "Low Stock", value: "128", tone: "bg-[#B7791F]" },
              { icon: Database, label: "DB", value: "Connected", tone: "bg-[#00684A]" },
            ].map((item) => (
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
            <CardTitle>Table</CardTitle>
            <CardDescription>Default shape for inventory, report, and planning pages.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-[#D9E4DD]">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="bg-[#F7FAF8] text-xs font-medium uppercase text-[#5B6B63]">
                    {["SKU", "Product", "Location", "Status", "Confidence", "Actions"].map((heading) => (
                      <th key={heading} className="border-b border-[#D9E4DD] px-4 py-3">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row) => (
                    <tr key={row[0]} className="hover:bg-[#F7FAF8]">
                      <td className="border-b border-[#D9E4DD] px-4 py-3 font-semibold text-[#10231B]">{row[0]}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">{row[1]}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3 text-[#5B6B63]">{row[2]}</td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3"><Badge tone={statusTone(row[3])}>{row[3]}</Badge></td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3"><Badge tone={confidenceTone(row[4])}>{row[4]}</Badge></td>
                      <td className="border-b border-[#D9E4DD] px-4 py-3">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="icon" aria-label="Edit"><Edit3 size={15} /></Button>
                          <Button variant="danger" size="icon" aria-label="Delete"><Trash2 size={15} /></Button>
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
            <CardTitle>Feedback</CardTitle>
            <CardDescription>Toast-like messages and alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { icon: CheckCircle2, title: "Snapshot saved", body: "18 rows were written successfully.", tone: "text-[#00684A] bg-[#E3F6EC] border-[#B6E8CC]" },
              { icon: Bell, title: "Low confidence", body: "3 detections should be reviewed.", tone: "text-[#B7791F] bg-[#FFF7E6] border-[#F4D7A2]" },
              { icon: XCircle, title: "Upload failed", body: "The API returned an error.", tone: "text-[#C2410C] bg-[#FFF1ED] border-[#F7B8A4]" },
            ].map((item) => (
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
