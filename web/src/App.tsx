import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  ChartNoAxesColumn,
  CircuitBoard,
  Cpu,
  Gauge,
  HardDrive,
  Home,
  Monitor,
  Moon,
  Search,
  Server,
  Settings,
  ShieldCheck,
  SunMedium,
  BatteryCharging,
  Activity,
  ArrowDown,
  ArrowUp,
  Wifi,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

interface SystemInfo {
  hostname: string;
  os: string;
  architecture: string;
}

interface MemoryInfo {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  usage: number;
  status: string;
}

interface CpuInfo {
  model: string;
  logical_cores: number;
  physical_cores: number;
  processes: number;
  threads: number;
  usage: number;
  status: string;
}

interface DiskInfo {
  drive: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  usage: number;
  status: string;
}

interface UptimeInfo {
  days: number;
  hours: number;
  minutes: number;
}

interface NetworkInfo {
  connected: boolean;
  interface: string;
  download_mbps: number;
  upload_mbps: number;
  total_received_gb: number;
  total_sent_gb: number;
}

interface BatteryInfo {
  available: boolean;
  name: string;
  percentage: number;
  status: string;
  power_source: string;
  estimated_minutes: number;
  health_available: boolean;
  health_percent: number;
}

interface MetricsResponse {
  memory: MemoryInfo;
  cpu: CpuInfo;
  disk: DiskInfo;
  uptime: UptimeInfo;
  network: NetworkInfo;
  battery: BatteryInfo;
}

interface HistoryPoint {
  time: string;
  cpu: number;
  memory: number;
}

type ThemeMode = "dark" | "light";
type NavKey = "overview" | "processes" | "performance" | "storage" | "power" | "network" | "hardware" | "settings";

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));
const formatNumber = (value?: number, digits = 1) => (typeof value === "number" ? value.toFixed(digits) : "0.0");

