import React from "react";

const palette = {
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
};

const iconPaths = {
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8 M13.73 21a2 2 0 0 1-3.46 0",
  box: "M21 8 12 3 3 8l9 5 9-5Z M3 8v8l9 5 9-5V8 M12 13v8",
  boxes: "M7 16.5 3 14.25v-4.5l4-2.25 4 2.25v4.5l-4 2.25Z M17 16.5l-4-2.25v-4.5l4-2.25 4 2.25v4.5l-4 2.25Z M12 9.5 8 7.25v-4.5L12 .5l4 2.25v4.5L12 9.5Z",
  check: "M20 6 9 17l-5-5",
  chevronDown: "m6 9 6 6 6-6",
  chevronLeft: "m15 18-6-6 6-6",
  chevronRight: "m9 18 6-6-6-6",
  help: "M9.09 9a3 3 0 1 1 5.83 1c0 2-3 2-3 4 M12 17h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  edit: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z",
  home: "M3 10.5 12 3l9 7.5 M5 9.5V21h14V9.5 M9 21v-6h6v6",
  grid: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  package: "M16.5 9.4 7.5 4.2 M21 8l-9-5-9 5 9 5 9-5Z M3 8v8l9 5 9-5V8 M12 13v8",
  search: "M21 21l-4.35-4.35 M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  alert: "M12 9v4 M12 17h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
  cart: "M6 6h15l-2 8H8L6 3H3 M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2v2 M12 20v2 M4.93 4.93l1.41 1.41 M17.66 17.66l1.41 1.41 M2 12h2 M20 12h2 M4.93 19.07l1.41-1.41 M17.66 6.34l1.41-1.41",
  trash: "M3 6h18 M8 6V4h8v2 M6 6l1 15h10l1-15 M10 11v6 M14 11v6",
  trend: "M3 17l6-6 4 4 8-8 M14 7h7v7",
  warehouse: "M3 21h18 M4 21V8l8-5 8 5v13 M8 21v-8h8v8 M8 13h8",
  x: "M18 6 6 18 M6 6l12 12",
};

function Icon({ name, size = 18, color = "currentColor", className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={iconPaths[name] || iconPaths.box} />
    </svg>
  );
}

const navSections = [
  {
    title: "Components",
    items: ["Colors", "Typography", "Buttons", "Form Controls", "Badges & Chips", "Cards", "Tables", "Charts", "Navigation", "Feedback"],
  },
  {
    title: "Layout",
    items: ["Grid & Spacing", "Elevation", "Icons"],
  },
  {
    title: "Resources",
    items: ["Usage Guidelines", "Changelog"],
  },
];

const swatches = [
  ["Primary Green", palette.primary],
  ["Primary Hover", palette.primaryHover],
  ["Soft Green", palette.softGreen],
  ["Background", palette.background],
  ["Surface", palette.surface],
  ["Surface Muted", palette.surfaceMuted],
  ["Border", palette.border],
  ["Text Primary", palette.textPrimary],
  ["Text Muted", palette.textMuted],
  ["Info / Link", palette.info],
];

const products = [
  ["SKU-1001", "Wireless Mouse", "Accessories", 120, "WH-01-Aisle 3", "In Stock", "May 12, 2025 10:24 AM"],
  ["SKU-1002", "Mechanical Keyboard", "Accessories", 15, "WH-01-Aisle 1", "Low Stock", "May 12, 2025 09:15 AM"],
  ["SKU-1003", "24\" Monitor", "Electronics", 0, "WH-02-Aisle 5", "Out of Stock", "May 12, 2025 08:42 AM"],
  ["SKU-1004", "USB-C Hub", "Accessories", 45, "WH-03-Aisle 2", "Backordered", "May 11, 2025 04:30 PM"],
  ["SKU-1005", "HDMI Cable", "Accessories", 200, "WH-01-Aisle 4", "In Stock", "May 11, 2025 02:11 PM"],
];

const requiredColorTokens = [
  "background",
  "surface",
  "surfaceMuted",
  "border",
  "textPrimary",
  "textMuted",
  "primary",
  "primaryHover",
  "softGreen",
  "brightAccent",
  "warning",
  "danger",
  "info",
];

