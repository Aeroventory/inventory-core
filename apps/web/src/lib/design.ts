import { UserRole } from "@/types/auth";

export const palette = {
  background: "#F7FAF8",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF4F0",
  border: "#D9E4DD",
  textPrimary: "#10231B",
  textMuted: "#5B6B63",
  primary: "#00684A",
  primaryHover: "#00523A",
  softGreen: "#E3F6EC",
  brightAccent: "#00ED64",
  warning: "#B7791F",
  danger: "#C2410C",
  dangerDark: "#B91C1C",
  info: "#2563EB",
} as const;

export const navItems = [
  { id: "dashboard", labelKey: "nav.dashboard.label", path: "/", descriptionKey: "nav.dashboard.description" },
  { id: "products", labelKey: "nav.products.label", path: "/products", descriptionKey: "nav.products.description" },
  { id: "snapshots", labelKey: "nav.snapshots.label", path: "/snapshots", descriptionKey: "nav.snapshots.description" },
  {
    id: "productionPlan",
    labelKey: "nav.productionPlan.label",
    path: "/production-plan",
    descriptionKey: "nav.productionPlan.description",
    allowedRoles: ["admin", "planner"] satisfies readonly UserRole[],
  },
  {
    id: "kitchen",
    labelKey: "nav.kitchen.label",
    path: "/kitchen",
    descriptionKey: "nav.kitchen.description",
    allowedRoles: ["admin"] satisfies readonly UserRole[],
  },
] as const;

export type ViewId = (typeof navItems)[number]["id"];
