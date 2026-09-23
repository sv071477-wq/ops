"use client";

import React, { useState, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Users, Briefcase, Clock, CheckCircle2,
  AlertTriangle, BarChart3, Calendar, Target, Award, Activity,
  RefreshCw, ChevronDown, Zap, Shield, PieChart, MapPin,
  ArrowUpRight, ArrowDownRight, Minus, Layers, Filter, Check,
  BarChart2, LineChart
} from "lucide-react";
import { Batch, User, ManagerDashboardSummary } from "@/lib/api";
import { formatDate } from "@/lib/dateUtils";

interface EnterpriseDashboardProps {
  batches: Batch[];
  users: User[];
  dashboardSummary: ManagerDashboardSummary | null;
  isLoading: boolean;
}

type TimePeriod = "daily" | "weekly" | "monthly" | "quarterly" | "all";

const PERIOD_LABELS: Record<TimePeriod, string> = {
  daily: "Today",
  weekly: "This Week",
  monthly: "This Month",
  quarterly: "This Quarter",
  all: "All Time",
};

function parseBatchDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function getPeriodRange(period: TimePeriod): { from: Date; to: Date } {
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);

  if (period === "daily") {
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === "weekly") {
    // Current week: from Monday to Sunday 23:59:59
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    from.setDate(now.getDate() - diffToMonday);
    from.setHours(0, 0, 0, 0);
    to = new Date(from);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
  } else if (period === "monthly") {
    // Current month: 1st of month to last day of month 23:59:59
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === "quarterly") {
    // Current quarter: 1st of quarter to last day of quarter 23:59:59
    const q = Math.floor(now.getMonth() / 3);
    from = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
  } else {
    from = new Date(2000, 0, 1, 0, 0, 0, 0);
    to = new Date(2099, 11, 31, 23, 59, 59, 999);
  }
  return { from, to };
}

function isBatchInPeriod(batch: Batch, period: TimePeriod): boolean {
  if (period === "all") return true;
  const { from, to } = getPeriodRange(period);

  const start = parseBatchDate(batch.start_date);
  const end = parseBatchDate(batch.end_date);

  // If start and end date exist, check if operational delivery window overlaps [from, to]
  if (start && end) {
    return start <= to && end >= from;
  }
  if (start) {
    return start >= from && start <= to;
  }
  const created = parseBatchDate(batch.created_at);
  if (created) {
    return created >= from && created <= to;
  }
  return false;
}

