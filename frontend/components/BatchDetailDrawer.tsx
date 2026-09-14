"use client";

import React, { useState, useEffect } from "react";
import {
  Batch, TrainingSession, ExtractedScheduleRow, ConflictDetail,
  api
} from "@/lib/api";
import {
  X, Calendar, Users, MapPin, Monitor, Clock, FileText, CheckCircle2,
  Lock, Star, Building2, User, Plus, Upload, AlertCircle, AlertTriangle,
  PlayCircle, RefreshCw, FileSpreadsheet, ShieldAlert, Sparkles, Check
} from "lucide-react";

interface BatchDetailDrawerProps {
  batch: Batch | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenApprove?: (batch: Batch) => void;
  canApprove?: boolean;
  onBatchUpdated?: () => void;
}

export const BatchDetailDrawer: React.FC<BatchDetailDrawerProps> = ({
  batch,
  isOpen,
  onClose,
  onOpenApprove,
  canApprove = false,
  onBatchUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "quality_gates">("overview");

  // Sessions state
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Add Session Modal
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionStartTime, setSessionStartTime] = useState("09:00");
  const [sessionEndTime, setSessionEndTime] = useState("17:00");
  const [sessionHours, setSessionHours] = useState(8);
  const [sessionFacultyName, setSessionFacultyName] = useState("");
  const [sessionVenue, setSessionVenue] = useState("");
  const [sessionMode, setSessionMode] = useState("Online");
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Gate 1 Feedback Modal
  const [completingSession, setCompletingSession] = useState<TrainingSession | null>(null);
  const [gate1Rating, setGate1Rating] = useState<number>(4.5);
  const [gate1Feedback, setGate1Feedback] = useState("");
  const [gate1StudentsPresent, setGate1StudentsPresent] = useState<number>(30);
  const [isSubmittingGate1, setIsSubmittingGate1] = useState(false);
  const [gate1Error, setGate1Error] = useState<string | null>(null);

  // Gate 2 Closure Modal
  const [isGate2ModalOpen, setIsGate2ModalOpen] = useState(false);
  const [gate2Nps, setGate2Nps] = useState<number>(9);
  const [gate2AvgFeedback, setGate2AvgFeedback] = useState<number>(4.8);
  const [gate2RetroNotes, setGate2RetroNotes] = useState("");
  const [isSubmittingGate2, setIsSubmittingGate2] = useState(false);
  const [gate2Error, setGate2Error] = useState<string | null>(null);

  // Timetable Ingestion Modal
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [extractedRows, setExtractedRows] = useState<ExtractedScheduleRow[]>([]);
  const [validationConflicts, setValidationConflicts] = useState<ConflictDetail[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [isApplyingSchedule, setIsApplyingSchedule] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  // Load sessions when drawer opens or tab switches
  const loadSessions = async () => {
    if (!batch) return;
    setIsLoadingSessions(true);
    try {
      const data = await api.getSessions({ batch_id: batch.id });
      setSessions(data);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isOpen && batch) {
      loadSessions();
    }
  }, [isOpen, batch]);

  if (!isOpen || !batch) return null;

  const formatDate = (dStr?: string | null) => {
    if (!dStr) return "Not set";
    return new Date(dStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "requested") return <span className="badge badge-requested">Requested</span>;
    if (s === "approved") return <span className="badge badge-approved">Approved</span>;
    if (s === "ongoing") return <span className="badge badge-ongoing">Ongoing</span>;
    if (s === "completed") return <span className="badge badge-completed">Completed</span>;
    return <span className="badge badge-cancelled">{status}</span>;
  };

  // Handle Add Single Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);
    setIsSubmittingSession(true);

    try {
      await api.createSession({
        batch_id: batch.id,
        date_of_training: sessionDate,
        start_time: sessionStartTime,
        end_time: sessionEndTime,
        topic: sessionTopic.trim(),
        faculty_name: sessionFacultyName.trim() || undefined,
        no_of_hours: Number(sessionHours),
        venue: sessionVenue.trim() || undefined,
        mode_of_delivery: sessionMode,
      });

      setIsAddSessionOpen(false);
      setSessionTopic("");
      setSessionDate("");
      await loadSessions();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err: any) {
      setSessionError(err.message || "Failed to schedule session");
    } finally {
      setIsSubmittingSession(false);
    }
  };

  // Handle Gate 1 Submission
  const handleCompleteGate1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingSession) return;
    setGate1Error(null);
    setIsSubmittingGate1(true);

    try {
      await api.completeSessionGate1(completingSession.id, {
        rating: Number(gate1Rating),
        topic_feedback: gate1Feedback.trim() || undefined,
        total_students_present: Number(gate1StudentsPresent),
      });

      setCompletingSession(null);
      setGate1Feedback("");
      await loadSessions();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err: any) {
      setGate1Error(err.message || "Failed to submit Gate 1 feedback");
    } finally {
      setIsSubmittingGate1(false);
    }
  };

  // Handle Gate 2 Batch Closure
  const handleCloseBatchGate2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setGate2Error(null);
    setIsSubmittingGate2(true);

    try {
      await api.closeBatchGate2(batch.id, {
        nps_score: Number(gate2Nps),
        average_feedback_score: Number(gate2AvgFeedback),
        retrospective_notes: gate2RetroNotes.trim() || undefined,
      });

      setIsGate2ModalOpen(false);
      if (onBatchUpdated) onBatchUpdated();
      onClose();
    } catch (err: any) {
      setGate2Error(err.message || "Failed to close batch via Gate 2");
    } finally {
      setIsSubmittingGate2(false);
    }
  };

  // Handle Ingest File Upload
  const handleIngestFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestFile) return;
    setIngestError(null);
    setIsIngesting(true);
    setHasValidated(false);
    setValidationConflicts([]);

    try {
      const res = await api.ingestScheduleFile(ingestFile, batch.batch_id);
      setExtractedRows(res.extracted_schedule || []);
    } catch (err: any) {
      setIngestError(err.message || "Failed to parse timetable file");
    } finally {
      setIsIngesting(false);
    }
  };

  // Handle Validate Extracted Schedule (Conflict Engine)
  const handleValidateSchedule = async () => {
    if (extractedRows.length === 0) return;
    setIsValidating(true);
    setIngestError(null);

    try {
      const validationPayload = extractedRows.map((r) => ({
        date_of_training: r.date_of_training,
        no_of_hours: r.no_of_hours,
        faculty_name: r.faculty_name,
        topic: r.topic,
        mode_of_delivery: r.mode_of_delivery,
      }));

      const res = await api.validateScheduleSlots(validationPayload);
      setValidationConflicts(res.conflicts || []);
      setHasValidated(true);
    } catch (err: any) {
      setIngestError(err.message || "Conflict validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  // Handle Apply All Extracted Sessions to Batch
  const handleApplyExtractedSchedule = async () => {
    if (extractedRows.length === 0) return;
    setIsApplyingSchedule(true);
    setIngestError(null);

    try {
      for (const row of extractedRows) {
        await api.createSession({
          batch_id: batch.id,
          date_of_training: row.date_of_training,
          start_time: row.start_time || "09:00",
          end_time: row.end_time || "17:00",
          topic: row.topic,
          faculty_name: row.faculty_name || batch.faculty_assigned_text || undefined,
          no_of_hours: row.no_of_hours,
          venue: row.venue || batch.location_city || undefined,
          location_city: row.location_city || batch.location_city || undefined,
          mode_of_delivery: row.mode_of_delivery || batch.delivery_mode,
        });
      }

      setIsIngestModalOpen(false);
      setExtractedRows([]);
      setIngestFile(null);
      await loadSessions();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err: any) {
      setIngestError(err.message || "Failed to create sessions from timetable");
    } finally {
      setIsApplyingSchedule(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ justifyContent: "flex-end", padding: 0 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          height: "100vh",
          background: "#ffffff",
          borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          animation: "slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 60
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#f8fafc"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                Batch Lifecycle Hub
              </span>
              {getStatusBadge(batch.status)}
            </div>
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: 800,
              fontFamily: "var(--font-display)",
              color: "#0b5cab",
              marginTop: 4
            }}>
              {batch.batch_id}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          background: "#ffffff",
          padding: "0 24px",
          gap: 12
        }}>
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "12px 14px",
              borderBottom: activeTab === "overview" ? "2px solid #0b5cab" : "2px solid transparent",
              color: activeTab === "overview" ? "#0b5cab" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.875rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer"
            }}
          >
            Overview & Details
          </button>

          <button
            onClick={() => setActiveTab("sessions")}
            style={{
              padding: "12px 14px",
              borderBottom: activeTab === "sessions" ? "2px solid #0b5cab" : "2px solid transparent",
              color: activeTab === "sessions" ? "#0b5cab" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.875rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span>Sessions & Timetable</span>
            <span style={{
              background: activeTab === "sessions" ? "#e8f2fb" : "#f1f5f9",
              color: activeTab === "sessions" ? "#0b5cab" : "var(--text-dim)",
              padding: "1px 6px",
              borderRadius: 10,
              fontSize: "0.75rem",
              fontWeight: 700
            }}>
              {sessions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("quality_gates")}
            style={{
              padding: "12px 14px",
              borderBottom: activeTab === "quality_gates" ? "2px solid #0b5cab" : "2px solid transparent",
              color: activeTab === "quality_gates" ? "#0b5cab" : "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.875rem",
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Sparkles size={15} />
            <span>Quality Checkpoints</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* Program Title & Client */}
              <div className="glass-panel" style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                  Curriculum Title
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>
                  {batch.program_name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  <Building2 size={16} color="#0b5cab" />
                  <span>{batch.client_name || "Enterprise Client"}</span>
                  <span>•</span>
                  <span style={{ color: "#7c3aed", fontWeight: 600 }}>{batch.domain || "IT/ITES"}</span>
                </div>
              </div>

              {/* Governance & Approval ID */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="glass-panel" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    SOW Approval ID
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: batch.approval_id ? "#0b5cab" : "#d97706", marginTop: 4 }}>
                    {batch.approval_id || "Pending Approval"}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Schema Lock
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: batch.is_schema_locked ? "#16a34a" : "#d97706", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    {batch.is_schema_locked ? <Lock size={15} /> : null}
                    <span>{batch.is_schema_locked ? "Locked" : "Unlocked"}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Logistics */}
              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 12 }}>
                  Delivery Logistics & Timeline
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: "0.875rem" }}>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Delivery Mode:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{batch.delivery_mode}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Location / City:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{batch.location_city || "Remote"}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Start Date:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{formatDate(batch.start_date)}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>End Date:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{formatDate(batch.end_date)}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Training Days:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{batch.training_days} days ({batch.total_hours} hrs)</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Category:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>{batch.category}</div>
                  </div>
                </div>
              </div>

              {/* Headcount Breakdown */}
              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 12 }}>
                  Enrollment Headcount
                </h4>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1, background: "#f8fafc", padding: "12px", borderRadius: 8, textAlign: "center", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Total</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0b5cab" }}>{batch.total_enrollments}</div>
                  </div>
                  <div style={{ flex: 1, background: "#f8fafc", padding: "12px", borderRadius: 8, textAlign: "center", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Residential</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#7c3aed" }}>{batch.residential_enrollments}</div>
                  </div>
                  <div style={{ flex: 1, background: "#f8fafc", padding: "12px", borderRadius: 8, textAlign: "center", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Non-Residential</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#16a34a" }}>{batch.non_residential_enrollments}</div>
                  </div>
                </div>
              </div>

              {/* Tech Stack & Faculty */}
              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 8 }}>
                  Technical Stack & Faculty
                </h4>
                <div style={{ fontSize: "0.875rem", color: "var(--text-main)", marginBottom: 8 }}>
                  <strong>Technology:</strong> {batch.technology || "Not specified"}
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--text-main)" }}>
                  <strong>Assigned Faculty:</strong> {batch.faculty_assigned_text || "Unassigned"}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: SESSIONS & TIMETABLE */}
          {activeTab === "sessions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                    Scheduled Sessions
                  </h3>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    Manage delivery sessions or ingest timetable spreadsheet with conflict checks.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setIsIngestModalOpen(true)}
                    className="btn btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.825rem", padding: "6px 12px" }}
                  >
                    <FileSpreadsheet size={15} color="#16a34a" />
                    <span>Ingest Timetable (Excel)</span>
                  </button>

                  <button
                    onClick={() => setIsAddSessionOpen(true)}
                    className="btn btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.825rem", padding: "6px 12px" }}
                  >
                    <Plus size={15} />
                    <span>Add Session</span>
                  </button>
                </div>
              </div>

              {isLoadingSessions ? (
                <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
                  <RefreshCw className="animate-spin" size={24} color="#0b5cab" style={{ margin: "0 auto 8px" }} />
                  <div>Loading sessions...</div>
                </div>
              ) : sessions.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px dashed var(--border-subtle)",
                  color: "var(--text-muted)"
                }}>
                  <Clock size={28} style={{ margin: "0 auto 10px", color: "var(--text-dim)" }} />
                  <div style={{ fontWeight: 600 }}>No Sessions Scheduled Yet</div>
                  <div style={{ fontSize: "0.8rem", marginTop: 4 }}>
                    Use <strong>Add Session</strong> to schedule manually or <strong>Ingest Timetable</strong> to import from Excel.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sessions.map((s, idx) => (
                    <div
                      key={s.id}
                      className="glass-panel"
                      style={{
                        padding: "14px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: s.status === "Completed" ? "#f0fdf4" : "#e8f2fb",
                          color: s.status === "Completed" ? "#16a34a" : "#0b5cab",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.85rem"
                        }}>
                          #{idx + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.925rem", color: "var(--text-main)" }}>
                            {s.topic}
                          </div>
                          <div style={{ fontSize: "0.775rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>📅 {s.date_of_training}</span>
                            <span>•</span>
                            <span>⏱️ {s.start_time || "09:00"} - {s.end_time || "17:00"} ({s.no_of_hours} hrs)</span>
                            <span>•</span>
                            <span>👨‍🏫 {s.faculty?.full_name || "Assigned Faculty"}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {s.status === "Completed" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: "#f0fdf4",
                              color: "#16a34a",
                              border: "1px solid #bbf7d0",
                              borderRadius: 4,
                              padding: "3px 8px",
                              fontSize: "0.75rem",
                              fontWeight: 700
                            }}>
                              <CheckCircle2 size={13} /> Completed
                            </span>
                            {s.rating && (
                              <span style={{
                                background: "#fef3c7",
                                color: "#b45309",
                                border: "1px solid #fde68a",
                                borderRadius: 4,
                                padding: "3px 8px",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                gap: 3
                              }}>
                                <Star size={12} fill="#b45309" /> {s.rating}
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setCompletingSession(s);
                              setGate1Rating(4.5);
                              setGate1Feedback("");
                            }}
                            className="btn btn-primary"
                            style={{ padding: "5px 10px", fontSize: "0.775rem" }}
                          >
                            Gate 1 Complete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUALITY GATES & CLOSURE */}
          {activeTab === "quality_gates" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Gate 1 Summary */}
              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#e8f2fb",
                    color: "#0b5cab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.75rem"
                  }}>
                    1
                  </div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                    Quality Gate 1: Module & Session Feedback
                  </h4>
                </div>
                <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", margin: "0 0 12px 0" }}>
                  Triggered at session completion. Captures student attendance and student feedback ratings (1.0 to 5.0).
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Average Gate 1 Rating</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: batch.batch_avg_feedback ? "#b45309" : "var(--text-dim)", marginTop: 2 }}>
                      {batch.batch_avg_feedback ? `${batch.batch_avg_feedback} / 5.0` : "Pending Session Feedbacks"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Completed Sessions</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#16a34a", marginTop: 2 }}>
                      {sessions.filter((s) => s.status === "Completed").length} / {sessions.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Gate 2 Summary & Closure Action */}
              <div className="glass-panel" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#f0fdf4",
                    color: "#16a34a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.75rem"
                  }}>
                    2
                  </div>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                    Quality Gate 2: Final Batch NPS & Retrospective Closure
                  </h4>
                </div>
                <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", margin: "0 0 14px 0" }}>
                  Mandatory closure governance. Batches cannot be marked Completed without an official Net Promoter Score (0-10) and retrospective delivery notes.
                </p>

                {batch.status === "Completed" ? (
                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 6,
                    padding: "14px 16px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#16a34a", fontWeight: 700 }}>
                      <CheckCircle2 size={16} />
                      <span>Gate 2 Completed & Batch Formally Closed</span>
                    </div>
                    <div style={{ display: "flex", gap: 24, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Final Batch NPS</div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#16a34a" }}>
                          {batch.batch_nps} / 10
                        </div>
                      </div>
                      {batch.retrospective_notes && (
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Retrospective Notes</div>
                          <div style={{ fontSize: "0.825rem", color: "var(--text-main)", marginTop: 2 }}>
                            {batch.retrospective_notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => setIsGate2ModalOpen(true)}
                      className="btn btn-primary"
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Sparkles size={16} />
                      <span>Execute Quality Gate 2 (Close Batch)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Drawer Footer Actions */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f8fafc"
        }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close Drawer
          </button>

          {canApprove && batch.status === "Requested" && onOpenApprove && (
            <button
              onClick={() => {
                onClose();
                onOpenApprove(batch);
              }}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <CheckCircle2 size={16} />
              <span>Approve Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal: Add Single Session */}
      {isAddSessionOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 480, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 6px 0" }}>
              Schedule Session
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 16px 0" }}>
              Add a single delivery slot to <strong>{batch.batch_id}</strong>.
            </p>

            {sessionError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: "0.825rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 14
              }}>
                <AlertCircle size={15} />
                <span>{sessionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSession} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Session Topic / Module *
                </label>
                <input
                  type="text"
                  value={sessionTopic}
                  onChange={(e) => setSessionTopic(e.target.value)}
                  placeholder="e.g. Day 1: Architecture & Containerization"
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Duration (Hours) *
                  </label>
                  <input
                    type="number"
                    value={sessionHours}
                    onChange={(e) => setSessionHours(Number(e.target.value))}
                    min={1}
                    max={12}
                    className="glass-input"
                    style={{ width: "100%" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Assigned Faculty Name
                </label>
                <input
                  type="text"
                  value={sessionFacultyName}
                  onChange={(e) => setSessionFacultyName(e.target.value)}
                  placeholder={batch.faculty_assigned_text || "e.g. Lead Trainer"}
                  className="glass-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setIsAddSessionOpen(false)} className="btn btn-secondary" style={{ padding: "8px 14px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingSession} className="btn btn-primary" style={{ padding: "8px 14px" }}>
                  {isSubmittingSession ? "Scheduling..." : "Schedule Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gate 1 Feedback Completion */}
      {completingSession && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 460, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 6px 0" }}>
              Quality Gate 1: Complete Session
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 16px 0" }}>
              Submit verified module feedback for <strong>{completingSession.topic}</strong>.
            </p>

            {gate1Error && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: "0.825rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 14
              }}>
                <AlertCircle size={15} />
                <span>{gate1Error}</span>
              </div>
            )}

            <form onSubmit={handleCompleteGate1} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Student Module Rating (1.0 to 5.0) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="5.0"
                  value={gate1Rating}
                  onChange={(e) => setGate1Rating(Number(e.target.value))}
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Students Present
                </label>
                <input
                  type="number"
                  min="1"
                  value={gate1StudentsPresent}
                  onChange={(e) => setGate1StudentsPresent(Number(e.target.value))}
                  className="glass-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Topic Feedback / Notes
                </label>
                <textarea
                  value={gate1Feedback}
                  onChange={(e) => setGate1Feedback(e.target.value)}
                  placeholder="Student comprehension, lab completion notes..."
                  className="glass-input"
                  style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setCompletingSession(null)} className="btn btn-secondary" style={{ padding: "8px 14px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingGate1} className="btn btn-primary" style={{ padding: "8px 14px" }}>
                  {isSubmittingGate1 ? "Completing..." : "Submit Gate 1 & Complete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gate 2 Batch NPS Closure */}
      {isGate2ModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 500, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 6px 0" }}>
              Quality Gate 2: Batch NPS Closure
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 16px 0" }}>
              Finalize batch performance metrics and close <strong>{batch.batch_id}</strong>.
            </p>

            {gate2Error && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: "0.825rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 14
              }}>
                <AlertCircle size={15} />
                <span>{gate2Error}</span>
              </div>
            )}

            <form onSubmit={handleCloseBatchGate2} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Official Batch NPS Score (0 to 10) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={gate2Nps}
                  onChange={(e) => setGate2Nps(Number(e.target.value))}
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Overall Batch Average Feedback (1.0 to 5.0)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1.0"
                  max="5.0"
                  value={gate2AvgFeedback}
                  onChange={(e) => setGate2AvgFeedback(Number(e.target.value))}
                  className="glass-input"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Retrospective & Delivery Closure Notes
                </label>
                <textarea
                  value={gate2RetroNotes}
                  onChange={(e) => setGate2RetroNotes(e.target.value)}
                  placeholder="Key milestones achieved, client sign-off status, lessons learned..."
                  className="glass-input"
                  style={{ width: "100%", minHeight: 80, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setIsGate2ModalOpen(false)} className="btn btn-secondary" style={{ padding: "8px 14px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingGate2} className="btn btn-primary" style={{ padding: "8px 14px", background: "#16a34a" }}>
                  {isSubmittingGate2 ? "Closing Batch..." : "Formally Close Batch (Gate 2)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Timetable Excel Ingestion & Conflict Engine */}
      {isIngestModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 80,
          padding: 16
        }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 24, background: "#ffffff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Workflow 2: Timetable Ingestion & Conflict Engine
                </h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                  Upload `.xlsx` / `.csv` schedule, run dry-run conflict check, and batch schedule.
                </p>
              </div>
              <button onClick={() => setIsIngestModalOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)" }}>
                <X size={20} />
              </button>
            </div>

            {ingestError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: "0.825rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12
              }}>
                <AlertCircle size={15} />
                <span>{ingestError}</span>
              </div>
            )}

            {/* File Upload Section */}
            {extractedRows.length === 0 ? (
              <form onSubmit={handleIngestFileSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{
                  border: "2px dashed var(--border-subtle)",
                  borderRadius: 8,
                  padding: "32px 20px",
                  textAlign: "center",
                  background: "#f8fafc"
                }}>
                  <Upload size={32} style={{ margin: "0 auto 10px", color: "#0b5cab" }} />
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>
                    Select Timetable Spreadsheet (.xlsx, .xls, .csv)
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setIngestFile(e.target.files ? e.target.files[0] : null)}
                    style={{ marginTop: 12 }}
                    required
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" onClick={() => setIsIngestModalOpen(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={!ingestFile || isIngesting} className="btn btn-primary">
                    {isIngesting ? "Extracting..." : "Parse Timetable"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", gap: 12 }}>
                {/* Extracted preview */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Extracted {extractedRows.length} Delivery Slot(s)
                  </span>
                  <button
                    onClick={handleValidateSchedule}
                    disabled={isValidating}
                    className="btn btn-secondary"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", padding: "5px 12px" }}
                  >
                    <ShieldAlert size={14} color="#0b5cab" />
                    <span>{isValidating ? "Validating..." : "Run Conflict Engine Check"}</span>
                  </button>
                </div>

                {/* Validation Status Banner */}
                {hasValidated && (
                  validationConflicts.length === 0 ? (
                    <div style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#16a34a",
                      padding: "10px 14px",
                      borderRadius: 6,
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}>
                      <CheckCircle2 size={16} />
                      <span><strong>All Clear:</strong> Zero faculty capacity conflicts detected! Ready to apply schedule.</span>
                    </div>
                  ) : (
                    <div style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      padding: "10px 14px",
                      borderRadius: 6,
                      fontSize: "0.825rem"
                    }}>
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <AlertTriangle size={15} />
                        <span>{validationConflicts.length} Conflict(s) Flagged by Conflict Engine:</span>
                      </div>
                      <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                        {validationConflicts.map((c, i) => (
                          <li key={i}>{c.reason} on {c.date} ({c.faculty_name})</li>
                        ))}
                      </ul>
                    </div>
                  )
                )}

                {/* Table of extracted rows */}
                <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px" }}>Date</th>
                        <th style={{ padding: "8px 12px" }}>Topic</th>
                        <th style={{ padding: "8px 12px" }}>Faculty</th>
                        <th style={{ padding: "8px 12px" }}>Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedRows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.date_of_training}</td>
                          <td style={{ padding: "8px 12px" }}>{r.topic}</td>
                          <td style={{ padding: "8px 12px" }}>{r.faculty_name || "—"}</td>
                          <td style={{ padding: "8px 12px" }}>{r.no_of_hours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setExtractedRows([]);
                      setHasValidated(false);
                      setValidationConflicts([]);
                    }}
                    className="btn btn-secondary"
                  >
                    Back to Upload
                  </button>
                  <button
                    onClick={handleApplyExtractedSchedule}
                    disabled={isApplyingSchedule}
                    className="btn btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Check size={16} />
                    <span>{isApplyingSchedule ? "Scheduling..." : "Apply & Schedule All"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