function runSelfChecks() {
  const missingTokens = requiredColorTokens.filter((token) => !palette[token]);
  const validProductRows = products.every((row) => row.length === 7);
  const validStatuses = products.every((row) => ["In Stock", "Low Stock", "Out of Stock", "Backordered"].includes(row[5]));

  return {
    paletteTokens: missingTokens.length === 0,
    productRows: validProductRows,
    productStatuses: validStatuses,
  };
}

const selfChecks = runSelfChecks();

function Card({ title, children, className = "" }) {
  return (
    <section
      className={`rounded-2xl border bg-white p-5 shadow-[0_12px_32px_rgba(16,35,27,0.04)] ${className}`}
      style={{ borderColor: palette.border }}
    >
      {title && (
        <h2 className="mb-4 text-sm font-bold" style={{ color: palette.textPrimary }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function SidebarIcon({ index }) {
  const icons = ["grid", "box", "edit", "check", "package", "boxes", "warehouse", "trend", "menu", "help"];
  return <Icon name={icons[index % icons.length]} size={16} />;
}

function Badge({ children, tone = "green" }) {
  const styles = {
    green: { bg: palette.softGreen, border: "#B6E8CC", text: palette.primary },
    warning: { bg: "#FFF7E6", border: "#F4D7A2", text: palette.warning },
    danger: { bg: "#FFF1ED", border: "#F7B8A4", text: palette.danger },
    purple: { bg: "#F3EEFF", border: "#D7C5FF", text: "#6D28D9" },
    blue: { bg: "#EFF6FF", border: "#BFDBFE", text: palette.info },
  }[tone];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{ background: styles.bg, borderColor: styles.border, color: styles.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: styles.text }} />
      {children}
    </span>
  );
}

function Button({ children, variant = "primary", className = "" }) {
  const variants = {
    primary: { background: palette.primary, color: "white", borderColor: palette.primary },
    hover: { background: palette.primaryHover, color: "white", borderColor: palette.primaryHover },
    secondary: { background: palette.surface, color: palette.textPrimary, borderColor: palette.border },
    ghost: { background: "transparent", color: palette.primary, borderColor: "transparent" },
    warning: { background: palette.warning, color: "white", borderColor: palette.warning },
    danger: { background: palette.dangerDark, color: "white", borderColor: palette.dangerDark },
  }[variant];

  return (
    <button
      className={`h-10 rounded-xl border px-4 text-sm font-semibold transition hover:scale-[1.01] active:scale-[0.99] ${className}`}
      style={variants}
    >
      {children}
    </button>
  );
}

function Input({ placeholder, icon = false }) {
  return (
    <div className="relative">
      {icon && <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color={palette.textMuted} />}
      <input
        placeholder={placeholder}
        className={`h-10 w-full rounded-xl border bg-white text-sm outline-none transition focus:ring-4 ${icon ? "pl-9" : "pl-3"}`}
        style={{ borderColor: palette.border, color: palette.textPrimary, "--tw-ring-color": "rgba(0, 104, 74, 0.12)" }}
      />
    </div>
  );
}

function MetricCard({ icon, label, value, delta, tone = "green" }) {
  const color = tone === "blue" ? palette.info : tone === "warning" ? palette.warning : palette.primary;
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: palette.border }}>
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: color }}>
        <Icon name={icon} size={17} />
      </div>
      <p className="text-sm font-medium" style={{ color: palette.textMuted }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold" style={{ color: palette.textPrimary }}>
        {value}
      </p>
      <p className="mt-2 text-xs font-semibold" style={{ color: delta.includes("No") ? palette.textMuted : palette.primary }}>
        {delta}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = status === "In Stock" ? "green" : status === "Low Stock" ? "warning" : status === "Out of Stock" ? "danger" : "purple";
  return <Badge tone={tone}>{status}</Badge>;
}

