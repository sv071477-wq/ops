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
import { PaginationControls } from "./PaginationControls";

interface EnterpriseDashboardProps {
  batches: Batch[];
  users: User[];
  dashboardSummary: ManagerDashboardSummary | null;
  isLoading: boolean;
  currentUser?: User | null;
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
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ElementType;
  trend?: number;
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
    if (!batches || batches.length === 0) return [];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthCounts: Record<string, { label: string; count: number; hours: number; sortKey: string }> = {};

    batches.forEach((b) => {
      const dateStr = b.start_date || b.created_at;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthCounts[sortKey]) {
        monthCounts[sortKey] = {
          label: `${months[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
          count: 0,
          hours: 0,
          sortKey,
        };
      }
      monthCounts[sortKey].count++;
      monthCounts[sortKey].hours += Number(b.total_hours) || 0;
    });

    const sorted = Object.values(monthCounts).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return sorted.slice(-12);
  }, [batches]);

  const maxVal = Math.max(...points.map((p) => p.count), 1);
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

/**
 * SVG Grouped Bar Chart — compare multiple metrics across teams
 */
function SvgGroupedBar({
  groups,
  series,
  height = 180,
}: {
  groups: { label: string; values: number[] }[];
  series: { label: string; color: string }[];
  height?: number;
}) {
  const maxVal = Math.max(...groups.flatMap((g) => g.values), 1);
  const barW = 14;
  const gap = 4;
  const groupGap = 20;
  const paddingL = 36;
  const paddingB = 28;
  const seriesCount = series.length;
  const groupW = seriesCount * (barW + gap) - gap + groupGap;
  const totalW = paddingL + groups.length * groupW + 20;
  const chartH = height - paddingB;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${totalW} ${height}`} style={{ width: "100%", minWidth: Math.min(totalW, 340), height }}>
        {/* Y gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = 8 + (1 - pct) * (chartH - 8);
          const val = Math.round(pct * maxVal);
          return (
            <g key={i}>
              <line x1={paddingL} y1={y} x2={totalW - 10} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth={1} />
              <text x={paddingL - 4} y={y + 4} textAnchor="end" fontSize={8} fill="#94a3b8">{val}</text>
            </g>
          );
        })}
        {/* Bars */}
        {groups.map((group, gi) => {
          const gX = paddingL + gi * groupW;
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const val = group.values[si] || 0;
                const barH = (val / maxVal) * (chartH - 8);
                const x = gX + si * (barW + gap);
                const y = chartH - barH;
                return (
                  <g key={si}>
                    <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} fill={s.color} rx={3} opacity={0.88} />
                    {val > 0 && (
                      <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fontWeight={700} fill={s.color}>{val}</text>
                    )}
                  </g>
                );
              })}
              <text
                x={gX + (seriesCount * (barW + gap) - gap) / 2}
                y={chartH + 12}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill="#64748b"
              >
                {group.label.length > 10 ? group.label.slice(0, 9) + "…" : group.label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontSize: "0.72rem", fontWeight: 700 }}>
        {series.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--text-main)" }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Mini role composition donut for each team
 */
function TeamRoleDonut({ counts, size = 56 }: { counts: Record<string, number>; size?: number }) {
  const roleColors: Record<string, string> = {
    Manager: "#0b5cab",
    Coordinator: "#06b6d4",
    Faculty: "#8b5cf6",
    Sales: "#f59e0b",
    Admin: "#ef4444",
  };
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  let acc = 0;
  const segments = Object.entries(counts).map(([role, count]) => {
    const frac = total > 0 ? count / total : 0;
    const dash = frac * circ;
    const offset = -acc;
    acc += dash;
    return { role, count, color: roleColors[role] || "#94a3b8", dash, offset };
  });
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
      {total > 0 && segments.map((seg, i) =>
        seg.count > 0 ? (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={seg.color} strokeWidth={8}
            strokeDasharray={`${seg.dash} ${circ}`}
            strokeDashoffset={seg.offset}
          />
        ) : null
      )}
    </svg>
  );
}

/**
 * Horizontal ranked bar — city / location heatmap
 */