function statusClass(status?: string) {
  switch ((status ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    default:
      return "normal";
  }
}

function MeshWave() {
  const rows = 15;
  const columns = 92;
  const layers = [
    { className: "mesh-layer mesh-teal", color: "#2cead9", phase: 0, opacity: 0.56, lift: -2 },
    { className: "mesh-layer mesh-cyan", color: "#2fb6ff", phase: 0.9, opacity: 0.48, lift: 1 },
    { className: "mesh-layer mesh-purple", color: "#7d61ff", phase: 2.2, opacity: 0.4, lift: 5 },
  ];

  const createPoints = (row: number, phase: number, lift: number) =>
    Array.from({ length: columns }, (_, col) => {
      const p = col / (columns - 1);
      const x = p * 900;
      const depth = (row - (rows - 1) / 2) * 4.2;
      const crestOne = Math.exp(-Math.pow(p - 0.48, 2) / 0.013) * 55;
      const crestTwo = Math.exp(-Math.pow(p - 0.7, 2) / 0.028) * 20;
      const ripple = Math.sin(p * Math.PI * 5.8 + row * 0.32 + phase) * (5.6 + Math.abs(depth) * 0.05);
      const y = 92 + depth + ripple - crestOne - crestTwo + lift;
      return { x, y };
    });

  return (
    <div className="mesh-wave" aria-hidden="true">
      <svg viewBox="0 0 900 150" preserveAspectRatio="none" role="presentation">
        <defs>
          <filter id="meshGlow" x="-25%" y="-55%" width="150%" height="210%">
            <feGaussianBlur stdDeviation="3.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {layers.map((layer) => (
          <g key={layer.className} className={layer.className} filter="url(#meshGlow)">
            {Array.from({ length: rows }).map((_, row) => {
              const points = createPoints(row, layer.phase, layer.lift);
              const path = points
                .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
                .join(" ");

              return (
                <g key={`${layer.className}-${row}`}>
                  <path d={path} stroke={layer.color} strokeOpacity={layer.opacity * 0.3} strokeWidth="0.75" fill="none" />
                  {points.map((point, col) => (
                    <circle
                      key={`${row}-${col}`}
                      cx={point.x}
                      cy={point.y}
                      r={0.82 + ((row + col) % 4) * 0.085}
                      fill={layer.color}
                      opacity={Math.max(0.09, layer.opacity - Math.abs(row - rows / 2) * 0.019)}
                    />
                  ))}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

function DonutChartCard({ value, colors }: { value: number; colors: [string, string] }) {
  const percentage = clampPercentage(value);
  const gradientId = `grad-${colors.join("").replace(/[^a-z0-9]/gi, "")}`;
  const data = [
    { name: "Used", value: percentage },
    { name: "Remaining", value: 100 - percentage },
  ];

  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colors[0]} />
              <stop offset="100%" stopColor={colors[1]} />
            </linearGradient>
          </defs>
          <Pie data={data} dataKey="value" startAngle={90} endAngle={-270} innerRadius="61%" outerRadius="82%" stroke="none">
            <Cell fill={`url(#${gradientId})`} />
            <Cell fill="rgba(125,153,186,0.14)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-center"><strong>{percentage.toFixed(1)}%</strong></div>
    </div>
  );
}

function SparkLine({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points, 100);
  const min = Math.min(...points, 0);
  const width = 162;
  const height = 38;
  const d = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point - min) / (max - min || 1)) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} stroke={color} strokeWidth="2.2" fill="none" />
    </svg>
  );
}

function MetricCard({
  id,
  icon,
  title,
  subtitle,
  value,
  status,
  details,
  colors,
  spark,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: number;
  status: string;
  details: { label: string; value: string }[];
  colors: [string, string];
  spark: { points: number[]; color: string };
}) {
  return (
    <article className="metric-card" id={id}>
      <div className="card-top">
        <div className="metric-title-block">
          <div className="metric-icon-box">{icon}</div>
          <div className="metric-heading-copy">
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="metric-content">
        <DonutChartCard value={value} colors={colors} />
        <div className="metric-info-column">
          <span className={`status-badge ${statusClass(status)}`}>{status}</span>
          <div className="metric-stats">
            {details.map((detail) => (
              <div key={detail.label} className="metric-stat-row">
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SparkLine points={spark.points} color={spark.color} />
    </article>
  );
}

function TelemetryCard({
  id,
  icon,
  title,
  subtitle,
  value,
  unit,
  status,
  accent,
  details,
  meter,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: string;
  unit?: string;
  status: string;
  accent: "teal" | "purple" | "blue";
  details: { label: string; value: string; icon?: ReactNode }[];
  meter?: number;
}) {
  const safeMeter = typeof meter === "number" ? clampPercentage(meter) : undefined;

  return (
    <article className={`telemetry-card ${accent}`} id={id}>
      <div className="telemetry-head">
        <div className={`telemetry-icon ${accent}`}>{icon}</div>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="telemetry-value-row">
        <div className="telemetry-value">
          <strong>{value}</strong>
          {unit && <span>{unit}</span>}
        </div>
        <span className={`status-badge ${statusClass(status)} ${status === "Unavailable" ? "unavailable" : ""}`}>{status}</span>
      </div>

      {typeof safeMeter === "number" && (
        <div className="telemetry-meter" aria-hidden="true">
          <span style={{ width: `${safeMeter}%` }} />
        </div>
      )}

      <div className="telemetry-details">
        {details.map((detail) => (
          <div className="telemetry-detail" key={detail.label}>
            <span>{detail.icon}{detail.label}</span>
            <strong>{detail.value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function App() {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(() => (window.localStorage.getItem("gsm-theme") === "light" ? "light" : "dark"));
  const [activeNav, setActiveNav] = useState<NavKey>("overview");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [uiFps, setUiFps] = useState(0);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("gsm-theme", theme);
  }, [theme]);

  const fetchSystem = useCallback(async () => {
    const response = await fetch("/api/system");
    if (!response.ok) throw new Error("System API request failed.");
    setSystem((await response.json()) as SystemInfo);
  }, []);

  const fetchMetrics = useCallback(async () => {
    const response = await fetch("/api/metrics");
    if (!response.ok) throw new Error("Metrics API request failed.");
    const data = (await response.json()) as MetricsResponse;
    setMetrics(data);

    const now = new Date();
    const label = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    setHistory((previous) => [...previous, { time: label, cpu: Number(data.cpu.usage.toFixed(1)), memory: Number(data.memory.usage.toFixed(1)) }].slice(-20));
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([fetchSystem(), fetchMetrics()]);
      setConnected(true);
    } catch (error) {
      console.error(error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [fetchMetrics, fetchSystem]);

  useEffect(() => {
    refreshAll();
    const metricsTimer = window.setInterval(() => fetchMetrics().then(() => setConnected(true)).catch(() => setConnected(false)), 2500);
    const clockTimer = window.setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      window.clearInterval(metricsTimer);
      window.clearInterval(clockTimer);
    };
  }, [fetchMetrics, refreshAll]);

  useEffect(() => {
    let frameCount = 0;
    let frameId = 0;
    let lastSample = performance.now();

    const tick = (now: number) => {
      frameCount += 1;
      const elapsed = now - lastSample;
      if (elapsed >= 1000) {
        setUiFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastSample = now;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationOpen(false);
        searchRef.current?.blur();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notificationOpen && notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [notificationOpen]);

  const navigateTo = (key: NavKey, id: string) => {
    setActiveNav(key);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const formattedDate = currentTime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const uptimeLabel = metrics ? `${metrics.uptime.days}d ${metrics.uptime.hours}h ${metrics.uptime.minutes}m` : "--";

  const chartData = history.length > 0 ? history : [
    { time: "14:30", cpu: 4, memory: 32 },
    { time: "14:31", cpu: 8, memory: 36 },
    { time: "14:32", cpu: 6, memory: 41 },
    { time: "14:33", cpu: 9, memory: 39 },
    { time: "14:34", cpu: 5, memory: 48 },
  ];

  const comparisonData = useMemo(() => [
    { name: "CPU", usage: Number((metrics?.cpu.usage ?? 7.4).toFixed(1)), color: "#21dce2" },
    { name: "Memory", usage: Number((metrics?.memory.usage ?? 81).toFixed(1)), color: "#9f58ff" },
    { name: "Disk", usage: Number((metrics?.disk.usage ?? 82.4).toFixed(1)), color: "#2ca7ff" },
  ], [metrics]);

  const cpuSpark = history.length > 4 ? history.map((item) => item.cpu) : [2, 4, 3, 9, 6, 10, 4, 8, 3];
  const memSpark = history.length > 4 ? history.map((item) => item.memory) : [72, 75, 74, 79, 80, 77, 81, 82, 80];
  const diskSpark = [76, 78, 79, 81, 80, 82, 83, 82, 82.4];

  const navItems: { key: NavKey; label: string; icon: ReactNode; target: string }[] = [
    { key: "overview", label: "Overview", icon: <Home size={20} />, target: "overview-section" },
    { key: "processes", label: "Processes", icon: <Monitor size={20} />, target: "cpu-card" },
    { key: "performance", label: "Performance", icon: <ChartNoAxesColumn size={20} />, target: "history-section" },
    { key: "storage", label: "Storage", icon: <HardDrive size={20} />, target: "disk-card" },
    { key: "power", label: "Power", icon: <BatteryCharging size={20} />, target: "battery-card" },
    { key: "network", label: "Network", icon: <Wifi size={20} />, target: "network-card" },
    { key: "hardware", label: "Hardware", icon: <CircuitBoard size={20} />, target: "summary-section" },
    { key: "settings", label: "Settings", icon: <Settings size={20} />, target: "footer-section" },
  ];

  const searchItems = [
    { label: "Overview", target: "overview-section", nav: "overview" as NavKey, keywords: "overview summary system" },
    { label: "CPU Usage", target: "cpu-card", nav: "performance" as NavKey, keywords: "cpu processor cores processes threads" },
    { label: "Memory Usage", target: "memory-card", nav: "performance" as NavKey, keywords: "memory ram used available" },
    { label: "Disk Usage", target: "disk-card", nav: "storage" as NavKey, keywords: "disk storage drive free space" },
    { label: "Battery & Power", target: "battery-card", nav: "power" as NavKey, keywords: "battery power charge charging health runtime ac" },
    { label: "Dashboard FPS", target: "fps-card", nav: "performance" as NavKey, keywords: "fps frames dashboard render performance" },
    { label: "Network Speed", target: "network-card", nav: "network" as NavKey, keywords: "internet network speed download upload mbps throughput" },
    { label: "Resource History", target: "history-section", nav: "performance" as NavKey, keywords: "history chart cpu memory" },
    { label: "Resource Comparison", target: "comparison-section", nav: "performance" as NavKey, keywords: "comparison bar chart" },
    { label: "System Status", target: "status-section", nav: "overview" as NavKey, keywords: "status health network online" },
  ];

  const filteredSearch = searchQuery.trim()
    ? searchItems.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(searchQuery.toLowerCase()))
    : searchItems.slice(0, 5);

  const selectSearchResult = (item: (typeof searchItems)[number]) => {
    setSearchQuery("");
    setSearchOpen(false);
    navigateTo(item.nav, item.target);
  };

  const alerts = [
    metrics && metrics.memory.status !== "Normal" ? `Memory usage is ${metrics.memory.status.toLowerCase()} at ${formatNumber(metrics.memory.usage)}%.` : null,
    metrics && metrics.disk.status !== "Normal" ? `Disk usage is ${metrics.disk.status.toLowerCase()} at ${formatNumber(metrics.disk.usage)}%.` : null,
    metrics && metrics.cpu.status !== "Normal" ? `CPU usage is ${metrics.cpu.status.toLowerCase()} at ${formatNumber(metrics.cpu.usage)}%.` : null,
    metrics?.battery.available && metrics.battery.percentage <= 20 ? `Battery is low at ${formatNumber(metrics.battery.percentage, 0)}%.` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <img src="/logo.png" alt="Go Monitor logo" className="brand-logo" />
          <div><h1>Go Monitor</h1><p>System Dashboard</p></div>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.key} type="button" className={`nav-button ${activeNav === item.key ? "active" : ""}`} onClick={() => navigateTo(item.key, item.target)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="side-status">
          <span className="status-orb" />
          <div><strong>System Online</strong><p>{connected ? "All systems operational" : "Trying to reconnect"}</p></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="search-wrap">
            <div className="search-box">
              <Search size={18} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search metrics, processes..."
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
              />
              <span>/</span>
            </div>
            {searchOpen && (
              <div className="search-popover">
                {filteredSearch.length > 0 ? filteredSearch.map((item) => (
                  <button key={item.label} type="button" onClick={() => selectSearchResult(item)}>
                    <Search size={15} /><span>{item.label}</span>
                  </button>
                )) : <div className="empty-search">No matching section</div>}
              </div>
            )}
          </div>

          <div className="top-actions">
            <div className="live-indicator"><span className="live-dot" /><span>LIVE</span></div>
            <div className="flat-time">
              <strong>{currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</strong>
              <span>{formattedDate}</span>
            </div>

            <div className="notification-wrap" ref={notificationRef}>
              <button type="button" className="icon-button" aria-label="Notifications" onClick={() => setNotificationOpen((open) => !open)}>
                <Bell size={18} />
                {alerts.length > 0 && <span className="alert-count">{alerts.length}</span>}
              </button>

              {notificationOpen && (
                <div className="notification-popover" role="dialog" aria-label="System alerts">
                  <div className="notification-head">
                    <strong>System alerts</strong>
                    <button
                      type="button"
                      className="notification-close"
                      aria-label="Close notifications"
                      onClick={(event) => {
                        event.stopPropagation();
                        setNotificationOpen(false);
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {alerts.length > 0
                    ? alerts.map((alert) => <div key={alert} className="notification-item">{alert}</div>)
                    : <div className="notification-item">No active alerts.</div>}
                </div>
              )}
            </div>

            <button type="button" className="icon-button" aria-label="Toggle theme" onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? <Moon size={18} /> : <SunMedium size={18} />}
            </button>
          </div>
        </header>

        <section className="hero-section" id="overview-section">
          <div className="hero-topline">
            <span className="hero-kicker">REAL-TIME TELEMETRY</span>
            <span className="hero-side-note">Keep your system healthy</span>
          </div>
          <div className="hero-main-row">
            <MeshWave />
            <div className="hero-text">
              <h2>System Overview</h2>
              <p>Live system monitoring and performance insights</p>
            </div>
          </div>
        </section>

        <section className="summary-grid" id="summary-section">
          <article className="summary-card"><div className="summary-icon teal"><Monitor size={22} /></div><div><span>Hostname</span><strong>{system?.hostname ?? "Loading..."}</strong></div></article>
          <article className="summary-card"><div className="summary-icon cyan"><Server size={22} /></div><div><span>Operating System</span><strong>{system?.os ?? "Loading..."}</strong></div></article>
          <article className="summary-card"><div className="summary-icon green"><Cpu size={22} /></div><div><span>Architecture</span><strong>{system?.architecture ?? "Loading..."}</strong></div></article>
          <article className="summary-card"><div className="summary-icon blue"><Gauge size={22} /></div><div><span>Uptime</span><strong>{uptimeLabel}</strong></div></article>
        </section>

        <section className="metrics-grid">
          <MetricCard id="cpu-card" icon={<Cpu size={20} />} title="CPU Usage" subtitle={metrics?.cpu.model ?? "Loading processor..."} value={metrics?.cpu.usage ?? 0} status={metrics?.cpu.status ?? "Normal"} details={[
            { label: "Physical / Logical", value: `${metrics?.cpu.physical_cores ?? 0} / ${metrics?.cpu.logical_cores ?? 0}` },
            { label: "Processes", value: `${metrics?.cpu.processes ?? 0}` },
            { label: "Threads", value: `${metrics?.cpu.threads ?? 0}` },
          ]} colors={["#29edd6", "#2bb8ff"]} spark={{ points: cpuSpark, color: "#22e8d9" }} />

          <MetricCard id="memory-card" icon={<CircuitBoard size={20} />} title="Memory Usage" subtitle={`${formatNumber(metrics?.memory.total_gb)} GB Total`} value={metrics?.memory.usage ?? 0} status={metrics?.memory.status ?? "Normal"} details={[
            { label: "Used", value: `${formatNumber(metrics?.memory.used_gb)} GB` },
            { label: "Available", value: `${formatNumber(metrics?.memory.available_gb)} GB` },
            { label: "Total", value: `${formatNumber(metrics?.memory.total_gb)} GB` },
          ]} colors={["#a95cff", "#6f4aff"]} spark={{ points: memSpark, color: "#a95cff" }} />

          <MetricCard id="disk-card" icon={<HardDrive size={20} />} title="Disk Usage" subtitle={`${metrics?.disk.drive ?? "C:\\"} Drive`} value={metrics?.disk.usage ?? 0} status={metrics?.disk.status ?? "Normal"} details={[
            { label: "Used", value: `${formatNumber(metrics?.disk.used_gb)} GB` },
            { label: "Free", value: `${formatNumber(metrics?.disk.free_gb)} GB` },
            { label: "Total", value: `${formatNumber(metrics?.disk.total_gb)} GB` },
          ]} colors={["#1fe6f1", "#258dff"]} spark={{ points: diskSpark, color: "#24c6ff" }} />
        </section>

        <section className="telemetry-grid" id="telemetry-section">
          <TelemetryCard
            id="battery-card"
            icon={<BatteryCharging size={22} />}
            title="Battery & Power"
            subtitle={metrics?.battery.available ? metrics.battery.name : "Battery information unavailable"}
            value={metrics?.battery.available ? formatNumber(metrics.battery.percentage, 0) : "N/A"}
            unit={metrics?.battery.available ? "%" : undefined}
            status={metrics?.battery.available ? metrics.battery.status : "Unavailable"}
            accent="teal"
            meter={metrics?.battery.available ? metrics.battery.percentage : undefined}
            details={[
              { label: "Power", value: metrics?.battery.available ? metrics.battery.power_source : "Unavailable" },
              { label: "Battery health", value: metrics?.battery.health_available ? `${formatNumber(metrics.battery.health_percent, 0)}%` : "N/A" },
              { label: "Estimated remaining", value: metrics?.battery.power_source === "AC Power" ? "Plugged in" : metrics?.battery.estimated_minutes ? `${Math.floor(metrics.battery.estimated_minutes / 60)}h ${metrics.battery.estimated_minutes % 60}m` : "Calculating" },
            ]}
          />

          <TelemetryCard
            id="fps-card"
            icon={<Activity size={22} />}
            title="Dashboard FPS"
            subtitle="Browser rendering performance"
            value={`${uiFps || "--"}`}
            unit="FPS"
            status={uiFps === 0 ? "Measuring" : uiFps >= 50 ? "Normal" : uiFps >= 30 ? "High" : "Critical"}
            accent="purple"
            meter={uiFps ? Math.min(100, (uiFps / 60) * 100) : 0}
            details={[
              { label: "Target", value: "60 FPS" },
              { label: "Measurement", value: "requestAnimationFrame" },
              { label: "Scope", value: "Dashboard UI" },
            ]}
          />

          <TelemetryCard
            id="network-card"
            icon={<Wifi size={22} />}
            title="Network Speed"
            subtitle="Live network throughput"
            value={formatNumber(metrics?.network.download_mbps, 2)}
            unit="Mbps"
            status={metrics?.network.connected ? "Normal" : "Critical"}
            accent="blue"
            details={[
              { label: "Download", value: `${formatNumber(metrics?.network.download_mbps, 2)} Mbps`, icon: <ArrowDown size={14} /> },
              { label: "Upload", value: `${formatNumber(metrics?.network.upload_mbps, 2)} Mbps`, icon: <ArrowUp size={14} /> },
              { label: "Interface", value: metrics?.network.interface ?? "--" },
            ]}
          />
        </section>

        <section className="panels-grid">
          <article className="panel-card history-panel" id="history-section">
            <div className="panel-header">
              <div className="panel-title-row"><div className="panel-icon cyan"><ChartNoAxesColumn size={20} /></div><div><h3>Resource History</h3><p>CPU &amp; Memory usage over time</p></div></div>
              <span className="range-label">Last 2 minutes</span>
            </div>
            <div className="panel-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20e2e6" stopOpacity={0.34} /><stop offset="100%" stopColor="#20e2e6" stopOpacity={0} /></linearGradient>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9e58ff" stopOpacity={0.36} /><stop offset="100%" stopColor="#9e58ff" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical stroke="rgba(120,150,190,0.17)" />
                  <XAxis dataKey="time" tickLine={false} axisLine={{ stroke: "rgba(120,150,190,0.3)" }} stroke="var(--muted)" minTickGap={26} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={{ stroke: "rgba(120,150,190,0.3)" }} width={34} stroke="var(--muted)" />
                  <Tooltip contentStyle={{ background: "var(--tooltip-bg)", border: "1px solid var(--tooltip-border)", borderRadius: "14px", color: "var(--text)" }} />
                  <Area type="monotone" dataKey="cpu" stroke="#1fe2e8" strokeWidth={2.1} fill="url(#cpuGrad)" dot={false} />
                  <Area type="monotone" dataKey="memory" stroke="#9e58ff" strokeWidth={2.1} fill="url(#memGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend"><span><i className="teal" /> CPU Usage</span><span><i className="purple" /> Memory Usage</span></div>
          </article>

          <article className="panel-card comparison-panel" id="comparison-section">
            <div className="panel-header"><div className="panel-title-row"><div className="panel-icon teal"><ChartNoAxesColumn size={20} /></div><div><h3>Resource Comparison</h3><p>Current resource usage</p></div></div></div>
            <div className="panel-chart-area comparison-chart-area">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 8" vertical={false} stroke="rgba(120,150,190,0.12)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="var(--muted)" />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={28} stroke="var(--muted)" />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{
                      background: "var(--tooltip-bg)",
                      border: "1px solid var(--tooltip-border)",
                      borderRadius: "14px",
                      color: "var(--text)",
                    }}
                    itemStyle={{
                      color: theme === "dark" ? "#ffffff" : "var(--text)",
                    }}
                  />
                  <Bar dataKey="usage" radius={[8, 8, 0, 0]}>
                    {comparisonData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    <LabelList dataKey="usage" position="top" formatter={(value: unknown) => `${Number(value).toFixed(1)}%`} fill="var(--chart-label)" fontSize={13} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="panel-card status-panel" id="status-section">
            <div className="panel-header"><div className="panel-title-row"><div className="panel-icon green"><ShieldCheck size={20} /></div><div><h3>System Status</h3><p>{connected ? "All systems operational" : "Trying to reconnect"}</p></div></div></div>
            <div className="status-list">
              <div className="status-line"><span><i /> CPU</span><b className={`status-badge ${statusClass(metrics?.cpu.status)}`}>{metrics?.cpu.status ?? "Normal"}</b><strong>{formatNumber(metrics?.cpu.usage)}%</strong></div>
              <div className="status-line"><span><i /> Memory</span><b className={`status-badge ${statusClass(metrics?.memory.status)}`}>{metrics?.memory.status ?? "Normal"}</b><strong>{formatNumber(metrics?.memory.usage)}%</strong></div>
              <div className="status-line"><span><i /> Disk</span><b className={`status-badge ${statusClass(metrics?.disk.status)}`}>{metrics?.disk.status ?? "Normal"}</b><strong>{formatNumber(metrics?.disk.usage)}%</strong></div>
              <div className="status-line"><span><i /> Network</span><b className={`status-badge ${metrics?.network.connected ? "normal" : "critical"}`}>{metrics?.network.connected ? "Online" : "Offline"}</b><strong>{metrics?.network.interface ?? "--"}</strong></div>
              <div className="status-line"><span><i /> Battery</span><b className={`status-badge ${metrics?.battery.available && metrics.battery.percentage > 20 ? "normal" : metrics?.battery.available ? "high" : "unavailable"}`}>{metrics?.battery.available ? metrics.battery.status : "N/A"}</b><strong>{metrics?.battery.available ? `${formatNumber(metrics.battery.percentage, 0)}%` : "Unavailable"}</strong></div>
            </div>
          </article>
        </section>

        <footer className="footer-row" id="footer-section"><span>Go System Monitor v1.0.0 • Final Dashboard</span><span>Built with Go</span></footer>
      </main>

      {loading && <div className="loading-overlay">Connecting to telemetry...</div>}
    </div>
  );
}

export default App;