function MiniLineChart() {
  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: palette.background }}>
      <svg viewBox="0 0 360 170" className="h-44 w-full overflow-visible">
        <defs>
          <linearGradient id="stockFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={palette.primary} stopOpacity="0.22" />
            <stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 65, 100, 135].map((y) => (
          <line key={y} x1="24" x2="340" y1={y} y2={y} stroke={palette.border} strokeDasharray="4 5" />
        ))}
        <path d="M28 128 C62 103, 88 79, 120 95 C150 110, 168 44, 205 61 C238 76, 254 79, 284 57 C309 38, 325 28, 340 20 L340 152 L28 152 Z" fill="url(#stockFill)" />
        <path d="M28 128 C62 103, 88 79, 120 95 C150 110, 168 44, 205 61 C238 76, 254 79, 284 57 C309 38, 325 28, 340 20" fill="none" stroke={palette.primary} strokeWidth="4" strokeLinecap="round" />
        {[28, 120, 205, 284, 340].map((x, i) => {
          const y = [128, 95, 61, 57, 20][i];
          return <circle key={x} cx={x} cy={y} r="5" fill={palette.surface} stroke={palette.primary} strokeWidth="4" />;
        })}
      </svg>
      <div className="grid grid-cols-6 text-center text-xs" style={{ color: palette.textMuted }}>
        {["Dec", "Jan", "Feb", "Mar", "Apr", "May"].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function DonutChart() {
  return (
    <div className="mt-4 flex items-center gap-6 rounded-xl p-4" style={{ background: palette.background }}>
      <div
        className="h-32 w-32 rounded-full"
        style={{
          background: `conic-gradient(${palette.primary} 0 68%, ${palette.warning} 68% 84%, #6D28D9 84% 94%, ${palette.danger} 94% 100%)`,
        }}
      >
        <div className="m-auto flex h-full w-full items-center justify-center rounded-full">
          <div className="h-16 w-16 rounded-full bg-white" />
        </div>
      </div>
      <div className="space-y-2 text-xs font-medium" style={{ color: palette.textPrimary }}>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.primary }} /> In Stock <span style={{ color: palette.textMuted }}>68%</span></div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.warning }} /> Low Stock <span style={{ color: palette.textMuted }}>16%</span></div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-purple-600" /> Backordered <span style={{ color: palette.textMuted }}>10%</span></div>
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.danger }} /> Out of Stock <span style={{ color: palette.textMuted }}>6%</span></div>
      </div>
    </div>
  );
}

function Toast({ tone, title, message }) {
  const colors = {
    green: palette.primary,
    warning: palette.warning,
    danger: palette.danger,
  };
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm" style={{ borderColor: palette.border }}>
      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: colors[tone] }}>
        {tone === "green" ? <Icon name="check" size={14} /> : <Icon name="alert" size={14} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: palette.textPrimary }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: palette.textMuted }}>
          {message}
        </p>
      </div>
      <Icon name="x" size={14} color={palette.textMuted} />
    </div>
  );
}

