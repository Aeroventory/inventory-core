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
  { id: "dashboard", label: "Dashboard", path: "/", description: "Health and workflow overview" },
  { id: "products", label: "Products", path: "/products", description: "CRUD endpoint tester" },
  { id: "snapshots", label: "Snapshots", path: "/snapshots", description: "Image and inventory snapshots" },
  { id: "kitchen", label: "Kitchen", path: "/kitchen", description: "Design system contract" },
] as const;

export type ViewId = (typeof navItems)[number]["id"];