function MiniBar({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 28 }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: `${Math.max(4, (v / max) * 28)}px`,
            background: color,
            borderRadius: 2,
            opacity: 0.45 + (i / values.length) * 0.55,
            transition: "height 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

function Trend({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0)
    return (
      <span style={{ color: "#94a3b8", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 2 }}>
        <Minus size={11} /> Baseline
      </span>
    );
  const positive = value > 0;
  return (
    <span
      style={{
        color: positive ? "#16a34a" : "#dc2626",
        fontSize: "0.75rem",
        display: "flex",
        alignItems: "center",
        gap: 2,
        fontWeight: 600,
      }}
    >
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {positive ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
  trend,
  sparkValues,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ElementType;
  trend?: number;
  sparkValues?: number[];
}) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "18px 20px",
        borderLeft: `4px solid ${color}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ position: "absolute", right: 14, top: 14, opacity: 0.08 }}>
        <Icon size={52} color={color} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
        <div style={{ background: `${color}18`, borderRadius: 8, padding: "5px 6px", display: "flex" }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        {sub && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{sub}</div>}
        {trend !== undefined && <Trend value={trend} />}
      </div>
      {sparkValues && (
        <div style={{ marginTop: 4 }}>
          <MiniBar values={sparkValues} color={color} />
        </div>
      )}
    </div>
  );
}

function RingProgress({ percent, color, size = 64 }: { percent: number; color: string; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
}

function SectionHeader({ title, sub, icon: Icon, badge }: { title: string; sub?: string; icon?: React.ElementType; badge?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {Icon && (
          <div style={{ background: "linear-gradient(135deg,#e8f2fb,#dbeafe)", borderRadius: 8, padding: "6px 7px", display: "flex" }}>
            <Icon size={16} color="#0b5cab" />
          </div>
        )}
        <div>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>{title}</h3>
          {sub && <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>{sub}</p>}
        </div>
      </div>
      {badge && (
        <span style={{ fontSize: "0.72rem", fontWeight: 700, background: "#f1f5f9", color: "var(--text-dim)", padding: "3px 9px", borderRadius: 12 }}>
          {badge}
        </span>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  Requested: "#94a3b8",
  "Approval 1 Pending": "#f59e0b",
  "Approval 2 Pending": "#f97316",
  Approved: "#3b82f6",
  Upcoming: "#8b5cf6",
  Ongoing: "#06b6d4",
  Completed: "#16a34a",
  Cancelled: "#ef4444",
  OnHold: "#d97706",
};

/**
 * Interactive SVG Donut Chart with center metrics & dynamic legend
 */
function SvgDonutChart({
  data,
  total,
  centerTitle,
  centerSubtitle,
}: {
  data: { label: string; count: number; color: string }[];
  total: number;
  centerTitle: string;
  centerSubtitle: string;
}) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  let accumulatedDash = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="180" height="180" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="90" cy="90" r={r} fill="none" stroke="#f1f5f9" strokeWidth="22" />
          {total > 0 &&
            data.map((seg, idx) => {
              if (seg.count <= 0) return null;
              const segDash = (seg.count / total) * circ;
              const currentOffset = accumulatedDash;
              accumulatedDash += segDash;
              return (
                <circle
                  key={idx}
                  cx="90"
                  cy="90"
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="22"
                  strokeDasharray={`${segDash} ${circ}`}
                  strokeDashoffset={-currentOffset}
                  style={{ transition: "stroke-dashoffset 0.6s ease, stroke-dasharray 0.6s ease" }}
                />
              );
            })}
        </svg>
        <div style={{ position: "absolute", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", lineHeight: 1.1 }}>{centerTitle}</div>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            {centerSubtitle}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
        {data.map((seg) => {
          const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
          return (
            <div key={seg.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: "0.8rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{seg.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 800, color: seg.color }}>{seg.count}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Interactive SVG Area / Velocity Curve Chart
 */
function SvgDeliveryTimeline({
  batches,
}: {
  batches: Batch[];
}) {
  const points = useMemo(() => {
    const monthCounts: Record<string, { label: string; count: number; hours: number }> = {};
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Seed the last 6 months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthCounts[key] = {
        label: `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
        count: 0,
        hours: 0,
      };
    }

    batches.forEach((b) => {
      const dateStr = b.start_date || b.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthCounts[key]) {
        monthCounts[key].count++;
        monthCounts[key].hours += Number(b.total_hours) || 0;
      }
    });

    return Object.values(monthCounts);
  }, [batches]);

  const maxVal = Math.max(...points.map((p) => p.count), 4);
  const width = 540;
  const height = 140;
  const paddingX = 40;
  const paddingY = 24;

  const chartPoints = points.map((p, i) => {
    const x = paddingX + (i / Math.max(points.length - 1, 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (p.count / maxVal) * (height - 2 * paddingY);
    return { ...p, x, y };
  });

  const pathD = chartPoints.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
  }, "");

  const fillD = chartPoints.length > 0
    ? `${pathD} L ${chartPoints[chartPoints.length - 1].x} ${height - paddingY} L ${chartPoints[0].x} ${height - paddingY} Z`
    : "";

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height + 25}`} style={{ width: "100%", minWidth: 380, height: 165 }}>
        <defs>
          <linearGradient id="velocityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.5, 1].map((pct, idx) => {
          const y = height - paddingY - pct * (height - 2 * paddingY);
          return (
            <line
              key={idx}
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          );
        })}

        {/* Area fill & smooth bezier curve */}
        {fillD && <path d={fillD} fill="url(#velocityGrad)" />}
        {pathD && <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />}

        {/* Interactive nodes and axis labels */}
        {chartPoints.map((pt, i) => (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r="5" fill="#fff" stroke="#8b5cf6" strokeWidth="3" />
            <text x={pt.x} y={pt.y - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill="#6b21a8">
              {pt.count}
            </text>
            <text x={pt.x} y={height + 14} textAnchor="middle" fontSize="10" fontWeight="600" fill="#94a3b8">
              {pt.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function EnterpriseDashboard({ batches, users, dashboardSummary, isLoading }: EnterpriseDashboardProps) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const [workloadTab, setWorkloadTab] = useState<"managers" | "coordinators">("managers");

  // Precompute live counts for every horizon tab so counts are visible on the buttons
  const periodCounts = useMemo(() => {
    return {
      daily: batches.filter((b) => isBatchInPeriod(b, "daily")).length,
      weekly: batches.filter((b) => isBatchInPeriod(b, "weekly")).length,
      monthly: batches.filter((b) => isBatchInPeriod(b, "monthly")).length,
      quarterly: batches.filter((b) => isBatchInPeriod(b, "quarterly")).length,
      all: batches.length,
    };
  }, [batches]);

  // Active dataset for dashboard and team analytics directly driven by selected period
  const activeBatchesDataset = useMemo(
    () => (period === "all" ? batches : batches.filter((b) => isBatchInPeriod(b, period))),
    [batches, period]
  );

  const managers = useMemo(() => {
    const managerIds = new Set(users.filter((u) => u.role === "Manager").map((u) => u.id));
    return users.filter(
      (u) => u.role === "Manager" && (!u.manager_id || !managerIds.has(u.manager_id))
    );
  }, [users]);

  const managerById = useMemo(() => new Map(users.filter((u) => u.role === "Manager").map((u) => [u.id, u])), [users]);

  const coordinators = useMemo(() => {
    const managerIds = new Set(managers.map((m) => m.id));
    return users.filter((u) => {
      if (u.role !== "Coordinator") return false;
      if (u.manager_id && managerIds.has(u.manager_id)) return true;
      if (u.manager_name) {
        return managers.some((m) => m.full_name === u.manager_name);
      }
      return false;
    });
  }, [users, managers]);

  const coordinatorIdsByManager = useMemo(() => {
    const map = new Map<string, Set<string>>();
    managers.forEach((m) => map.set(m.id, new Set()));

    users.forEach((u) => {
      if (u.role !== "Coordinator") return;
      const managerId = u.manager_id ||
        users.find((m) => m.role === "Manager" && m.full_name === u.manager_name)?.id || null;
      if (!managerId || !map.has(managerId)) return;
      map.get(managerId)?.add(u.id);
    });

    return map;
  }, [users, managers]);

  const statusBuckets = useMemo(() => {
    const counts: Record<string, number> = {};
    activeBatchesDataset.forEach((b) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    return counts;
  }, [activeBatchesDataset]);

  const domainStats = useMemo(() => {
    const map: Record<string, { total: number; active: number; hours: number; enrollments: number; completed: number }> = {};
    activeBatchesDataset.forEach((b) => {
      const d = b.domain || "Other";
      if (!map[d]) map[d] = { total: 0, active: 0, hours: 0, enrollments: 0, completed: 0 };
      map[d].total++;
      if (["Approved", "Upcoming", "Ongoing"].includes(b.status)) map[d].active++;
      if (b.status === "Completed") map[d].completed++;
      map[d].hours += Number(b.total_hours) || 0;
      map[d].enrollments += Number(b.total_enrollments) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].active - a[1].active);
  }, [activeBatchesDataset]);

  const managerWorkload = useMemo(
    () =>
      managers
        .map((m) => {
          const relatedCoordinatorIds = coordinatorIdsByManager.get(m.id) || new Set<string>();
          const mb = activeBatchesDataset.filter((b) => {
            const isOwnedByManager = b.primary_manager_id === m.id || b.approver_1_id === m.id || b.approver_2_id === m.id;
            const isManagedByCoordinator = !!b.coordinator_id && relatedCoordinatorIds.has(b.coordinator_id);
            return isOwnedByManager || isManagedByCoordinator;
          });
          return {
            manager: m,
            total: mb.length,
            active: mb.filter((b) => ["Approved", "Upcoming", "Ongoing"].includes(b.status)).length,
            pending: mb.filter((b) => b.status.includes("Pending") || b.status === "Requested").length,
            completed: mb.filter((b) => b.status === "Completed").length,
            totalHours: mb.reduce((s, b) => s + (Number(b.total_hours) || 0), 0),
            totalEnrollments: mb.reduce((s, b) => s + (Number(b.total_enrollments) || 0), 0),
          };
        })
        .sort((a, b) => b.active - a.active),
    [managers, activeBatchesDataset, coordinatorIdsByManager]
  );

  const coordinatorWorkload = useMemo(
    () =>
      coordinators
        .map((c) => {
          const mb = activeBatchesDataset.filter((b) => b.coordinator_id === c.id);
          return {
            coordinator: c,
            total: mb.length,
            active: mb.filter((b) => ["Approved", "Upcoming", "Ongoing"].includes(b.status)).length,
            pending: mb.filter((b) => b.status.includes("Pending") || b.status === "Requested").length,
            completed: mb.filter((b) => b.status === "Completed").length,
            totalHours: mb.reduce((s, b) => s + (Number(b.total_hours) || 0), 0),
            totalEnrollments: mb.reduce((s, b) => s + (Number(b.total_enrollments) || 0), 0),
          };
        })
        .sort((a, b) => b.active - a.active),
    [coordinators, activeBatchesDataset]
  );

  const clientStats = useMemo(() => {
    const map: Record<string, { batches: number; enrollments: number; hours: number; active: number }> = {};
    activeBatchesDataset.forEach((b) => {
      const c = b.client_name || "Unassigned";
      if (!map[c]) map[c] = { batches: 0, enrollments: 0, hours: 0, active: 0 };
      map[c].batches++;
      map[c].enrollments += Number(b.total_enrollments) || 0;
      map[c].hours += Number(b.total_hours) || 0;
      if (["Approved", "Upcoming", "Ongoing"].includes(b.status)) map[c].active++;
    });
    return Object.entries(map).sort((a, b) => b[1].batches - a[1].batches).slice(0, 10);
  }, [activeBatchesDataset]);

  const modeStats = useMemo(() => {
    const map: Record<string, number> = {};
    activeBatchesDataset.forEach((b) => {
      const m = b.delivery_mode || "Online";
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [activeBatchesDataset]);

  const pipelineFunnel = [
    { label: "Requested", status: "Requested", color: "#94a3b8" },
    { label: "Approval 1", status: "Approval 1 Pending", color: "#f59e0b" },
    { label: "Approval 2", status: "Approval 2 Pending", color: "#f97316" },
    { label: "Approved", status: "Approved", color: "#3b82f6" },
    { label: "Upcoming", status: "Upcoming", color: "#8b5cf6" },
    { label: "Ongoing", status: "Ongoing", color: "#06b6d4" },
    { label: "Completed", status: "Completed", color: "#16a34a" },
    { label: "Cancelled", status: "Cancelled", color: "#ef4444" },
    { label: "On Hold", status: "OnHold", color: "#d97706" },
  ].map((s) => ({ ...s, count: statusBuckets[s.status] || 0 }));

  const maxFunnelCount = Math.max(...pipelineFunnel.map((f) => f.count), 1);

  const totalBatches = activeBatchesDataset.length;
  const activeBatchesCount = activeBatchesDataset.filter((b) => ["Approved", "Upcoming", "Ongoing"].includes(b.status)).length;
  const completedBatches = activeBatchesDataset.filter((b) => b.status === "Completed").length;
  const cancelledBatches = activeBatchesDataset.filter((b) => b.status === "Cancelled").length;
  const totalEnrollments = activeBatchesDataset.reduce((s, b) => s + (Number(b.total_enrollments) || 0), 0);
  const totalHours = activeBatchesDataset.reduce((s, b) => s + (Number(b.total_hours) || 0), 0);
  const pendingApprovals = activeBatchesDataset.filter((b) => b.status.includes("Pending")).length;
  const onHoldBatches = activeBatchesDataset.filter((b) => b.status === "OnHold").length;
  const completionRate = totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0;
  const activeRate = totalBatches > 0 ? Math.round((activeBatchesCount / totalBatches) * 100) : 0;
  const cancellationRate = totalBatches > 0 ? Math.round((cancelledBatches / totalBatches) * 100) : 0;

  // Donut chart segments for status
  const donutData = useMemo(() => [
    { label: "Live Delivery", count: activeBatchesDataset.filter((b) => ["Upcoming", "Ongoing"].includes(b.status)).length, color: "#8b5cf6" },
    { label: "Approved (Pre-flight)", count: activeBatchesDataset.filter((b) => b.status === "Approved").length, color: "#3b82f6" },
    { label: "Approval Review", count: activeBatchesDataset.filter((b) => b.status.includes("Pending") || b.status === "Requested").length, color: "#f59e0b" },
    { label: "Completed", count: completedBatches, color: "#16a34a" },
    { label: "Cancelled / Hold", count: activeBatchesDataset.filter((b) => ["Cancelled", "OnHold"].includes(b.status)).length, color: "#ef4444" },
  ], [activeBatchesDataset, completedBatches]);

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "64px 0" }}>
        <RefreshCw className="animate-spin" size={32} color="#0b5cab" style={{ margin: "0 auto 12px" }} />
        <div style={{ color: "var(--text-muted)", fontWeight: 600 }}>Loading enterprise analytics...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header & Filter Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
              Team Analytics & Operations Command
            </h2>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, background: "#dbeafe", color: "#0b5cab", padding: "3px 8px", borderRadius: 12 }}>
              Executive View
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Visual workload distribution, operational throughput, and capacity analytics.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Horizon Period Selector with Dynamic Live Counts */}
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 10, padding: "4px" }}>
            {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map((p) => {
              const count = periodCounts[p];
              const isSelected = period === p;
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 7,
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: isSelected ? "linear-gradient(135deg,#0b5cab,#1d6ed8)" : "transparent",
                    color: isSelected ? "#fff" : "var(--text-dim)",
                    boxShadow: isSelected ? "0 2px 6px rgba(11,92,171,0.25)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  <span>{PERIOD_LABELS[p]}</span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: 10,
                      background: isSelected ? "rgba(255,255,255,0.28)" : "#e2e8f0",
                      color: isSelected ? "#fff" : "var(--text-dim)",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Filter Scope Info / Reset */}
          {period !== "all" ? (
            <button
              onClick={() => setPeriod("all")}
              className="btn btn-secondary"
              style={{
                padding: "6px 12px",
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#0b5cab",
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
              }}
              title="Reset horizon to show all batches"
            >
              <RefreshCw size={12} />
              <span>Reset (All {batches.length})</span>
            </button>
          ) : (
            <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 600, padding: "4px 8px" }}>
              Showing All {batches.length} Batches
            </span>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 14 }}>
        <KpiCard label="Total Batches" value={totalBatches} sub="Under governance" color="#0b5cab" icon={Briefcase} sparkValues={[2, 4, 3, 5, 6, 4, 7, totalBatches]} />
        <KpiCard label="Active Batches" value={activeBatchesCount} sub={`${activeRate}% of portfolio`} color="#8b5cf6" icon={Activity} sparkValues={[1, 2, 3, 2, 4, 3, 5, activeBatchesCount]} />
        <KpiCard label="Total Enrollments" value={totalEnrollments.toLocaleString()} sub="Learners deployed" color="#06b6d4" icon={Users} />
        <KpiCard label="Scheduled Hours" value={`${Math.round(totalHours).toLocaleString()}h`} sub="Curriculum delivery" color="#f59e0b" icon={Clock} />
        <KpiCard label="Completed" value={completedBatches} sub={`${completionRate}% completion rate`} color="#16a34a" icon={CheckCircle2} />
        <KpiCard label="Pending Approvals" value={pendingApprovals} sub="Awaiting signoff" color="#f97316" icon={AlertTriangle} />
        <KpiCard label="On Hold" value={onHoldBatches} sub="Action required" color="#d97706" icon={Shield} />
        <KpiCard label="Cancellations" value={cancelledBatches} sub={`${cancellationRate}% cancellation rate`} color="#ef4444" icon={TrendingDown} />
      </div>

      {/* PRIMARY SECTION: Team Workload Graphs & Visual Distribution */}
      <div className="glass-panel" style={{ padding: "24px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <SectionHeader
            title="Team Workload & Capacity Comparison Charts"
            sub="Visual composition of active delivery, review pipeline, and completed volume per personnel"
            icon={BarChart2}
          />

          <div style={{ display: "flex", gap: 6, background: "#f8fafc", padding: "4px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => setWorkloadTab("managers")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 700,
                background: workloadTab === "managers" ? "#0b5cab" : "transparent",
                color: workloadTab === "managers" ? "#fff" : "var(--text-dim)",
                transition: "all 0.2s",
              }}
            >
              Managers ({managers.length})
            </button>
            <button
              onClick={() => setWorkloadTab("coordinators")}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 700,
                background: workloadTab === "coordinators" ? "#06b6d4" : "transparent",
                color: workloadTab === "coordinators" ? "#fff" : "var(--text-dim)",
                transition: "all 0.2s",
              }}
            >
              Coordinators ({coordinators.length})
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 18, marginBottom: 20, flexWrap: "wrap", fontSize: "0.75rem", fontWeight: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#8b5cf6" }} />
            <span style={{ color: "var(--text-main)" }}>Active Delivery (Approved/Ongoing)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#f59e0b" }} />
            <span style={{ color: "var(--text-main)" }}>Pipeline Review / Pending</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "#16a34a" }} />
            <span style={{ color: "var(--text-main)" }}>Completed Deliveries</span>
          </div>
        </div>

        {/* Stacked Visual Bar Graph */}
        {workloadTab === "managers" ? (
          managerWorkload.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>No manager workload data available.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {managerWorkload.map((w) => {
                const total = Math.max(w.total, 1);
                const activePct = (w.active / total) * 100;
                const pendingPct = (w.pending / total) * 100;
                const completedPct = (w.completed / total) * 100;
                const load = w.total > 0 ? Math.round((w.active / w.total) * 100) : 0;
                const loadColor = load >= 75 ? "#ef4444" : load >= 45 ? "#f59e0b" : "#16a34a";
                const loadStatus = load >= 75 ? "Heavy Load" : load >= 45 ? "Optimal" : "Available";

                return (
                  <div key={w.manager.id} style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 18px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0b5cab,#1d6ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.75rem", fontWeight: 800 }}>
                          {w.manager.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>{w.manager.full_name}</span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: 8 }}>
                            {w.manager.team_name || "Delivery Team"}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          <strong>{Math.round(w.totalHours)}h</strong> · <strong>{w.totalEnrollments.toLocaleString()}</strong> learners
                        </span>
                        <span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "3px 9px", borderRadius: 12, background: `${loadColor}18`, color: loadColor, border: `1px solid ${loadColor}40` }}>
                          {load}% · {loadStatus}
                        </span>
                      </div>
                    </div>

                    {/* Segmented Stacked Bar */}
                    <div style={{ height: 16, background: "#e2e8f0", borderRadius: 8, overflow: "hidden", display: "flex" }}>
                      {w.active > 0 && (
                        <div
                          style={{ width: `${activePct}%`, background: "#8b5cf6", height: "100%", transition: "width 0.5s ease" }}
                          title={`Active: ${w.active}`}
                        />
                      )}
                      {w.pending > 0 && (
                        <div
                          style={{ width: `${pendingPct}%`, background: "#f59e0b", height: "100%", transition: "width 0.5s ease" }}
                          title={`Pending: ${w.pending}`}
                        />
                      )}
                      {w.completed > 0 && (
                        <div
                          style={{ width: `${completedPct}%`, background: "#16a34a", height: "100%", transition: "width 0.5s ease" }}
                          title={`Completed: ${w.completed}`}
                        />
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      <span>Active: <strong style={{ color: "#8b5cf6" }}>{w.active}</strong></span>
                      <span>In Review: <strong style={{ color: "#f59e0b" }}>{w.pending}</strong></span>
                      <span>Completed: <strong style={{ color: "#16a34a" }}>{w.completed}</strong></span>
                      <span>Total Batches: <strong>{w.total}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : coordinatorWorkload.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>No coordinator workload data available.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {coordinatorWorkload.map((w) => {
              const total = Math.max(w.total, 1);
              const activePct = (w.active / total) * 100;
              const pendingPct = (w.pending / total) * 100;
              const completedPct = (w.completed / total) * 100;
              const capacity = w.total > 0 ? Math.round((w.active / w.total) * 100) : 0;
              const capColor = capacity >= 80 ? "#ef4444" : capacity >= 45 ? "#f59e0b" : "#06b6d4";
              const capStatus = capacity >= 80 ? "High Allocation" : capacity >= 45 ? "Optimal" : "Available Capacity";

              return (
                <div key={w.coordinator.id} style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 18px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#06b6d4,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.75rem", fontWeight: 800 }}>
                        {w.coordinator.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>{w.coordinator.full_name}</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: 8 }}>
                          {w.coordinator.team_name || "Coordination Team"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        <strong>{Math.round(w.totalHours)}h</strong> · <strong>{w.totalEnrollments.toLocaleString()}</strong> learners
                      </span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 800, padding: "3px 9px", borderRadius: 12, background: `${capColor}18`, color: capColor, border: `1px solid ${capColor}40` }}>
                        {capacity}% · {capStatus}
                      </span>
                    </div>
                  </div>

                  {/* Segmented Stacked Bar */}
                  <div style={{ height: 16, background: "#e2e8f0", borderRadius: 8, overflow: "hidden", display: "flex" }}>
                    {w.active > 0 && (
                      <div
                        style={{ width: `${activePct}%`, background: "#06b6d4", height: "100%", transition: "width 0.5s ease" }}
                        title={`Active: ${w.active}`}
                      />
                    )}
                    {w.pending > 0 && (
                      <div
                        style={{ width: `${pendingPct}%`, background: "#f59e0b", height: "100%", transition: "width 0.5s ease" }}
                        title={`Pending: ${w.pending}`}
                      />
                    )}
                    {w.completed > 0 && (
                      <div
                        style={{ width: `${completedPct}%`, background: "#16a34a", height: "100%", transition: "width 0.5s ease" }}
                        title={`Completed: ${w.completed}`}
                      />
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                    <span>Active Coordinated: <strong style={{ color: "#06b6d4" }}>{w.active}</strong></span>
                    <span>In Pipeline: <strong style={{ color: "#f59e0b" }}>{w.pending}</strong></span>
                    <span>Completed: <strong style={{ color: "#16a34a" }}>{w.completed}</strong></span>
                    <span>Total Batches: <strong>{w.total}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VISUAL REPRESENTATION 2: Lifecycle Donut & Delivery Velocity Timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        {/* SVG Donut Chart */}
        <div className="glass-panel" style={{ padding: "22px 24px" }}>
          <SectionHeader title="Portfolio Lifecycle Distribution" sub="Proportional status share of batches" icon={PieChart} />
          <SvgDonutChart
            data={donutData}
            total={totalBatches}
            centerTitle={String(totalBatches)}
            centerSubtitle="Total Batches"
          />
        </div>

        {/* SVG Velocity Timeline */}
        <div className="glass-panel" style={{ padding: "22px 24px" }}>
          <SectionHeader title="Delivery Trajectory & Timeline" sub="Historical and scheduled batch initiation rate" icon={LineChart} />
          <SvgDeliveryTimeline batches={activeBatchesDataset} />
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <div>Active Delivery Velocity: <strong style={{ color: "#8b5cf6" }}>{activeBatchesCount} batches</strong></div>
            <div>Completion Velocity: <strong style={{ color: "#16a34a" }}>{completedBatches} batches</strong></div>
          </div>
        </div>
      </div>

      {/* VISUAL REPRESENTATION 3: Pipeline Funnel + Mode Split */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="glass-panel" style={{ padding: "22px 24px" }}>
          <SectionHeader title="Batch Pipeline Funnel" sub="Full lifecycle status distribution" icon={BarChart3} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pipelineFunnel.map((stage) => (
              <div key={stage.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 95, fontSize: "0.74rem", fontWeight: 600, color: "var(--text-dim)", textAlign: "right", flexShrink: 0 }}>
                  {stage.label}
                </div>
                <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 6, height: 22, position: "relative", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(stage.count / maxFunnelCount) * 100}%`,
                      height: "100%",
                      background: stage.color,
                      borderRadius: 6,
                      transition: "width 0.5s ease",
                      minWidth: stage.count > 0 ? 8 : 0,
                    }}
                  />
                </div>
                <div style={{ width: 34, textAlign: "center", fontSize: "0.8rem", fontWeight: 800, color: stage.count > 0 ? stage.color : "#94a3b8" }}>
                  {stage.count}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="glass-panel" style={{ padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
              <RingProgress percent={completionRate} color="#16a34a" size={64} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, color: "#16a34a" }}>
                {completionRate}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)" }}>Completion Rate</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#16a34a" }}>{completedBatches} Done</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>of {totalBatches} total batches</div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "18px 20px", flex: 1 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12 }}>
              Delivery Mode Split
            </div>
            {modeStats.map(([mode, count]) => {
              const modeColor = mode === "Online" ? "#06b6d4" : mode === "Offline" ? "#8b5cf6" : "#f59e0b";
              return (
                <div key={mode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: modeColor }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)" }}>{mode}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 60, height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${totalBatches > 0 ? (count / totalBatches) * 100 : 0}%`, height: "100%", background: modeColor, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-dim)", width: 28, textAlign: "right" }}>{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Domain Intelligence with Proportional Visual Progress Bars */}
      <div className="glass-panel" style={{ padding: "22px 24px" }}>
        <SectionHeader title="Domain Intelligence" sub="Performance breakdown by training vertical" icon={PieChart} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {domainStats.map(([domain, stats], ci) => {
            const domainCompletion = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            const colors = ["#0b5cab", "#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#16a34a", "#f97316", "#ec4899"];
            const color = colors[ci % colors.length];
            return (
              <div
                key={domain}
                style={{
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  background: `${color}06`,
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 800, color }}>{domain}</span>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, background: `${color}18`, color, padding: "2px 8px", borderRadius: 10 }}>
                    {stats.active} Active
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Total", val: stats.total },
                    { label: "Completed", val: stats.completed },
                    { label: "Enrollments", val: stats.enrollments.toLocaleString() },
                    { label: "Hours", val: `${Math.round(stats.hours)}h` },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>Completion</span>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color }}>{domainCompletion}%</span>
                  </div>
                  <div style={{ height: 4, background: "#e2e8f0", borderRadius: 3 }}>
                    <div style={{ width: `${domainCompletion}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Manager Workload Ledger Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <SectionHeader title="Manager Workload Ledger" sub={`${managers.length} manager(s) — detailed operational responsibility and allocation`} icon={Briefcase} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#f8fafc", fontSize: "0.73rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {["Manager", "Team", "Active", "Pending", "Completed", "Total", "Hours", "Enrollments", "Load %"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managerWorkload.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                    No manager data available.
                  </td>
                </tr>
              ) : (
                managerWorkload.map(({ manager, total, active, pending, completed, totalHours, totalEnrollments }) => {
                  const load = total > 0 ? Math.round((active / total) * 100) : 0;
                  const loadColor = load >= 75 ? "#ef4444" : load >= 45 ? "#f59e0b" : "#16a34a";
                  return (
                    <tr key={manager.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.83rem" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#0b5cab,#1d6ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 }}>
                            {manager.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{manager.full_name}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{manager.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{manager.team_name || "—"}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 800, color: "#8b5cf6", fontSize: "1rem" }}>{active}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {pending > 0 ? <span style={{ color: "#f59e0b", fontWeight: 700 }}>{pending}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#16a34a", fontWeight: 600 }}>{completed}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700 }}>{total}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{Math.round(totalHours)}h</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{totalEnrollments.toLocaleString()}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <div style={{ height: 6, width: 72, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${load}%`, height: "100%", background: loadColor, borderRadius: 3, transition: "width 0.4s" }} />
                          </div>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: loadColor }}>{load}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Coordinator Workload Ledger Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <SectionHeader title="Coordinator Workload Ledger" sub={`${coordinators.length} coordinator(s) — operational capacity & batch tracking`} icon={Users} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
            <thead>
              <tr style={{ background: "#f8fafc", fontSize: "0.73rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {["Coordinator", "Team", "Active", "In Pipeline", "Completed", "Total", "Hours", "Learners", "Capacity %"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coordinatorWorkload.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                    No coordinator data available.
                  </td>
                </tr>
              ) : (
                coordinatorWorkload.map(({ coordinator, total, active, pending, completed, totalHours, totalEnrollments }) => {
                  const capacity = total > 0 ? Math.round((active / total) * 100) : 0;
                  const capColor = capacity >= 80 ? "#ef4444" : capacity >= 45 ? "#f59e0b" : "#06b6d4";
                  return (
                    <tr key={coordinator.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.83rem" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#06b6d4,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 }}>
                            {coordinator.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{coordinator.full_name}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{coordinator.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{coordinator.team_name || "—"}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 800, color: "#06b6d4", fontSize: "1rem" }}>{active}</td>
                      <td style={{ padding: "12px 16px" }}>
                        {pending > 0 ? <span style={{ color: "#f59e0b", fontWeight: 700 }}>{pending}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#16a34a", fontWeight: 600 }}>{completed}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700 }}>{total}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{Math.round(totalHours)}h</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{totalEnrollments.toLocaleString()}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <div style={{ height: 6, width: 72, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${capacity}%`, height: "100%", background: capColor, borderRadius: 3, transition: "width 0.4s" }} />
                          </div>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: capColor }}>{capacity}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Portfolio + Executive Quality Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
            <SectionHeader title="Client Portfolio" sub="Top clients by batch volume and active deployments" icon={Target} />
          </div>
          <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>
                {["#", "Client", "Batches", "Active", "Enrollments", "Hours"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientStats.map(([client, stats], i) => (
                <tr key={client} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.82rem" }}>
                  <td style={{ padding: "10px 16px", color: "var(--text-dim)", fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: "10px 16px", fontWeight: 700 }}>{client}</td>
                  <td style={{ padding: "10px 16px", fontWeight: 800, color: "#0b5cab" }}>{stats.batches}</td>
                  <td style={{ padding: "10px 16px" }}>
                    {stats.active > 0 ? <span style={{ color: "#16a34a", fontWeight: 700 }}>{stats.active}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>{stats.enrollments.toLocaleString()}</td>
                  <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>{Math.round(stats.hours)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {dashboardSummary && (
            <>
              <div className="glass-panel" style={{ padding: "18px 20px", borderLeft: "4px solid #16a34a" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6 }}>
                  Overall NPS
                </div>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#16a34a" }}>
                  {dashboardSummary.overall_avg_nps !== null ? Number(dashboardSummary.overall_avg_nps).toFixed(1) : "—"}
                  <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-muted)" }}> / 10</span>
                </div>
                <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: 2 }}>Gate 2 Executive Score</div>
              </div>
              <div className="glass-panel" style={{ padding: "18px 20px", borderLeft: "4px solid #f59e0b" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6 }}>
                  Avg Feedback (Gate 1)
                </div>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#f59e0b" }}>
                  {dashboardSummary.overall_avg_feedback !== null ? Number(dashboardSummary.overall_avg_feedback).toFixed(2) : "—"}
                  <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-muted)" }}> / 5.0</span>
                </div>
                <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: 2 }}>Session satisfaction index</div>
              </div>
              <div className="glass-panel" style={{ padding: "18px 20px", borderLeft: "4px solid #8b5cf6" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6 }}>
                  Faculty Utilization
                </div>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#8b5cf6" }}>
                  {Number(dashboardSummary.faculty_utilization_ratio).toFixed(1)}%
                </div>
                <div style={{ height: 6, background: "#ede9fe", borderRadius: 3, marginTop: 8 }}>
                  <div style={{ width: `${Number(dashboardSummary.faculty_utilization_ratio)}%`, height: "100%", background: "#8b5cf6", borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: 4 }}>Trainer deployment efficiency</div>
              </div>
              <div className="glass-panel" style={{ padding: "16px 18px", background: "#fff7ed", border: "1px solid #fed7aa" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#ea580c", marginBottom: 8 }}>
                  ⚠ Gate Alerts
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span>Pending G1 Feedbacks</span>
                    <span style={{ fontWeight: 800, color: "#ea580c" }}>{dashboardSummary.pending_gate1_feedbacks}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span>Pending G2 Closures</span>
                    <span style={{ fontWeight: 800, color: "#ea580c" }}>{dashboardSummary.pending_gate2_closures}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Period Activity Feed */}
      <div className="glass-panel" style={{ padding: "20px 24px" }}>
        <SectionHeader
          title={`${PERIOD_LABELS[period]} — Batch Activity`}
          sub={`${activeBatchesDataset.length} batch(es) in this horizon`}
          icon={Calendar}
        />
        {activeBatchesDataset.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            No batch activity found for {PERIOD_LABELS[period].toLowerCase()}.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="glass-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ background: "#f8fafc", fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>
                  {["Batch ID", "Client", "Program", "Domain", "Mode", "Start Date", "Enrollments", "Hours", "Status"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeBatchesDataset.slice(0, 20).map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.81rem" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#0b5cab", whiteSpace: "nowrap" }}>{b.batch_id}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{b.client_name || "—"}</td>
                    <td style={{ padding: "10px 14px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.program_name}>
                      {b.program_name}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{b.domain || "—"}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{b.delivery_mode}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{b.start_date ? formatDate(b.start_date) : "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>{b.total_enrollments}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>{b.total_hours}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: 12,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          background: `${STATUS_COLORS[b.status] || "#94a3b8"}18`,
                          color: STATUS_COLORS[b.status] || "#94a3b8",
                          border: `1px solid ${STATUS_COLORS[b.status] || "#94a3b8"}40`,
                        }}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeBatchesDataset.length > 20 && (
              <div style={{ textAlign: "center", padding: "12px 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Showing 20 of {activeBatchesDataset.length} batches.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