function SelfCheckPanel() {
  const entries = [
    ["Palette tokens", selfChecks.paletteTokens],
    ["Product row shape", selfChecks.productRows],
    ["Status labels", selfChecks.productStatuses],
  ];

  return (
    <div className="mb-5 rounded-2xl border p-4" style={{ borderColor: palette.border, background: palette.surfaceMuted }}>
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
        <span style={{ color: palette.textMuted }}>Self-checks:</span>
        {entries.map(([label, passed]) => (
          <span key={label} className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1" style={{ borderColor: palette.border, color: passed ? palette.primary : palette.danger }}>
            <span className="grid h-4 w-4 place-items-center rounded-full text-white" style={{ background: passed ? palette.primary : palette.danger }}>
              {passed ? <Icon name="check" size={11} /> : <Icon name="x" size={11} />}
            </span>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function InventoryStockControlComponents() {
  return (
    <div className="min-h-screen font-sans" style={{ background: palette.background, color: palette.textPrimary }}>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r bg-white/95 backdrop-blur xl:block" style={{ borderColor: palette.border }}>
        <div className="flex h-20 items-center gap-3 px-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: palette.primary }}>
            <Icon name="box" size={22} />
          </div>
          <span className="text-2xl font-black tracking-tight">StockControl</span>
        </div>

        <nav className="px-4 py-2">
          <a className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: palette.softGreen, color: palette.primary }}>
            <Icon name="home" size={17} /> Overview
          </a>

          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="mb-2 px-4 text-xs font-black uppercase tracking-[0.16em]" style={{ color: palette.textMuted }}>
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item, index) => (
                  <a key={item} className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:bg-[#EEF4F0]" style={{ color: palette.textPrimary }}>
                    <SidebarIcon index={index} /> {item}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-2xl border p-4" style={{ borderColor: palette.border, background: palette.background }}>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.brightAccent }} />
            <p className="text-sm font-bold">Design System v1.0.0</p>
          </div>
          <p className="mt-1 text-xs" style={{ color: palette.textMuted }}>
            Updated May 12, 2025
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur" style={{ borderColor: palette.border }}>
        <div className="flex h-20 items-center gap-4 px-5 xl:ml-72 xl:px-8">
          <button className="rounded-xl border p-2" style={{ borderColor: palette.border }}>
            <Icon name="menu" size={20} />
          </button>
          <div className="mx-auto hidden w-full max-w-xl items-center rounded-2xl border bg-white px-4 md:flex" style={{ borderColor: palette.border }}>
            <Icon name="search" size={17} color={palette.textMuted} />
            <input className="h-11 flex-1 bg-transparent px-3 text-sm outline-none" placeholder="Search components..." />
            <kbd className="rounded-lg px-2 py-1 text-xs" style={{ background: palette.background, color: palette.textMuted }}>
              ⌘ K
            </kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {["bell", "help", "sun"].map((name, i) => (
              <button key={name} className="relative rounded-xl border p-2.5" style={{ borderColor: palette.border }}>
                {i === 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ background: palette.brightAccent }} />}
                <Icon name={name} size={18} />
              </button>
            ))}
            <div className="ml-2 flex items-center gap-3 rounded-2xl border px-3 py-2" style={{ borderColor: palette.border }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full font-bold" style={{ background: palette.softGreen, color: palette.primary }}>
                AD
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold">Admin User</p>
                <p className="text-xs" style={{ color: palette.textMuted }}>
                  Administrator
                </p>
              </div>
              <Icon name="chevronDown" size={16} />
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 py-8 xl:ml-72 xl:px-8">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-tight">UI Components</h1>
            <p className="mt-2 text-sm" style={{ color: palette.textMuted }}>
              Reusable components for the StockControl inventory system.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: palette.textMuted }}>
            Home <Icon name="chevronRight" size={14} /> Components <Icon name="chevronRight" size={14} /> <span style={{ color: palette.textPrimary }}>Overview</span>
          </div>
        </div>

        <SelfCheckPanel />

        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-12">
          <Card title="1. Colors" className="2xl:col-span-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {swatches.map(([name, hex]) => (
                <div key={name}>
                  <div className="h-16 rounded-xl border shadow-inner" style={{ background: hex, borderColor: palette.border }} />
                  <p className="mt-2 text-xs font-bold">{name}</p>
                  <p className="text-xs" style={{ color: palette.textMuted }}>
                    {hex}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="2. Typography" className="2xl:col-span-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-5">
                <div><p className="text-4xl font-black">H1 Heading</p><p className="text-xs" style={{ color: palette.textMuted }}>32px / 700 / #10231B</p></div>
                <div><p className="text-2xl font-bold">H2 Heading</p><p className="text-xs" style={{ color: palette.textMuted }}>24px / 600 / #10231B</p></div>
                <div><p className="text-xl font-bold">H3 Heading</p><p className="text-xs" style={{ color: palette.textMuted }}>20px / 600 / #10231B</p></div>
              </div>
              <div className="space-y-4">
                <div><p className="text-base font-semibold">Body Large</p><p className="text-base">This is example body text used for content and descriptions.</p></div>
                <div><p className="text-sm font-semibold">Body</p><p className="text-sm">This is example body text used for general descriptions.</p></div>
                <div><p className="text-sm font-semibold">Muted Text</p><p className="text-sm" style={{ color: palette.textMuted }}>Secondary text for less emphasized information.</p></div>
                <a className="text-sm font-bold" style={{ color: palette.info }}>Link Text Example →</a>
              </div>
            </div>
          </Card>

          <Card title="3. Buttons" className="2xl:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              <Button>Primary</Button>
              <Button variant="hover">Primary Hover</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="warning">Warning</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <p className="mb-2 mt-5 text-sm font-bold">Icon Buttons</p>
            <div className="flex gap-2">
              {["search", "edit", "trash", "more"].map((name, i) => (
                <button key={name} className="rounded-xl border p-3" style={{ borderColor: palette.border, color: i === 2 ? palette.danger : palette.textPrimary }}>
                  <Icon name={name} size={17} />
                </button>
              ))}
            </div>
          </Card>

          <Card title="4. Form Controls" className="2xl:col-span-6">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-xs font-bold">Search<Input icon placeholder="Search products, SKUs..." /></label>
              <label className="space-y-1 text-xs font-bold">Text Input<Input placeholder="Enter product name" /></label>
              <label className="space-y-1 text-xs font-bold">Quantity Input
                <div className="flex overflow-hidden rounded-xl border" style={{ borderColor: palette.border }}>
                  <button className="h-10 w-11 bg-white">−</button>
                  <input value="25" readOnly className="h-10 w-full border-x text-center text-sm outline-none" style={{ borderColor: palette.border }} />
                  <button className="h-10 w-11 bg-white">+</button>
                  <span className="grid h-10 place-items-center px-3 text-xs" style={{ background: palette.background, color: palette.textMuted }}>Units</span>
                </div>
              </label>
              <label className="space-y-1 text-xs font-bold">Select Dropdown
                <div className="flex h-10 items-center justify-between rounded-xl border bg-white px-3 text-sm font-normal" style={{ borderColor: palette.border, color: palette.textMuted }}>
                  Select category <Icon name="chevronDown" size={16} />
                </div>
              </label>
              <label className="space-y-1 text-xs font-bold md:col-span-2">Textarea
                <textarea placeholder="Enter notes or description..." className="h-24 w-full resize-none rounded-xl border bg-white p-3 text-sm outline-none" style={{ borderColor: palette.border }} />
              </label>
              <div className="space-y-3 text-sm">
                <label className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-md text-white" style={{ background: palette.primary }}><Icon name="check" size={13} /></span> Enable reorder point</label>
                <label className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full border" style={{ borderColor: palette.primary }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.primary }} /></span> In Stock</label>
                <label className="flex items-center gap-2"><span className="h-5 w-9 rounded-full p-0.5" style={{ background: palette.primary }}><span className="block h-4 w-4 translate-x-4 rounded-full bg-white" /></span> Auto reorder</label>
              </div>
            </div>
          </Card>

          <Card title="5. Badges / Chips" className="2xl:col-span-2">
            <div className="flex flex-wrap gap-2">
              <Badge>In Stock</Badge>
              <Badge tone="warning">Low Stock</Badge>
              <Badge tone="danger">Out of Stock</Badge>
              <Badge tone="purple">Backordered</Badge>
              <Badge tone="blue">Incoming</Badge>
            </div>
          </Card>

          <Card title="6. Summary Cards" className="2xl:col-span-4">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <MetricCard icon="package" label="Total SKUs" value="4,782" delta="↑ 8.2% vs last month" />
              <MetricCard icon="alert" label="Low Stock" value="128" delta="↑ 5.4% vs last month" tone="warning" />
              <MetricCard icon="warehouse" label="Warehouses" value="12" delta="— No change" />
              <MetricCard icon="cart" label="Orders" value="1,256" delta="↑ 12.7% vs last month" tone="blue" />
            </div>
          </Card>

          <Card title="7. Product Table" className="overflow-hidden 2xl:col-span-7">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr style={{ background: palette.background }}>
                    {["SKU", "Product Name", "Category", "Quantity", "Location", "Status", "Last Updated", ""].map((h, index) => (
                      <th key={`${h}-${index}`} className="border-b px-3 py-3 text-xs font-black uppercase tracking-wide" style={{ borderColor: palette.border, color: palette.textMuted }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((row) => (
                    <tr key={row[0]} className="hover:bg-[#F7FAF8]">
                      {row.slice(0, 5).map((cell, i) => <td key={i} className="border-b px-3 py-3" style={{ borderColor: palette.border }}>{cell}</td>)}
                      <td className="border-b px-3 py-3" style={{ borderColor: palette.border }}><StatusBadge status={row[5]} /></td>
                      <td className="border-b px-3 py-3" style={{ borderColor: palette.border, color: palette.textMuted }}>{row[6]}</td>
                      <td className="border-b px-3 py-3" style={{ borderColor: palette.border }}><Icon name="more" size={16} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col justify-between gap-3 text-sm md:flex-row md:items-center">
              <p style={{ color: palette.textMuted }}>Showing 1 to 5 of 4,782 results</p>
              <div className="flex gap-2">
                {["chevronLeft", "1", "2", "3", "...", "957", "chevronRight"].map((item, i) => {
                  const isIcon = item === "chevronLeft" || item === "chevronRight";
                  return (
                    <button key={i} className="grid h-9 min-w-9 place-items-center rounded-xl border px-3 font-bold" style={{ borderColor: palette.border, background: item === "1" ? palette.primary : palette.surface, color: item === "1" ? "white" : palette.textPrimary }}>
                      {isIcon ? <Icon name={item} size={16} /> : item}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <div className="grid gap-5 2xl:col-span-5">
            <Card title="8. Tabs / Segmented">
              <div className="grid grid-cols-4 rounded-2xl border p-1 text-center text-sm font-bold" style={{ borderColor: palette.border }}>
                {["All Items", "Low Stock", "Suppliers", "Orders"].map((tab, i) => (
                  <button key={tab} className="rounded-xl py-2" style={{ background: i === 0 ? palette.softGreen : "transparent", color: i === 0 ? palette.primary : palette.textMuted }}>
                    {tab}
                  </button>
                ))}
              </div>
            </Card>
            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="9. Charts"><p className="text-sm font-semibold">Stock Trend (Last 6 Months)</p><MiniLineChart /></Card>
              <Card title="Stock by Status"><DonutChart /></Card>
            </div>
          </div>

          <Card title="10. Feedback & Overlays" className="2xl:col-span-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-bold">Modal / Dialog</p>
                <div className="rounded-2xl border bg-white p-4 shadow-xl" style={{ borderColor: palette.border }}>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-black">Adjust Stock Quantity</p><Icon name="x" size={16} />
                  </div>
                  <p className="text-xs font-semibold" style={{ color: palette.textMuted }}>SKU-1001 · Wireless Mouse</p>
                  <div className="my-4 rounded-xl p-3" style={{ background: palette.background }}>
                    <p className="text-xs font-bold" style={{ color: palette.textMuted }}>Current Quantity</p>
                    <p className="text-xl font-black">120 Units</p>
                  </div>
                  <label className="text-xs font-bold">New Quantity
                    <div className="mt-1 flex overflow-hidden rounded-xl border" style={{ borderColor: palette.border }}>
                      <button className="h-10 w-11">−</button><input value="150" readOnly className="h-10 w-full border-x text-center text-sm outline-none" style={{ borderColor: palette.border }} /><button className="h-10 w-11">+</button>
                    </div>
                  </label>
                  <div className="mt-5 grid grid-cols-2 gap-3"><Button variant="secondary">Cancel</Button><Button>Save Changes</Button></div>
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-bold">Toast Notifications</p>
                <div className="space-y-3">
                  <Toast tone="green" title="Stock updated" message="Quantity has been updated." />
                  <Toast tone="warning" title="Low stock alert" message="5 items are running low." />
                  <Toast tone="danger" title="Update failed" message="Please try again later." />
                </div>
              </div>
            </div>
          </Card>

          <Card title="11. Breadcrumb" className="2xl:col-span-7">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color: palette.textMuted }}>
              <Icon name="home" size={16} /> <Icon name="chevronRight" size={14} /> Inventory <Icon name="chevronRight" size={14} /> Products <Icon name="chevronRight" size={14} /> <span style={{ color: palette.textPrimary }}>SKU-1001</span>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