function RankedBars({
  data,
  color,
  maxItems = 8,
}: {
  data: { label: string; value: number; sub?: string }[];
  color: string;
  maxItems?: number;
}) {
  const slice = data.slice(0, maxItems);
  const maxVal = Math.max(...slice.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {slice.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 20, fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textAlign: "right", flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{item.label}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color, flexShrink: 0 }}>{item.value}{item.sub}</span>
            </div>
            <div style={{ height: 6, background: "#f1f5f9", borderRadius: 4 }}>
              <div style={{ width: `${(item.value / maxVal) * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Quality Scatter — NPS vs Feedback bubble
 */
function QualityBubble({
  data,
}: {
  data: { label: string; nps: number | null; feedback: number | null; batches: number; color: string }[];
}) {
  const w = 380;
  const h = 200;
  const pL = 44, pR = 16, pT = 16, pB = 36;
  const cW = w - pL - pR;
  const cH = h - pT - pB;

  const validData = data.filter((d) => d.nps !== null && d.feedback !== null);
  if (validData.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>
        No NPS / feedback data available yet.
      </div>
    );
  }

  const maxBatches = Math.max(...validData.map((d) => d.batches), 1);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", minWidth: 300, height: h }}>
        {/* Axes */}
        <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e2e8f0" strokeWidth={1} />
        <line x1={pL} y1={pT + cH} x2={pL + cW} y2={pT + cH} stroke="#e2e8f0" strokeWidth={1} />
        {/* X axis labels: Feedback 1–5 */}
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={pL + ((v - 1) / 4) * cW} y1={pT} x2={pL + ((v - 1) / 4) * cW} y2={pT + cH} stroke="#f1f5f9" strokeWidth={1} />
            <text x={pL + ((v - 1) / 4) * cW} y={pT + cH + 14} textAnchor="middle" fontSize={9} fill="#94a3b8">{v}</text>
          </g>
        ))}
        <text x={pL + cW / 2} y={h - 2} textAnchor="middle" fontSize={9} fill="#64748b">Average Batch Feedback</text>
        {/* Y axis labels: NPS -100 to 100 */}
        {[-100, -50, 0, 50, 100].map((v) => {
          const y = pT + cH - ((v + 100) / 200) * cH;
          return (
            <g key={v}>
              <line x1={pL} y1={y} x2={pL + cW} y2={y} stroke="#f1f5f9" strokeWidth={1} />
              <text x={pL - 4} y={y + 4} textAnchor="end" fontSize={8} fill="#94a3b8">{v}</text>
            </g>
          );
        })}
        {/* Zero NPS line */}
        <line x1={pL} y1={pT + cH / 2} x2={pL + cW} y2={pT + cH / 2} stroke="#e2e8f0" strokeDasharray="4 3" strokeWidth={1} />
        {/* Bubbles */}
        {validData.map((d, i) => {
          const cx = pL + ((d.feedback! - 1) / 4) * cW;
          const cy = pT + cH - ((d.nps! + 100) / 200) * cH;
          const r = 6 + (d.batches / maxBatches) * 14;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} fill={d.color} opacity={0.75} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
                {d.label.length > 5 ? d.label.slice(0, 5) + "…" : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function EnterpriseDashboard({ batches, users, dashboardSummary, isLoading, currentUser }: EnterpriseDashboardProps) {
  const [period, setPeriod] = useState<TimePeriod>("monthly");
  const [workloadTab, setWorkloadTab] = useState<"managers" | "coordinators">("managers");
  const [teamAnalyticsTab, setTeamAnalyticsTab] = useState<"comparison" | "composition" | "quality">("comparison");

  // Pagination states
  const [mgrPage, setMgrPage] = useState(1);
  const [mgrPageSize, setMgrPageSize] = useState(5);

  const [coordPage, setCoordPage] = useState(1);
  const [coordPageSize, setCoordPageSize] = useState(10);

  const [chartPage, setChartPage] = useState(1);
  const chartPageSize = 6;

  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);

  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(10);

  const currentRole = (currentUser?.role || "").toLowerCase();
  const isOrgAdmin = currentRole === "admin";

  const coordinatorIdsByManager = useMemo(() => {
    const map = new Map<string, Set<string>>();
    users.filter((u) => u.role === "Manager").forEach((m) => map.set(m.id, new Set()));

    users.forEach((u) => {
      if (u.role !== "Coordinator") return;
      const managerId =
        u.manager_id ||
        users.find((m) => m.role === "Manager" && m.full_name === u.manager_name)?.id ||
        null;
      if (!managerId) return;
      if (!map.has(managerId)) map.set(managerId, new Set());
      map.get(managerId)?.add(u.id);
    });

    return map;
  }, [users]);

  // Find all direct & indirect subordinates strictly BELOW currentUser
  // User Rules:
  // 1. "himself should not be considered" -> currentUser is NEVER in subordinates
  // 2. "and top mangers should not be include" -> any superiors/ancestors are excluded
  // 3. "only below him" -> only descendants in the reporting tree
  const subordinateUserIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    if (isOrgAdmin) {
      // For Admin, all organization staff members except Admin himself
      return new Set(users.filter((u) => u.id !== currentUser.id).map((u) => u.id));
    }

    const subordinates = new Set<string>();
    const queue: string[] = [currentUser.id];
    const visited = new Set<string>([currentUser.id]);

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      users.forEach((u) => {
        if (visited.has(u.id)) return;
        const matchesManagerId = u.manager_id === parentId;
        const parentUser = users.find((p) => p.id === parentId);
        const matchesManagerName =
          parentUser && u.manager_name && u.manager_name.toLowerCase() === parentUser.full_name.toLowerCase();

        if (matchesManagerId || matchesManagerName) {
          visited.add(u.id);
          subordinates.add(u.id);
          queue.push(u.id);
        }
      });

      const mappedCoordinators = coordinatorIdsByManager.get(parentId);
      if (mappedCoordinators) {
        mappedCoordinators.forEach((coordId) => {
          if (!visited.has(coordId)) {
            visited.add(coordId);
            subordinates.add(coordId);
            queue.push(coordId);
          }
        });
      }
    }

    return subordinates;
  }, [currentUser, isOrgAdmin, users, coordinatorIdsByManager]);

  // Subordinate managers strictly below currentUser
  const managers = useMemo(() => {
    return users.filter(
      (u) =>
        u.role === "Manager" &&
        u.id !== currentUser?.id && // himself should not be considered
        subordinateUserIds.has(u.id) // only below him, top managers excluded
    );
  }, [users, currentUser, subordinateUserIds]);

  // Subordinate coordinators strictly below currentUser
  const coordinators = useMemo(() => {
    return users.filter(
      (u) =>
        u.role === "Coordinator" &&
        u.id !== currentUser?.id &&
        subordinateUserIds.has(u.id)
    );
  }, [users, currentUser, subordinateUserIds]);

  // Batches scoped to current user and their subordinates
  const scopedBatches = useMemo(() => {
    if (isOrgAdmin) return batches;
    if (!currentUser) return batches;

    return batches.filter((b) => {
      // Direct ownership by current user
      if (b.primary_manager_id === currentUser.id) return true;
      // Ownership by subordinate manager
      if (b.primary_manager_id && subordinateUserIds.has(b.primary_manager_id)) return true;
      // Coordinated by subordinate coordinator
      if (b.coordinator_id && subordinateUserIds.has(b.coordinator_id)) return true;
      return false;
    });
  }, [batches, isOrgAdmin, currentUser, subordinateUserIds]);

  // Automatically switch tab if no subordinate managers exist
  React.useEffect(() => {
    if (managers.length === 0 && coordinators.length > 0) {
      setWorkloadTab("coordinators");
    } else if (managers.length > 0) {
      setWorkloadTab("managers");
    }
  }, [managers.length, coordinators.length]);

  // Reset pagination pages on period filter change
  React.useEffect(() => {
    setActivityPage(1);
    setChartPage(1);
    setMgrPage(1);
    setCoordPage(1);
    setClientPage(1);
  }, [period]);

  // Precompute live counts for every horizon tab so counts are visible on the buttons
  const periodCounts = useMemo(() => {
    return {
      daily: scopedBatches.filter((b) => isBatchInPeriod(b, "daily")).length,
      weekly: scopedBatches.filter((b) => isBatchInPeriod(b, "weekly")).length,
      monthly: scopedBatches.filter((b) => isBatchInPeriod(b, "monthly")).length,
      quarterly: scopedBatches.filter((b) => isBatchInPeriod(b, "quarterly")).length,
      all: scopedBatches.length,
    };
  }, [scopedBatches]);

  // Active dataset for dashboard and team analytics directly driven by selected period
  const activeBatchesDataset = useMemo(
    () => (period === "all" ? scopedBatches : scopedBatches.filter((b) => isBatchInPeriod(b, period))),
    [scopedBatches, period]
  );

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
            if (b.primary_manager_id === m.id) return true;
            if (!b.primary_manager_id && b.coordinator_id && relatedCoordinatorIds.has(b.coordinator_id)) return true;
            return false;
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
        .sort((a, b) => b.active - a.active || b.total - a.total),
    [managers, activeBatchesDataset, coordinatorIdsByManager]
  );

  const paginatedManagerWorkload = useMemo(() => {
    const start = (mgrPage - 1) * mgrPageSize;
    return managerWorkload.slice(start, start + mgrPageSize);
  }, [managerWorkload, mgrPage, mgrPageSize]);

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

  const paginatedCoordinatorWorkload = useMemo(() => {
    const start = (coordPage - 1) * coordPageSize;
    return coordinatorWorkload.slice(start, start + coordPageSize);
  }, [coordinatorWorkload, coordPage, coordPageSize]);

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
    return Object.entries(map).sort((a, b) => b[1].batches - a[1].batches);
  }, [activeBatchesDataset]);

  const paginatedClientStats = useMemo(() => {
    const start = (clientPage - 1) * clientPageSize;
    return clientStats.slice(start, start + clientPageSize);
  }, [clientStats, clientPage, clientPageSize]);

  const paginatedActivityBatches = useMemo(() => {
    const start = (activityPage - 1) * activityPageSize;
    return activeBatchesDataset.slice(start, start + activityPageSize);
  }, [activeBatchesDataset, activityPage, activityPageSize]);

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

  // ── TEAM ANALYTICS DERIVATIONS ──────────────────────────────────────────────

  // Distinct teams from users array
  const teamMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; department: string }>();
    users.forEach((u) => {
      if (u.team_id && u.team_name) {
        map.set(u.team_id, { id: u.team_id, name: u.team_name, department: u.department || "Ops" });
      }
    });
    return map;
  }, [users]);

  // Only include teams that belong to the current manager's own team (e.g. Delivery, not Finance).
  // Finance managers may appear as subordinates of this user, but their team is excluded here.
  // Admins see all teams.
  const teamList = useMemo(() => {
    const all = Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (isOrgAdmin) return all;

    // Derive the manager's own team_id: prefer currentUser.team_id, fallback to looking up
    // the full user record from the users array (which is loaded from the admin API).
    const meInUsers = users.find((u) => u.id === currentUser?.id);
    const myTeamId = currentUser?.team_id ?? meInUsers?.team_id ?? null;

    return all.filter((t) => {
      // EXPLICIT REQUIREMENT: Do not include the Finance team in these analyses
      if (t.name.toLowerCase().includes("finance")) return false;

      // If we know the manager's team, only show that team
      if (myTeamId && t.id !== myTeamId) return false;
      // Must have at least one subordinate (or self) member in this team
      return users.some(
        (u) =>
          u.team_id === t.id &&
          (subordinateUserIds.has(u.id) || u.id === currentUser?.id)
      );
    });
  }, [teamMap, isOrgAdmin, users, subordinateUserIds, currentUser]);


  // Per-team member role composition — scoped to subordinate members only (not the full team roster)
  const teamRoleComposition = useMemo(() => {
    const result = new Map<string, Record<string, number>>();
    teamList.forEach((t) => result.set(t.id, {}));
    users.forEach((u) => {
      if (!u.team_id || !result.has(u.team_id)) return;
      // Non-admin: only count users in the manager's direct-report hierarchy
      if (!isOrgAdmin && !subordinateUserIds.has(u.id) && u.id !== currentUser?.id) return;
      const rec = result.get(u.team_id)!;
      rec[u.role] = (rec[u.role] || 0) + 1;
    });
    return result;
  }, [teamList, users, isOrgAdmin, subordinateUserIds, currentUser]);

  // Per-team batch stats (linked via primary_manager or coordinator who belongs to that team)
  const teamBatchStats = useMemo(() => {
    const userTeamMap = new Map<string, string>(); // userId -> teamId
    users.forEach((u) => { if (u.team_id) userTeamMap.set(u.id, u.team_id); });

    const stats = new Map<string, {
      active: number; completed: number; pipeline: number; total: number;
      hours: number; enrollments: number;
      npsValues: number[]; feedbackValues: number[];
    }>();
    teamList.forEach((t) => stats.set(t.id, { active: 0, completed: 0, pipeline: 0, total: 0, hours: 0, enrollments: 0, npsValues: [], feedbackValues: [] }));

    activeBatchesDataset.forEach((b) => {
      // Attribute batch to team of primary_manager or coordinator
      const ownerTeam =
        (b.primary_manager_id && userTeamMap.get(b.primary_manager_id)) ||
        (b.coordinator_id && userTeamMap.get(b.coordinator_id)) ||
        null;
      if (!ownerTeam || !stats.has(ownerTeam)) return;
      const s = stats.get(ownerTeam)!;
      s.total++;
      s.hours += Number(b.total_hours) || 0;
      s.enrollments += Number(b.total_enrollments) || 0;
      if (["Approved", "Upcoming", "Ongoing"].includes(b.status)) s.active++;
      else if (b.status === "Completed") s.completed++;
      else s.pipeline++;
      if (b.batch_nps !== null && b.batch_nps !== undefined) s.npsValues.push(Number(b.batch_nps));
      if (b.batch_avg_feedback !== null && b.batch_avg_feedback !== undefined) s.feedbackValues.push(Number(b.batch_avg_feedback));
    });
    return stats;
  }, [teamList, activeBatchesDataset, users]);

  // Team KPI cards data
  const teamKpiData = useMemo(() =>
    teamList.map((t) => {
      const s = teamBatchStats.get(t.id)!;
      const composition = teamRoleComposition.get(t.id) || {};
      const memberCount = Object.values(composition).reduce((a, b) => a + b, 0);
      const avgNps = s.npsValues.length > 0 ? s.npsValues.reduce((a, b) => a + b, 0) / s.npsValues.length : null;
      const avgFeedback = s.feedbackValues.length > 0 ? s.feedbackValues.reduce((a, b) => a + b, 0) / s.feedbackValues.length : null;
      return { team: t, memberCount, ...s, avgNps, avgFeedback };
    }).filter((t) => t.memberCount > 0 || t.total > 0)
  , [teamList, teamBatchStats, teamRoleComposition]);

  // City / location stats
  const cityStats = useMemo(() => {
    const map: Record<string, { batches: number; hours: number; enrollments: number }> = {};
    activeBatchesDataset.forEach((b) => {
      const city = b.location_city || "Remote / Online";
      if (!map[city]) map[city] = { batches: 0, hours: 0, enrollments: 0 };
      map[city].batches++;
      map[city].hours += Number(b.total_hours) || 0;
      map[city].enrollments += Number(b.total_enrollments) || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].batches - a[1].batches);
  }, [activeBatchesDataset]);

  // Client quality bubble data (NPS vs Feedback)
  const clientQualityData = useMemo(() => {
    const BUBBLE_COLORS = ["#0b5cab", "#8b5cf6", "#06b6d4", "#f59e0b", "#16a34a", "#ef4444", "#f97316", "#ec4899"];
    const map: Record<string, { npsSum: number; npsCount: number; fbSum: number; fbCount: number; batches: number }> = {};
    activeBatchesDataset.forEach((b) => {
      const key = b.client_name || "Unassigned";
      if (!map[key]) map[key] = { npsSum: 0, npsCount: 0, fbSum: 0, fbCount: 0, batches: 0 };
      map[key].batches++;
      if (b.batch_nps !== null && b.batch_nps !== undefined) { map[key].npsSum += Number(b.batch_nps); map[key].npsCount++; }
      if (b.batch_avg_feedback !== null && b.batch_avg_feedback !== undefined) { map[key].fbSum += Number(b.batch_avg_feedback); map[key].fbCount++; }
    });
    return Object.entries(map)
      .filter(([, v]) => v.npsCount > 0 || v.fbCount > 0)
      .sort((a, b) => b[1].batches - a[1].batches)
      .slice(0, 12)
      .map(([label, v], i) => ({
        label,
        nps: v.npsCount > 0 ? v.npsSum / v.npsCount : null,
        feedback: v.fbCount > 0 ? v.fbSum / v.fbCount : null,
        batches: v.batches,
        color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
      }));
  }, [activeBatchesDataset]);

  // Technology breakdown
  const techStats = useMemo(() => {
    const map: Record<string, { batches: number; hours: number; active: number }> = {};
    activeBatchesDataset.forEach((b) => {
      const tech = b.technology || "General";
      if (!map[tech]) map[tech] = { batches: 0, hours: 0, active: 0 };
      map[tech].batches++;
      map[tech].hours += Number(b.total_hours) || 0;
      if (["Approved", "Upcoming", "Ongoing"].includes(b.status)) map[tech].active++;
    });
    return Object.entries(map).sort((a, b) => b[1].batches - a[1].batches);
  }, [activeBatchesDataset]);

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
              {isOrgAdmin ? "Executive View (All Teams)" : `Team Scope: ${currentUser?.full_name || "Manager View"}`}
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            {isOrgAdmin
              ? "Organization-wide visual workload distribution, operational throughput, and capacity analytics."
              : `Visual workload analytics strictly scoped to reporting personnel below ${currentUser?.full_name || "your management line"}.`}
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
        <KpiCard label="Total Batches" value={totalBatches} sub="Under governance" color="#0b5cab" icon={Briefcase} />
        <KpiCard label="Active Batches" value={activeBatchesCount} sub={`${activeRate}% of portfolio`} color="#8b5cf6" icon={Activity} />
        <KpiCard label="Total Enrollments" value={totalEnrollments.toLocaleString()} sub="Learners deployed" color="#06b6d4" icon={Users} />
        <KpiCard label="Scheduled Hours" value={`${Math.round(totalHours).toLocaleString()}h`} sub="Curriculum delivery" color="#f59e0b" icon={Clock} />
        <KpiCard label="Completed" value={completedBatches} sub={`${completionRate}% completion rate`} color="#16a34a" icon={CheckCircle2} />
        <KpiCard label="Pending Approvals" value={pendingApprovals} sub="Awaiting signoff" color="#f97316" icon={AlertTriangle} />
        <KpiCard label="On Hold" value={onHoldBatches} sub="Action required" color="#d97706" icon={Shield} />
        <KpiCard label="Cancellations" value={cancelledBatches} sub={`${cancellationRate}% cancellation rate`} color="#ef4444" icon={TrendingDown} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TEAM ANALYTICS — 5 rich visualizations derived from the DB schema  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* Team KPI Cards — one per team */}
      {teamKpiData.length > 0 && (
        <div className="glass-panel" style={{ padding: "22px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <SectionHeader
              title="Team Performance Overview"
              sub="Per-team batch delivery KPIs, member breakdown and quality scores"
              icon={Users}
            />
            <span style={{ fontSize: "0.72rem", fontWeight: 700, background: "#f1f5f9", color: "var(--text-dim)", padding: "3px 9px", borderRadius: 12 }}>
              {teamKpiData.length} Teams
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {teamKpiData.map((t, ci) => {
              const CARD_COLORS = ["#0b5cab", "#8b5cf6", "#06b6d4", "#16a34a", "#f59e0b", "#f97316", "#ec4899", "#ef4444"];
              const color = CARD_COLORS[ci % CARD_COLORS.length];
              const composition = teamRoleComposition.get(t.team.id) || {};
              const totalMembers = t.memberCount;
              return (
                <div
                  key={t.team.id}
                  style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: "16px 18px",
                    background: `${color}05`,
                    borderLeft: `4px solid ${color}`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Team header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.92rem", color, lineHeight: 1.2 }}>{t.team.name}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>{t.team.department}</div>
                    </div>
                    <TeamRoleDonut counts={composition} size={48} />
                  </div>

                  {/* 4-grid KPI */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {[
                      { label: "Members", val: totalMembers, col: color },
                      { label: "Active Batches", val: t.active, col: "#8b5cf6" },
                      { label: "Completed", val: t.completed, col: "#16a34a" },
                      { label: "Hours", val: `${Math.round(t.hours)}h`, col: "#f59e0b" },
                    ].map(({ label, val, col }) => (
                      <div key={label}>
                        <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: col }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Role pills */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                    {Object.entries(composition).map(([role, count]) => {
                      const roleColors: Record<string, string> = {
                        Manager: "#0b5cab", Coordinator: "#06b6d4",
                        Faculty: "#8b5cf6", Sales: "#f59e0b", Admin: "#ef4444",
                      };
                      const rc = roleColors[role] || "#94a3b8";
                      return (
                        <span key={role} style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: `${rc}15`, color: rc, border: `1px solid ${rc}30` }}>
                          {role}: {count}
                        </span>
                      );
                    })}
                  </div>

                  {/* NPS & Feedback */}
                  <div style={{ display: "flex", gap: 14, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                    <div>
                      <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>Avg NPS</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: t.avgNps !== null ? (t.avgNps >= 50 ? "#16a34a" : t.avgNps >= 0 ? "#f59e0b" : "#ef4444") : "#94a3b8" }}>
                        {t.avgNps !== null ? t.avgNps.toFixed(1) : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>Avg Feedback</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: t.avgFeedback !== null ? (t.avgFeedback >= 4 ? "#16a34a" : t.avgFeedback >= 3 ? "#f59e0b" : "#ef4444") : "#94a3b8" }}>
                        {t.avgFeedback !== null ? t.avgFeedback.toFixed(2) : "—"}
                        {t.avgFeedback !== null && <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500 }}> / 5</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.62rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>Enrollments</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#06b6d4" }}>{t.enrollments.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Comparison Charts — 3-tab panel */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <SectionHeader
            title="Team Analytics Deep-Dive"
            sub="Detailed cross-team performance, composition, and quality analysis"
            icon={BarChart3}
          />
          <div style={{ display: "flex", gap: 4, background: "#f8fafc", padding: "4px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
            {(["comparison", "composition", "quality"] as const).map((tab) => {
              const labels = { comparison: "📊 Delivery Comparison", composition: "🧩 Role Composition", quality: "⭐ Quality Matrix" };
              return (
                <button
                  key={tab}
                  onClick={() => setTeamAnalyticsTab(tab)}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.77rem",
                    fontWeight: 700,
                    background: teamAnalyticsTab === tab ? "linear-gradient(135deg,#0b5cab,#1d6ed8)" : "transparent",
                    color: teamAnalyticsTab === tab ? "#fff" : "var(--text-dim)",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab: Delivery Comparison */}
        {teamAnalyticsTab === "comparison" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Left: Grouped bar chart per team */}
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 14 }}>Batch Delivery Status by Team</div>
              {teamKpiData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: "0.82rem" }}>No team data available.</div>
              ) : (
                <SvgGroupedBar
                  groups={teamKpiData.map((t) => ({
                    label: t.team.name,
                    values: [t.active, t.completed, t.pipeline],
                  }))}
                  series={[
                    { label: "Active", color: "#8b5cf6" },
                    { label: "Completed", color: "#16a34a" },
                    { label: "Pipeline", color: "#f59e0b" },
                  ]}
                  height={200}
                />
              )}
            </div>

            {/* Right: Hours delivered per team */}
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 14 }}>Training Hours Delivered per Team</div>
              {teamKpiData.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: "0.82rem" }}>No team data available.</div>
              ) : (
                <RankedBars
                  data={teamKpiData
                    .sort((a, b) => b.hours - a.hours)
                    .map((t) => ({ label: t.team.name, value: Math.round(t.hours), sub: "h" }))}
                  color="#0b5cab"
                  maxItems={8}
                />
              )}
            </div>
          </div>
        )}

        {/* Tab: Role Composition */}
        {teamAnalyticsTab === "composition" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
              {teamKpiData.map((t, ci) => {
                const CARD_COLORS = ["#0b5cab", "#8b5cf6", "#06b6d4", "#16a34a", "#f59e0b", "#f97316"];
                const color = CARD_COLORS[ci % CARD_COLORS.length];
                const composition = teamRoleComposition.get(t.team.id) || {};
                const total = Object.values(composition).reduce((a, b) => a + b, 0);
                const roleColors: Record<string, string> = { Manager: "#0b5cab", Coordinator: "#06b6d4", Faculty: "#8b5cf6", Sales: "#f59e0b", Admin: "#ef4444" };
                return (
                  <div key={t.team.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "14px 16px", background: `${color}05`, borderTop: `3px solid ${color}` }}>
                    <div style={{ fontWeight: 800, fontSize: "0.88rem", color, marginBottom: 4 }}>{t.team.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 12 }}>{total} members · {t.team.department}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <TeamRoleDonut counts={composition} size={64} />
                      <div style={{ flex: 1 }}>
                        {Object.entries(composition).map(([role, count]) => {
                          const rc = roleColors[role] || "#94a3b8";
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <div key={role} style={{ marginBottom: 5 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: rc }}>{role}</span>
                                <span style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>{count} ({pct}%)</span>
                              </div>
                              <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2 }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: rc, borderRadius: 2 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Technology breakdown */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 18 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 14 }}>
                <Layers size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Technology Stack Distribution
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {techStats.slice(0, 10).map(([tech, s], i) => {
                  const TECH_COLORS = ["#0b5cab", "#8b5cf6", "#06b6d4", "#f59e0b", "#16a34a", "#f97316", "#ec4899", "#ef4444", "#64748b", "#a855f7"];
                  const c = TECH_COLORS[i % TECH_COLORS.length];
                  const activePct = s.batches > 0 ? Math.round((s.active / s.batches) * 100) : 0;
                  return (
                    <div key={tech} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: `${c}06` }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${c}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: c }}>{s.batches}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tech}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{Math.round(s.hours)}h · {activePct}% active</div>
                        <div style={{ height: 3, background: "#e2e8f0", borderRadius: 2, marginTop: 3 }}>
                          <div style={{ width: `${activePct}%`, height: "100%", background: c, borderRadius: 2 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Quality Matrix */}
        {teamAnalyticsTab === "quality" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* NPS vs Feedback bubble chart */}
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>Client NPS vs Avg Feedback (bubble = batch volume)</div>
              <QualityBubble data={clientQualityData} />
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
                {clientQualityData.map((d) => (
                  <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    <span>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* City heatmap + team NPS ranked */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>
                  <MapPin size={13} style={{ marginRight: 5, verticalAlign: "middle" }} />
                  Top Delivery Locations
                </div>
                <RankedBars
                  data={cityStats.map(([city, s]) => ({ label: city, value: s.batches }))}
                  color="#06b6d4"
                  maxItems={6}
                />
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 14 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>
                  <Award size={13} style={{ marginRight: 5, verticalAlign: "middle" }} />
                  Team NPS League
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {teamKpiData
                    .filter((t) => t.avgNps !== null)
                    .sort((a, b) => (b.avgNps || 0) - (a.avgNps || 0))
                    .map((t, rank) => {
                      const nps = t.avgNps!;
                      const npsColor = nps >= 50 ? "#16a34a" : nps >= 0 ? "#f59e0b" : "#ef4444";
                      const pct = Math.max(0, Math.min(100, ((nps + 100) / 200) * 100));
                      return (
                        <div key={t.team.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: rank < 3 ? npsColor : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, color: rank < 3 ? "#fff" : "var(--text-dim)", flexShrink: 0 }}>
                            {rank + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)" }}>{t.team.name}</span>
                              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: npsColor }}>{nps.toFixed(1)}</span>
                            </div>
                            <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3 }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: npsColor, borderRadius: 3 }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {teamKpiData.filter((t) => t.avgNps !== null).length === 0 && (
                    <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>No NPS data yet.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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
            <div style={{ textAlign: "center", padding: "36px 20px", color: "var(--text-muted)", background: "#f8fafc", borderRadius: 10, border: "1px dashed var(--border-subtle)" }}>
              <Briefcase size={36} color="#94a3b8" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 4 }}>
                No Subordinate Managers
              </div>
              <div style={{ fontSize: "0.83rem", color: "var(--text-muted)", maxWidth: 440, margin: "0 auto 16px" }}>
                There are no managerial personnel reporting below your management line. You are directly managing {coordinators.length} coordinator(s).
              </div>
              {coordinators.length > 0 && (
                <button
                  onClick={() => setWorkloadTab("coordinators")}
                  className="btn btn-primary"
                  style={{ padding: "6px 16px", fontSize: "0.8rem" }}
                >
                  View Coordinators ({coordinators.length})
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {paginatedManagerWorkload.map((w) => {
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
              {managerWorkload.length > mgrPageSize && (
                <PaginationControls
                  currentPage={mgrPage}
                  totalItems={managerWorkload.length}
                  pageSize={mgrPageSize}
                  onPageChange={setMgrPage}
                  onPageSizeChange={setMgrPageSize}
                  pageSizeOptions={[3, 5, 10]}
                  color="#0b5cab"
                />
              )}
            </div>
          )
        ) : coordinatorWorkload.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>No coordinator workload data available in your scope.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {paginatedCoordinatorWorkload.map((w) => {
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
            {coordinatorWorkload.length > coordPageSize && (
              <PaginationControls
                currentPage={coordPage}
                totalItems={coordinatorWorkload.length}
                pageSize={coordPageSize}
                onPageChange={setCoordPage}
                onPageSizeChange={setCoordPageSize}
                pageSizeOptions={[5, 10, 20]}
                color="#06b6d4"
              />
            )}
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
                    No subordinate managers reporting under your direct line.
                  </td>
                </tr>
              ) : (
                paginatedManagerWorkload.map(({ manager, total, active, pending, completed, totalHours, totalEnrollments }) => {
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
        {managerWorkload.length > 0 && (
          <PaginationControls
            currentPage={mgrPage}
            totalItems={managerWorkload.length}
            pageSize={mgrPageSize}
            onPageChange={setMgrPage}
            onPageSizeChange={setMgrPageSize}
            pageSizeOptions={[5, 10, 20]}
            color="#0b5cab"
          />
        )}
      </div>

      {/* Detailed Coordinator Workload Ledger Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <SectionHeader title="Coordinator Workload Ledger" sub={`${coordinators.length} coordinator(s) in scope — operational capacity & batch tracking`} icon={Users} />
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
                    No coordinator data available in your scope.
                  </td>
                </tr>
              ) : (
                paginatedCoordinatorWorkload.map(({ coordinator, total, active, pending, completed, totalHours, totalEnrollments }) => {
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
        {coordinatorWorkload.length > 0 && (
          <PaginationControls
            currentPage={coordPage}
            totalItems={coordinatorWorkload.length}
            pageSize={coordPageSize}
            onPageChange={setCoordPage}
            onPageSizeChange={setCoordPageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            color="#06b6d4"
          />
        )}
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
              {clientStats.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
                    No client data available in this horizon.
                  </td>
                </tr>
              ) : (
                paginatedClientStats.map(([client, stats], i) => (
                  <tr key={client} style={{ borderBottom: "1px solid var(--border-subtle)", fontSize: "0.82rem" }}>
                    <td style={{ padding: "10px 16px", color: "var(--text-dim)", fontWeight: 700 }}>{(clientPage - 1) * clientPageSize + i + 1}</td>
                    <td style={{ padding: "10px 16px", fontWeight: 700 }}>{client}</td>
                    <td style={{ padding: "10px 16px", fontWeight: 800, color: "#0b5cab" }}>{stats.batches}</td>
                    <td style={{ padding: "10px 16px" }}>
                      {stats.active > 0 ? <span style={{ color: "#16a34a", fontWeight: 700 }}>{stats.active}</span> : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>{stats.enrollments.toLocaleString()}</td>
                    <td style={{ padding: "10px 16px", color: "var(--text-muted)" }}>{Math.round(stats.hours)}h</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {clientStats.length > clientPageSize && (
            <PaginationControls
              currentPage={clientPage}
              totalItems={clientStats.length}
              pageSize={clientPageSize}
              onPageChange={setClientPage}
              onPageSizeChange={setClientPageSize}
              pageSizeOptions={[5, 10, 20]}
              color="#0b5cab"
            />
          )}
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
                <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: 2 }}>NPS Closure Executive Score</div>
              </div>
              <div className="glass-panel" style={{ padding: "18px 20px", borderLeft: "4px solid #f59e0b" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6 }}>
                  Average Batch Feedback
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
                {paginatedActivityBatches.map((b) => (
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
            {activeBatchesDataset.length > 0 && (
              <PaginationControls
                currentPage={activityPage}
                totalItems={activeBatchesDataset.length}
                pageSize={activityPageSize}
                onPageChange={setActivityPage}
                onPageSizeChange={setActivityPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                color="#0b5cab"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
