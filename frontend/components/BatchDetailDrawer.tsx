"use client";

import React, { useState, useEffect } from "react";
import {
  Batch, TrainingSession, ExtractedScheduleRow, ConflictDetail,
  api, BatchOption, ScheduledSession
} from "@/lib/api";
import { formatDate as formatDateDMY } from "@/lib/dateUtils";
import {
  X, Calendar, Users, MapPin, Monitor, Clock, FileText, CheckCircle2,
  Lock, Star, Building2, User, Plus, Upload, AlertCircle, AlertTriangle,
  PlayCircle, RefreshCw, FileSpreadsheet, ShieldAlert, Sparkles, Check,
  Edit3, GraduationCap, ShieldCheck, Mail, Briefcase, Info, Hash,
  PauseCircle, Ban
} from "lucide-react";

interface ParsedRemarkItem {
  id: number;
  isAudit: boolean;
  timestamp: string | null;
  action: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  actor?: string | null;
  message: string;
  raw: string;
}

const parseRemarksList = (rawRemarks?: string | null): ParsedRemarkItem[] => {
  if (!rawRemarks || !rawRemarks.trim()) return [];

  // 1. Normalize legacy UTC timestamps to IST
  const normalized = rawRemarks.replace(
    /(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})\s+UTC/g,
    (_match, d, m, y, h, min) => {
      const dt = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min)));
      const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
      const istDate = new Date(dt.getTime() + istOffsetMs);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(istDate.getUTCDate())}-${pad(istDate.getUTCMonth() + 1)}-${istDate.getUTCFullYear()} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())} IST`;
    }
  );

  // 2. Split into entries either by newlines or by lookahead before '[' timestamp pattern
  const chunks = normalized
    .split(/\r?\n+|(?<=\S)\s*(?=\[\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+(?:IST|UTC))/)
    .map((s) => s.trim())
    .filter(Boolean);

  return chunks.map((item, idx) => {
    // Audit format: [DD-MM-YYYY HH:MM IST/UTC - ACTION]: MESSAGE
    const auditRegex = /^\[(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+(?:IST|UTC))\s*-\s*([^\]]+)\]:\s*([\s\S]*)$/;
    const match = item.match(auditRegex);

    if (match) {
      const timestamp = match[1].replace("UTC", "IST");
      const actionText = match[2].trim();
      const message = match[3].trim();

      const statusRegex = /^Status changed from '([^']+)' to '([^']+)' by (.+)$/i;
      const statusMatch = actionText.match(statusRegex);

      if (statusMatch) {
        return {
          id: idx + 1,
          isAudit: true,
          timestamp,
          action: actionText,
          fromStatus: statusMatch[1],
          toStatus: statusMatch[2],
          actor: statusMatch[3],
          message,
          raw: item,
        };
      }

      return {
        id: idx + 1,
        isAudit: true,
        timestamp,
        action: actionText,
        message,
        raw: item,
      };
    }

    return {
      id: idx + 1,
      isAudit: false,
      timestamp: null,
      action: null,
      message: item,
      raw: item,
    };
  });
};

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
  const [currentBatch, setCurrentBatch] = useState<Batch | null>(batch);
  const [options, setOptions] = useState<{
    entities: BatchOption[];
    categories: BatchOption[];
    accommodations: BatchOption[];
    delivery_modes: BatchOption[];
  }>({ entities: [], categories: [], accommodations: [], delivery_modes: [] });

  useEffect(() => {
    setCurrentBatch(batch);
    if (batch?.id) {
      api.getBatch(batch.id)
        .then((fresh) => {
          if (fresh) setCurrentBatch(fresh);
        })
        .catch((err) => console.error("Failed to load fresh batch details:", err));
    }
  }, [batch]);

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        api.getBatchOptions("entities").catch(() => []),
        api.getBatchOptions("categories").catch(() => []),
        api.getBatchOptions("accommodations").catch(() => []),
        api.getBatchOptions("delivery-modes").catch(() => []),
      ]).then(([entities, categories, accommodations, delivery_modes]) => {
        setOptions({ entities, categories, accommodations, delivery_modes });
      });
    }
  }, [isOpen]);

  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "quality_gates">("overview");

  // Edit Batch state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Batch>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditModal = () => {
    const target = currentBatch || batch;
    if (!target) return;
    const deliveryModeVal = target.delivery_mode || (target.delivery_mode_id ? options.delivery_modes.find((m) => m.id === target.delivery_mode_id)?.name : null) || "Online";
    setEditForm({
      program_name: target.program_name,
      client_name: target.client_name,
      sow_number: target.sow_number,
      domain: target.domain,
      technology: target.technology,
      delivery_mode: deliveryModeVal,
      delivery_mode_id: target.delivery_mode_id,
      location_city: target.location_city,
      start_date: target.start_date ? target.start_date.split("T")[0] : "",
      end_date: target.end_date ? target.end_date.split("T")[0] : "",
      training_days: target.training_days,
      total_hours: target.total_hours,
      total_enrollments: target.total_enrollments,
      faculty_assigned_text: target.faculty_assigned_text,
      remarks: target.remarks,
    });
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = currentBatch || batch;
    if (!target) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const payload: any = {
        ...editForm,
        sow_number: editForm.sow_number ? String(editForm.sow_number).trim() : undefined,
        start_date: editForm.start_date ? new Date(editForm.start_date).toISOString() : undefined,
        end_date: editForm.end_date ? new Date(editForm.end_date).toISOString() : undefined,
        training_days: Number(editForm.training_days) || 0,
        total_hours: Number(editForm.total_hours) || 0,
        total_enrollments: Number(editForm.total_enrollments) || 0,
        non_residential_enrollments: Number(editForm.total_enrollments) || 0,
      };
      const updated = await api.updateBatch(target.id, payload);
      setCurrentBatch(updated);
      setIsEditModalOpen(false);
      if (onBatchUpdated) onBatchUpdated();
    } catch (err: any) {
      setEditError(err.message || "Failed to update batch details");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Lifecycle Status Modal State (OnHold / Cancelled / Resume)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [statusReason, setStatusReason] = useState("");
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const getResumedStatus = (target: Batch): string => {
    if (target.approver_1_status === "Pending") {
      return "Approval 1 Pending";
    }
    if (target.approver_1_status === "Approved" && target.approver_2_status === "Pending") {
      return "Approval 2 Pending";
    }
    if (target.approver_1_status === "Rejected" || target.approver_2_status === "Rejected") {
      return "Requested";
    }
    if (target.approver_1_status === "Approved" && target.approver_2_status === "Approved") {
      return "Approved";
    }
    return "Approval 1 Pending";
  };

  const openStatusModal = (newStatus: "OnHold" | "Cancelled" | "Resume" | string) => {
    const target = currentBatch || batch;
    let effectiveStatus = newStatus;
    if (newStatus === "Resume" && target) {
      effectiveStatus = getResumedStatus(target);
    }
    setTargetStatus(effectiveStatus);
    setStatusReason("");
    setStatusError(null);
    setIsStatusModalOpen(true);
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = currentBatch || batch;
    if (!target || !targetStatus) return;
    if (!statusReason.trim() || statusReason.trim().length < 3) {
      setStatusError("A reason (minimum 3 characters) is required.");
      return;
    }
    setIsSubmittingStatus(true);
    setStatusError(null);
    try {
      const updated = await api.updateBatchLifecycleStatus(target.id, targetStatus, statusReason.trim());
      setCurrentBatch(updated);
      setIsStatusModalOpen(false);
      if (onBatchUpdated) onBatchUpdated();
    } catch (err: any) {
      setStatusError(err.message || "Failed to update batch status");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Sessions & Curriculum Schedule state
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Computed session stats
  const completedSessions = sessions.filter((s) => s.status === "Completed").length;
  const allSessionsCompleted = sessions.length > 0 && completedSessions === sessions.length;

  // Log Faculty Utilization on Session Day Modal
  const [isLogUtilizationOpen, setIsLogUtilizationOpen] = useState(false);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<ScheduledSession | null>(null);
  const [utilFacultyName, setUtilFacultyName] = useState("");
  const [utilDate, setUtilDate] = useState("");
  const [utilStartTime, setUtilStartTime] = useState("09:30");
  const [utilEndTime, setUtilEndTime] = useState("17:30");
  const [utilTopic, setUtilTopic] = useState("");
  const [utilHours, setUtilHours] = useState(8);
  const [utilDeliveryMode, setUtilDeliveryMode] = useState("Online");
  const [utilVenue, setUtilVenue] = useState("");
  const [utilCity, setUtilCity] = useState("");
  const [utilStatus, setUtilStatus] = useState("Completed");
  const [utilFeedbackCollected, setUtilFeedbackCollected] = useState<"yes" | "no" | null>(null);
  const [utilFeedbackRating, setUtilFeedbackRating] = useState(4.5);
  const [utilFeedbackNotes, setUtilFeedbackNotes] = useState("");
  const [isSubmittingUtil, setIsSubmittingUtil] = useState(false);
  const [utilError, setUtilError] = useState<string | null>(null);

  const openLogUtilizationModal = (day: ScheduledSession) => {
    setSelectedScheduleDay(day);
    const target = currentBatch || batch;
    setUtilFacultyName(day.trainer_name || target?.faculty_assigned_text || "");
    setUtilDate(String(day.session_date).slice(0, 10));
    setUtilStartTime(day.start_time ? String(day.start_time).slice(0, 5) : "09:30");
    setUtilEndTime(day.end_time ? String(day.end_time).slice(0, 5) : "17:30");
    setUtilTopic(day.module || "");
    setUtilHours(Number(day.duration_hours) || 8);
    const defMode = target?.delivery_mode || (target?.delivery_mode_id ? options.delivery_modes.find(m => m.id === target.delivery_mode_id)?.name : null) || "Online";
    setUtilDeliveryMode(defMode);
    setUtilVenue(target?.location_city ? `${target.location_city} Center` : "Virtual MS Teams");
    setUtilCity(target?.location_city || "");
    setUtilStatus("Completed");
    setUtilFeedbackCollected(null);
    setUtilFeedbackRating(4.5);
    setUtilFeedbackNotes("");
    setUtilError(null);
    setIsLogUtilizationOpen(true);
  };

  const handleLogUtilizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = currentBatch || batch;
    if (!selectedScheduleDay || !target) return;
    if (utilFeedbackCollected === null) {
      setUtilError("Please select whether feedback was collected");
      return;
    }
    setIsSubmittingUtil(true);
    setUtilError(null);
    try {
      const dateOfTrainingIso = new Date(`${utilDate}T${utilStartTime || "09:00"}:00`).toISOString();
      const feedbackEntered = utilFeedbackCollected === "yes" && (utilFeedbackNotes.trim().length > 0 || Number(utilFeedbackRating) > 0);
      await api.createSession({
        batch_id: target.id,
        training_session_id: selectedScheduleDay.id,
        date_of_training: dateOfTrainingIso,
        start_time: utilStartTime,
        end_time: utilEndTime,
        topic: utilTopic.trim(),
        faculty_name: utilFacultyName.trim() || target.faculty_assigned_text || "Faculty assigned",
        no_of_hours: Number(utilHours) || 8,
        venue: utilVenue.trim() || undefined,
        location_city: utilCity.trim() || target.location_city || undefined,
        mode_of_delivery: utilDeliveryMode,
        status: utilStatus,
        feedback_submitted: feedbackEntered,
        feedback_rating: feedbackEntered ? Number(utilFeedbackRating) || undefined : undefined,
        feedback_notes: feedbackEntered ? utilFeedbackNotes.trim() || undefined : undefined,
      });
      setIsLogUtilizationOpen(false);
      await loadSessions();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err: any) {
      setUtilError(err.message || "Failed to log faculty utilization");
    } finally {
      setIsSubmittingUtil(false);
    }
  };

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

  // Curriculum row correction state
  const [editingScheduledSession, setEditingScheduledSession] = useState<ScheduledSession | null>(null);
  const [scheduledEditForm, setScheduledEditForm] = useState({
    module: "", session_date: "", start_time: "09:00", end_time: "17:00", duration_hours: 8, trainer_name: ""
  });
  const [isSavingScheduledEdit, setIsSavingScheduledEdit] = useState(false);
  const [scheduledEditError, setScheduledEditError] = useState<string | null>(null);

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
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null);
  const [isImportingFeedback, setIsImportingFeedback] = useState(false);
  const [feedbackImportMessage, setFeedbackImportMessage] = useState<string | null>(null);

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
  const [ingestSummary, setIngestSummary] = useState<{ message: string; extractedRows: number; failedRows: number; errors: string[] } | null>(null);
  const [editingParsedRow, setEditingParsedRow] = useState<number | null>(null);

  const openScheduledSessionEdit = (session: ScheduledSession) => {
    setEditingScheduledSession(session);
    setScheduledEditForm({
      module: session.module || "",
      session_date: session.session_date ? String(session.session_date).slice(0, 10) : "",
      start_time: session.start_time ? String(session.start_time).slice(0, 5) : "09:00",
      end_time: session.end_time ? String(session.end_time).slice(0, 5) : "17:00",
      duration_hours: Number(session.duration_hours) || 8,
      trainer_name: session.trainer_name || "",
    });
    setScheduledEditError(null);
  };

  const saveScheduledSessionEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingScheduledSession) return;
    setIsSavingScheduledEdit(true);
    setScheduledEditError(null);
    try {
      await api.updateScheduledSession(editingScheduledSession.id, {
        module: scheduledEditForm.module.trim(),
        session_date: scheduledEditForm.session_date,
        start_time: scheduledEditForm.start_time,
        end_time: scheduledEditForm.end_time,
        duration_hours: scheduledEditForm.duration_hours,
        trainer_name: scheduledEditForm.trainer_name.trim() || undefined,
      });
      setEditingScheduledSession(null);
      await loadSessions();
    } catch (err: any) {
      setScheduledEditError(err.message || "Failed to update scheduled session");
    } finally {
      setIsSavingScheduledEdit(false);
    }
  };

  // Load sessions when drawer opens or tab switches
  const loadSessions = async () => {
    if (!batch) return;
    setIsLoadingSessions(true);
    try {
      const [utilData, schedData] = await Promise.all([
        api.getSessions({ batch_id: batch.id }).catch(() => []),
        api.getScheduledSessions(batch.id).catch(() => []),
      ]);
      setSessions(utilData || []);
      setScheduledSessions(schedData || []);
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

  const activeBatch: Batch = currentBatch || batch;
  if (!activeBatch) return null;

  const formatDate = (dStr?: string | null) => {
    return formatDateDMY(dStr, "Not set");
  };

  const getEntityName = (id?: string | null) => {
    if (!id) return null;
    const found = options.entities.find((e) => e.id === id);
    return found ? found.name : null;
  };

  const getAccommodationName = (id?: string | null, resType?: string | null) => {
    if (id) {
      const found = options.accommodations.find((a) => a.id === id);
      if (found?.name) return found.name;
    }
    if (resType === "R") return "Residential / Hotel Provided";
    if (resType === "NR") return "Non-Residential / Local Trainer";
    return resType || "Non-Residential";
  };

  const getDeliveryModeName = (id?: string | null, mode?: string | null) => {
    if (mode && mode.trim()) return mode;
    if (id) {
      const found = options.delivery_modes.find((m) => m.id === id);
      if (found?.name) return found.name;
    }
    return mode || "Online";
  };

  const calculatedCalendarDays =
    activeBatch.calendar_days ??
    (activeBatch.start_date && activeBatch.end_date
      ? Math.max(
          0,
          Math.round(
            (new Date(activeBatch.end_date).getTime() - new Date(activeBatch.start_date).getTime()) / 86400000
          )
        )
      : null);

  const facultyChips = activeBatch.faculty_assigned_text
    ? activeBatch.faculty_assigned_text
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
    : [];

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "requested") return <span className="badge badge-requested">Requested</span>;
    if (s === "approval 1 pending") return <span className="badge badge-requested">Approval 1 Pending</span>;
    if (s === "approval 2 pending") return <span className="badge badge-requested">Approval 2 Pending</span>;
    if (s === "approved") return <span className="badge badge-approved">Approved</span>;
    if (s === "upcoming") return <span className="badge badge-approved">Upcoming</span>;
    if (s === "ongoing") return <span className="badge badge-ongoing">Ongoing</span>;
    if (s === "completed") return <span className="badge badge-completed">Completed</span>;
    if (s === "onhold") return <span className="badge badge-onhold">On Hold</span>;
    if (s === "cancelled") return <span className="badge badge-cancelled">Cancelled</span>;
    return <span className="badge badge-cancelled">{status}</span>;
  };

  const getStatusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "requested" || s.includes("pending")) return "#d97706";
    if (s === "approved" || s === "upcoming") return "#0b5cab";
    if (s === "ongoing") return "#06b6d4";
    if (s === "completed") return "#16a34a";
    if (s === "onhold") return "#b45309";
    if (s === "cancelled") return "#e11d48";
    return "#94a3b8";
  };

  // Handle Add Single Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setSessionError(null);
    setIsSubmittingSession(true);

    try {
      await api.createScheduledSession({
        batch_id: batch.id,
        session_date: sessionDate,
        start_time: sessionStartTime,
        end_time: sessionEndTime,
        module: sessionTopic.trim(),
        trainer_name: sessionFacultyName.trim() || undefined,
        duration_hours: Number(sessionHours),
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
    const topicFeedback = gate1Feedback.trim();
    if (topicFeedback.length < 3) {
      setGate1Error("Topic feedback is required and must contain at least 3 characters.");
      return;
    }
    setGate1Error(null);
    setIsSubmittingGate1(true);

    try {
      await api.completeSessionGate1(completingSession.id, {
        rating: Number(gate1Rating),
        topic_feedback: topicFeedback,
        total_students_present: Number(gate1StudentsPresent),
      });

      setCompletingSession(null);
      setGate1Feedback("");
      await loadSessions();
      if (onBatchUpdated) onBatchUpdated();
    } catch (err: any) {
      let message = err.message || "Failed to submit Gate 1 feedback";
      try {
        const details = JSON.parse(message);
        const firstError = Array.isArray(details) ? details[0] : details?.errors?.[0];
        if (firstError?.msg) message = firstError.msg;
      } catch {
        // Keep the server message when it is not JSON.
      }
      setGate1Error(message);
    } finally {
      setIsSubmittingGate1(false);
    }
  };

  const handleEditSession = async (session: TrainingSession) => {
    const topic = window.prompt("Session topic", session.topic);
    if (!topic || topic.trim() === session.topic) return;
    try {
      await api.updateSession(session.id, { topic: topic.trim() });
      await loadSessions();
    } catch (err: any) {
      alert(err.message || "Failed to edit session");
    }
  };

  const handleSessionOutcome = async (session: TrainingSession, action: "cancel" | "not-conducted") => {
    const reason = window.prompt("Reason is required");
    if (!reason || reason.trim().length < 3) return;
    try {
      if (action === "cancel") {
        await api.cancelSession(session.id, reason.trim());
      } else {
        await api.markSessionNotConducted(session.id, reason.trim());
      }
      await loadSessions();
    } catch (err: any) {
      alert(err.message || "Failed to update session outcome");
    }
  };

  const handleImportFeedback = async () => {
    if (!feedbackFile) return;
    setIsImportingFeedback(true);
    setFeedbackImportMessage(null);
    try {
      const result = await api.importBatchFeedback(activeBatch.id, feedbackFile);
      setFeedbackImportMessage(`Imported ${result.total_responses} responses. Calculated NPS: ${result.nps_score}.`);
      if (onBatchUpdated) onBatchUpdated();
    } catch (err: any) {
      setFeedbackImportMessage(err.message || "Failed to import final feedback");
    } finally {
      setIsImportingFeedback(false);
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
    setIngestSummary(null);
    setIsIngesting(true);
    setHasValidated(false);
    setValidationConflicts([]);

    try {
      const res = await api.ingestScheduleFile(ingestFile, batch.batch_id);
      const rows = Array.isArray(res.extracted_schedule) && res.extracted_schedule.length > 0
        ? res.extracted_schedule
        : Array.isArray(res.items) ? res.items : [];
      setExtractedRows(rows);
      setIngestSummary({
        message: res.message || "Timetable processed.",
        extractedRows: res.extracted_rows ?? rows.length,
        failedRows: res.failed_rows ?? 0,
        errors: (res.errors || []).map((error) => `Row ${error.source_row}: ${error.message}`),
      });
      if (rows.length === 0 && (res.errors || []).length === 0) {
        setIngestError("The file was accepted, but no schedule rows were extracted. Check the column names and date values.");
      }
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
        batch_id: batch.batch_id,
        date_of_training: r.date_of_training,
        no_of_hours: r.no_of_hours,
        faculty_name: r.faculty_name || batch.faculty_assigned_text || undefined,
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
      await api.applySchedule(
        extractedRows.map((row) => ({
          ...row,
          start_time: row.start_time || "09:00",
          end_time: row.end_time || "17:00",
          faculty_name: row.faculty_name || batch.faculty_assigned_text || undefined,
          venue: row.venue || batch.location_city || undefined,
          location_city: row.location_city || batch.location_city || undefined,
          mode_of_delivery: row.mode_of_delivery || batch.delivery_mode,
          batch_id: batch.batch_id,
        })),
        batch.batch_id,
        ingestFile?.name,
      );

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
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 990,
        padding: "16px",
      }}
    >
      <div
        className="modal-content glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 960,
          maxHeight: "92vh",
          background: "#ffffff",
          borderRadius: 20,
          border: "1px solid rgba(160, 190, 223, 0.8)",
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.2), 0 8px 16px rgba(0, 0, 0, 0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: "20px 26px 16px 26px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 250, 255, 0.94) 100%)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em" }}>
                Full Batch Details & Governance Hub
              </span>
              {getStatusBadge(activeBatch.status)}
            </div>
            <h2 style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              fontFamily: "var(--font-display)",
              color: "#0b5cab",
              marginTop: 4
            }}>
              {activeBatch.batch_id}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            style={{
              background: "rgba(226, 232, 240, 0.6)",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 8,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
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

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              {/* OnHold Notice Banner */}
              {activeBatch.status === "OnHold" && (
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    borderRadius: 14,
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <PauseCircle size={22} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 800, color: "#b45309", fontSize: "0.95rem" }}>
                        Batch is Currently ON HOLD
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-main)", margin: "4px 0 0 0" }}>
                        Delivery operations, faculty sessions, and schedule milestones are temporarily paused.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openStatusModal("Resume")}
                    className="btn btn-primary"
                    style={{ background: "#059669", padding: "7px 14px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                  >
                    <PlayCircle size={15} /> Resume Batch
                  </button>
                </div>
              )}

              {/* Cancelled Notice Banner */}
              {activeBatch.status === "Cancelled" && (
                <div
                  style={{
                    background: "rgba(225, 29, 72, 0.08)",
                    border: "1px solid rgba(225, 29, 72, 0.35)",
                    borderRadius: 14,
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <Ban size={22} color="#e11d48" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 800, color: "#be123c", fontSize: "0.95rem" }}>
                        Batch is CANCELLED
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--text-main)", margin: "4px 0 0 0" }}>
                        This batch has been marked as cancelled. Scheduled delivery is terminated.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openStatusModal("Resume")}
                    className="btn btn-secondary"
                    style={{ padding: "7px 14px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                  >
                    <RefreshCw size={14} /> Reopen Batch
                  </button>
                </div>
              )}

              {/* Rejection / Revision Notice */}
              {activeBatch.comments && activeBatch.status === "Requested" && (
                <div
                  style={{
                    background: "rgba(244, 63, 94, 0.1)",
                    border: "1px solid rgba(244, 63, 94, 0.3)",
                    borderRadius: 14,
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#e11d48" }}>
                      <AlertCircle size={18} />
                      <span>Approval Rejection Feedback</span>
                    </div>
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="btn btn-secondary"
                      style={{ padding: "4px 10px", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Edit3 size={13} /> Edit Batch
                    </button>
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--text-main)", marginTop: 8, fontWeight: 500 }}>
                    {activeBatch.comments}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>
                    Make the requested adjustments via &ldquo;Edit Batch&rdquo;. New batches are sent to approval automatically after creation.
                  </div>
                </div>
              )}

              {/* Program & Client Context */}
              <div className="glass-panel" style={{ padding: "18px 22px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
                      Curriculum / Program Title
                    </div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)", marginTop: 4, lineHeight: 1.3 }}>
                      {activeBatch.program_name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 10, fontSize: "0.85rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-main)", fontWeight: 700 }}>
                        <Building2 size={16} color="#0b5cab" />
                        <span>{activeBatch.client_name || "Enterprise Client"}</span>
                      </div>
                      <span style={{ color: "var(--border-subtle)" }}>•</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>Entity:</span>
                        <span style={{ fontWeight: 600, color: "#0b5cab", background: "rgba(11, 92, 171, 0.08)", padding: "2px 8px", borderRadius: 6, fontSize: "0.8rem" }}>
                          {getEntityName(activeBatch.entity_id) || "Corporate Enterprise"}
                        </span>
                      </div>
                      <span style={{ color: "var(--border-subtle)" }}>•</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>Domain:</span>
                        <span style={{ color: "#7c3aed", fontWeight: 700, background: "rgba(124, 58, 237, 0.08)", padding: "2px 8px", borderRadius: 6, fontSize: "0.8rem" }}>
                          {activeBatch.domain || "Technology"}
                        </span>
                      </div>
                      <span style={{ color: "var(--border-subtle)" }}>•</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>Category:</span>
                        <span style={{ fontWeight: 600, color: "var(--text-main)", background: "#f1f5f9", padding: "2px 8px", borderRadius: 6, fontSize: "0.8rem" }}>
                          {activeBatch.category || "Bootcamp"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="btn btn-secondary"
                    style={{ padding: "8px 14px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                  >
                    <Edit3 size={14} /> Edit Batch
                  </button>
                </div>
              </div>

              {/* Commercial & Contractual Identifiers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                <div className="glass-panel" style={{ padding: "14px 16px", background: "#ffffff" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Client SOW / PO Number
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: activeBatch.sow_number ? "var(--text-main)" : "var(--text-muted)", marginTop: 4, fontFamily: "monospace" }}>
                    {activeBatch.sow_number || "Not specified"}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: "14px 16px", background: "#ffffff" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Financial Approval ID
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: activeBatch.approval_id ? "#0b5cab" : "#d97706", marginTop: 4 }}>
                    {activeBatch.approval_id || "Pending Level 1/2 Approval"}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: "14px 16px", background: "#ffffff" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                    Governance Lock
                  </div>
                  <div style={{
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: activeBatch.is_schema_locked ? "#16a34a" : "#d97706",
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    {activeBatch.is_schema_locked ? <Lock size={15} /> : <ShieldAlert size={15} />}
                    <span>{activeBatch.is_schema_locked ? "Schema Locked" : "Unlocked (Editable)"}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Logistics & Schedule Details */}
              <div className="glass-panel" style={{ padding: "18px 20px", background: "#ffffff" }}>
                <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 14, letterSpacing: "0.04em" }}>
                  Schedule, Mode & Delivery Logistics
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, fontSize: "0.85rem" }}>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Delivery Mode</span>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                      {getDeliveryModeName(activeBatch.delivery_mode_id, activeBatch.delivery_mode)}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Training Venue / City</span>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                      {activeBatch.location_city || (getDeliveryModeName(activeBatch.delivery_mode_id, activeBatch.delivery_mode) === "Online" ? "Remote (Online)" : "Not specified")}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Faculty Accommodation</span>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                      {getAccommodationName(activeBatch.accommodation_id, activeBatch.residential_type)}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Training Category</span>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>{activeBatch.category || "Bootcamp"}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Commencement Date</span>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>{formatDate(activeBatch.start_date)}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Conclusion Date</span>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>{formatDate(activeBatch.end_date)}</div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Calendar Duration</span>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                      {calculatedCalendarDays !== null ? `${calculatedCalendarDays} Calendar Days` : "Not set"}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 600 }}>Active Training Hours</span>
                    <div style={{ fontWeight: 700, color: "#0b5cab", marginTop: 2 }}>
                      {activeBatch.training_days} Days ({activeBatch.total_hours} Hours)
                    </div>
                  </div>
                </div>
              </div>

              {/* Headcount Breakdown & Assigned Faculty */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* Headcount */}
                <div className="glass-panel" style={{ padding: "18px 20px", background: "#ffffff" }}>
                  <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 12, letterSpacing: "0.04em" }}>
                    Candidate Headcount
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, textAlign: "center" }}>
                    <div style={{ background: "#f8fafc", padding: "12px 8px", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 600 }}>Total Headcount</div>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0b5cab", marginTop: 2 }}>
                        {activeBatch.total_enrollments}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Faculty Assignment */}
                <div className="glass-panel" style={{ padding: "18px 20px", background: "#ffffff" }}>
                  <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 10, letterSpacing: "0.04em" }}>
                    Proposed & Assigned Faculty
                  </h4>
                  {facultyChips.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {facultyChips.map((name) => (
                        <span
                          key={name}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "rgba(11, 92, 171, 0.08)",
                            color: "#0b5cab",
                            border: "1px solid rgba(11, 92, 171, 0.25)",
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: "0.825rem",
                            fontWeight: 600,
                          }}
                        >
                          <GraduationCap size={14} />
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : activeBatch.faculty_assigned_text ? (
                    <div style={{ fontSize: "0.875rem", color: "var(--text-main)", fontWeight: 600, marginTop: 6 }}>
                      {activeBatch.faculty_assigned_text}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.825rem", color: "var(--text-dim)", fontStyle: "italic", marginTop: 6 }}>
                      No faculty members assigned yet. You can assign trainers via Edit Batch or during Timetable ingestion.
                    </div>
                  )}

                  <div style={{ marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>
                      Technology Stack & Modules
                    </div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>
                      {activeBatch.technology || "Not specified"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stakeholder Role Assignments & Governance Clearance */}
              <div className="glass-panel" style={{ padding: "18px 20px", background: "#ffffff" }}>
                <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, marginBottom: 14, letterSpacing: "0.04em" }}>
                  Stakeholder Role Assignments & Approvals
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, fontSize: "0.85rem" }}>
                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                      Sales Account SPOC
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>
                      {activeBatch.sales_spoc?.full_name || "Unassigned"}
                    </div>
                    {activeBatch.sales_spoc?.email && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <Mail size={12} /> {activeBatch.sales_spoc.email}
                      </div>
                    )}
                  </div>

                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                      Operations Coordinator
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>
                      {activeBatch.coordinator?.full_name || "Unassigned"}
                    </div>
                    {activeBatch.coordinator?.email && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <Mail size={12} /> {activeBatch.coordinator.email}
                      </div>
                    )}
                  </div>

                  <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                      Delivery Manager
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 4 }}>
                      {activeBatch.primary_manager?.full_name || "Unassigned"}
                    </div>
                    {activeBatch.primary_manager?.email && (
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        <Mail size={12} /> {activeBatch.primary_manager.email}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 12, fontSize: "0.825rem" }}>
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>Requested On:</span>
                    <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>
                      {formatDate(activeBatch.batch_request_date || activeBatch.created_at)}
                    </div>
                  </div>

                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>Approver 1 Status:</span>
                    <div style={{ fontWeight: 700, color: activeBatch.approver_1_status === "Approved" ? "#16a34a" : activeBatch.approver_1_status === "Rejected" ? "#e11d48" : "#d97706", marginTop: 2 }}>
                      {activeBatch.approver_1_status || "Pending"}
                      {activeBatch.approver_1_approved_at && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>
                          ({formatDate(activeBatch.approver_1_approved_at)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ color: "var(--text-dim)", fontSize: "0.72rem", textTransform: "uppercase", fontWeight: 700 }}>Approver 2 Status:</span>
                    <div style={{ fontWeight: 700, color: activeBatch.approver_2_status === "Approved" ? "#16a34a" : activeBatch.approver_2_status === "Rejected" ? "#e11d48" : "#d97706", marginTop: 2 }}>
                      {activeBatch.approver_2_status || "Pending"}
                      {activeBatch.approver_2_approved_at && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>
                          ({formatDate(activeBatch.approver_2_approved_at)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Remarks & Special Instructions */}
              <div className="glass-panel" style={{ padding: "18px 20px", background: "#ffffff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-dim)", fontWeight: 700, margin: 0, letterSpacing: "0.04em" }}>
                      Operational Remarks & Special Instructions
                    </h4>
                    {parseRemarksList(activeBatch.remarks).length > 0 && (
                      <span style={{
                        background: "#e2e8f0",
                        color: "#475569",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12
                      }}>
                        {parseRemarksList(activeBatch.remarks).length} {parseRemarksList(activeBatch.remarks).length === 1 ? "entry" : "entries"}
                      </span>
                    )}
                  </div>
                </div>

                {parseRemarksList(activeBatch.remarks).length === 0 ? (
                  <div style={{
                    fontSize: "0.875rem",
                    color: "var(--text-dim)",
                    fontStyle: "italic",
                    lineHeight: 1.5,
                    background: "#f8fafc",
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--border-subtle)",
                  }}>
                    No operational remarks or special instructions provided.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {parseRemarksList(activeBatch.remarks).map((entry, idx) => (
                      <div
                        key={entry.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "12px 14px",
                          borderRadius: 8,
                          background: entry.isAudit ? "#f8fafc" : "#ffffff",
                          border: "1px solid var(--border-subtle)",
                          borderLeft: entry.isAudit
                            ? entry.toStatus === "OnHold"
                              ? "4px solid #d97706"
                              : entry.toStatus === "Cancelled"
                              ? "4px solid #e11d48"
                              : "4px solid #3b82f6"
                            : "4px solid #10b981",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                        }}
                      >
                        {/* Number Indicator */}
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: entry.isAudit ? "#eff6ff" : "#ecfdf5",
                            color: entry.isAudit ? "#2563eb" : "#059669",
                            border: `1px solid ${entry.isAudit ? "#bfdbfe" : "#a7f3d0"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          {idx + 1}
                        </div>

                        {/* Detail Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {entry.isAudit ? (
                            <>
                              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                {/* Timestamp Pill in IST */}
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                    color: "#1e40af",
                                    background: "#dbeafe",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    letterSpacing: "0.01em",
                                  }}
                                >
                                  <Clock size={12} />
                                  {entry.timestamp}
                                </span>

                                {/* Status Transition or Action Text */}
                                {entry.fromStatus && entry.toStatus ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--text-main)" }}>
                                    <span style={{
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      background: "#f1f5f9",
                                      border: "1px solid #cbd5e1",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      color: "#475569"
                                    }}>
                                      {entry.fromStatus}
                                    </span>
                                    <span style={{ color: "#94a3b8", fontWeight: 700 }}>&rarr;</span>
                                    <span style={{
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      background: entry.toStatus === "OnHold" ? "#fef3c7" : entry.toStatus === "Cancelled" ? "#fee2e2" : "#dbeafe",
                                      color: entry.toStatus === "OnHold" ? "#b45309" : entry.toStatus === "Cancelled" ? "#b91c1c" : "#1d4ed8",
                                      border: `1px solid ${entry.toStatus === "OnHold" ? "#fde68a" : entry.toStatus === "Cancelled" ? "#fca5a5" : "#bfdbfe"}`,
                                      fontSize: "0.75rem",
                                      fontWeight: 700
                                    }}>
                                      {entry.toStatus}
                                    </span>
                                    {entry.actor && (
                                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: 2 }}>
                                        by <strong>{entry.actor}</strong>
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
                                    {entry.action}
                                  </span>
                                )}
                              </div>

                              {/* Message / Reason */}
                              {entry.message && (
                                <div
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "var(--text-main)",
                                    lineHeight: 1.5,
                                    padding: "8px 12px",
                                    borderRadius: 6,
                                    background: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                  }}
                                >
                                  <span style={{ fontWeight: 600, color: "var(--text-muted)", marginRight: 6 }}>Reason:</span>
                                  <span style={{ color: "#1e293b" }}>{entry.message}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div>
                              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#059669", marginBottom: 4 }}>
                                Note / Instruction
                              </div>
                              <div style={{ fontSize: "0.85rem", color: "var(--text-main)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                {entry.message}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                  <div>Loading curriculum schedule and sessions...</div>
                </div>
              ) : scheduledSessions.length === 0 && sessions.length === 0 ? (
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
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* SECTION 1: INGESTED CURRICULUM SCHEDULE */}
                  {scheduledSessions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                            Curriculum Schedule ({scheduledSessions.length} Days)
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: "0.775rem" }}>
                          <span style={{ color: "#166534", fontWeight: 700, background: "#dcfce7", padding: "2px 8px", borderRadius: 12 }}>
                            ✓ {scheduledSessions.filter((s) => s.utilization_logged).length} Delivered
                          </span>
                          <span style={{ color: "#b45309", fontWeight: 700, background: "#fef3c7", padding: "2px 8px", borderRadius: 12 }}>
                            ⏳ {scheduledSessions.filter((s) => !s.utilization_logged).length} Pending
                          </span>
                        </div>
                      </div>

                      {scheduledSessions.map((s, idx) => (
                        <div
                          key={s.id}
                          className="glass-panel"
                          style={{
                            padding: "14px 16px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 12,
                            background: "#ffffff",
                            borderLeft: s.utilization_logged ? "4px solid #16a34a" : "4px solid #f59e0b",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                              width: 44,
                              height: 44,
                              borderRadius: 8,
                              background: s.utilization_logged ? "#f0fdf4" : "#fffbeb",
                              color: s.utilization_logged ? "#16a34a" : "#d97706",
                              border: `1px solid ${s.utilization_logged ? "#bbf7d0" : "#fde68a"}`,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              flexShrink: 0
                            }}>
                              <span style={{ fontSize: "0.65rem", textTransform: "uppercase", opacity: 0.8 }}>Day</span>
                              <span style={{ fontSize: "0.95rem" }}>{s.sequence_number || idx + 1}</span>
                            </div>

                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.925rem", color: "var(--text-main)" }}>
                                {s.module}
                              </div>
                              <div style={{ fontSize: "0.775rem", color: "var(--text-muted)", marginTop: 3, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                                <span>📅 {formatDate(s.session_date)} ({s.day_name || ""})</span>
                                <span>•</span>
                                <span>⏱️ {s.start_time ? String(s.start_time).slice(0, 5) : "09:30"} - {s.end_time ? String(s.end_time).slice(0, 5) : "17:30"} ({s.duration_hours} hrs)</span>
                                <span>•</span>
                                <span>👨‍🏫 Scheduled: <strong>{s.trainer_name || activeBatch.faculty_assigned_text || "Faculty assigned"}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {s.utilization_logged ? (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  background: "#f0fdf4",
                                  color: "#166534",
                                  border: "1px solid #bbf7d0",
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  fontSize: "0.775rem",
                                  fontWeight: 700
                                }}>
                                  <CheckCircle2 size={14} color="#16a34a" />
                                  Delivered & Logged
                                </span>
                                {s.actual_trainer && (
                                  <span style={{ fontSize: "0.725rem", color: "var(--text-muted)", marginTop: 2 }}>
                                    By {s.actual_trainer} ({s.actual_hours}h)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  background: "#fffbeb",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  fontSize: "0.75rem",
                                  fontWeight: 600
                                }}>
                                  <Clock size={12} />
                                  Pending Delivery
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openScheduledSessionEdit(s)}
                                  className="btn btn-secondary"
                                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", fontSize: "0.8rem" }}
                                  title="Edit parsed timetable row"
                                >
                                  <Edit3 size={14} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openLogUtilizationModal(s)}
                                  className="btn btn-primary"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "6px 12px",
                                    fontSize: "0.8rem",
                                    background: "#2563eb"
                                  }}
                                >
                                  <span>Log Utilization</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SECTION 2: FACULTY UTILIZATION / DELIVERY LEDGER */}
                  {sessions.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: scheduledSessions.length > 0 ? 8 : 0 }}>
                      <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 6 }}>
                        <Users size={14} color="#0b5cab" />
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", textTransform: "uppercase" }}>
                          Faculty Utilization & Delivery Ledger ({sessions.length} Recorded)
                        </span>
                      </div>
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
                            <span>📅 {formatDate(s.date_of_training)}</span>
                            <span>•</span>
                            <span>⏱️ {s.start_time || "09:00"} - {s.end_time || "17:00"} ({s.no_of_hours} hrs)</span>
                            <span>•</span>
                            <span>👨‍🏫 {s.faculty_name || "Assigned Faculty"}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {!(["Completed", "Cancelled", "Not Conducted"].includes(s.status)) && (
                          <>
                            <button onClick={() => handleEditSession(s)} className="btn btn-secondary" style={{ padding: "5px 8px", fontSize: "0.72rem" }}>
                              Edit
                            </button>
                            <button onClick={() => handleSessionOutcome(s, "not-conducted")} className="btn btn-secondary" style={{ padding: "5px 8px", fontSize: "0.72rem" }}>
                              Not conducted
                            </button>
                            <button onClick={() => handleSessionOutcome(s, "cancel")} className="btn btn-secondary" style={{ padding: "5px 8px", fontSize: "0.72rem" }}>
                              Cancel
                            </button>
                          </>
                        )}
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
            </div>
          )}

          {/* TAB 3: QUALITY CHECKPOINTS */}
          {activeTab === "quality_gates" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Average Batch Feedback Summary */}
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
                    Average Batch Feedback: Module & Session Feedback
                  </h4>
                </div>
                <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", margin: "0 0 12px 0" }}>
                  Triggered at session completion. Captures student attendance and student feedback ratings (1.0 to 5.0).
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Average Batch Feedback Rating</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: 2 }}>
                      {allSessionsCompleted
                        ? (batch.batch_avg_feedback ? (
                            <span style={{ color: "#b45309" }}>{batch.batch_avg_feedback} / 5.0</span>
                          ) : (
                            <span style={{ color: "var(--text-dim)" }}>No feedback submitted</span>
                          ))
                        : (
                          <span style={{ color: "#0b5cab" }}>Awaiting all sessions to complete</span>
                        )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Completed Sessions</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: allSessionsCompleted ? "#16a34a" : "#0b5cab", marginTop: 2 }}>
                      {completedSessions} / {sessions.length}
                      {allSessionsCompleted && <span style={{ fontSize: "0.7rem", marginLeft: 6, color: "#16a34a", fontWeight: 700 }}>✓ All Complete</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* NPS Closure Summary & Closure Action */}
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
                    NPS Closure: Final Batch NPS & Retrospective Closure
                  </h4>
                </div>
                <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", margin: "0 0 14px 0" }}>
                  Import the final feedback workbook first. The system calculates NPS from promoters, passive responses, and detractors before closure.
                </p>

                {batch.status !== "Completed" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                    <label style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      border: "1px dashed #9bb9d8",
                      borderRadius: 8,
                      background: "#f8fbff",
                      cursor: "pointer",
                    }}>
                      <Upload size={18} color="#0b5cab" />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-main)" }}>
                          {feedbackFile ? feedbackFile.name : "Choose feedback workbook"}
                        </span>
                        <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {feedbackFile ? `${(feedbackFile.size / 1024 / 1024).toFixed(2)} MB selected` : "Excel or CSV, up to 10 MB"}
                        </span>
                      </span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0b5cab" }}>Browse</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(event) => {
                          const selected = event.target.files?.[0] || null;
                          if (selected && selected.size > 10 * 1024 * 1024) {
                            setFeedbackFile(null);
                            setFeedbackImportMessage("File is too large. Choose a file smaller than 10 MB.");
                            return;
                          }
                          setFeedbackFile(selected);
                          setFeedbackImportMessage(null);
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={handleImportFeedback} disabled={!feedbackFile || isImportingFeedback} className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {isImportingFeedback && <RefreshCw size={14} className="animate-spin" />}
                        {isImportingFeedback ? "Importing workbook..." : "Import final feedback"}
                      </button>
                      {feedbackImportMessage && (
                        <span style={{ fontSize: "0.78rem", color: feedbackImportMessage.startsWith("Imported") ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                          {feedbackImportMessage}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {batch.status === "Completed" ? (
                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 6,
                    padding: "14px 16px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#16a34a", fontWeight: 700 }}>
                      <CheckCircle2 size={16} />
                      <span>NPS Closure Completed & Batch Formally Closed</span>
                    </div>
                    <div style={{ display: "flex", gap: 24, marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Final Batch NPS</div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#16a34a" }}>
                          {batch.batch_nps}
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
                      <span>Execute NPS Closure (Close Batch)</span>
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
          background: "#f8fafc",
          gap: 12,
          flexWrap: "wrap",
        }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close Details
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Batch Lifecycle Status Actions (OnHold / Cancelled / Resume) */}
            {activeBatch.status !== "Cancelled" && (
              <>
                {activeBatch.status !== "OnHold" ? (
                  <button
                    type="button"
                    onClick={() => openStatusModal("OnHold")}
                    className="btn btn-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#b45309",
                      borderColor: "#fcd34d",
                      background: "#fffbeb",
                    }}
                    title="Place batch delivery on hold"
                  >
                    <PauseCircle size={15} color="#b45309" />
                    <span>Put On Hold</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openStatusModal("Resume")}
                    className="btn btn-secondary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "#059669",
                      borderColor: "#a7f3d0",
                      background: "#ecfdf5",
                    }}
                    title="Resume and reactivate batch"
                  >
                    <PlayCircle size={15} color="#059669" />
                    <span>Resume Batch</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openStatusModal("Cancelled")}
                  className="btn btn-secondary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#b91c1c",
                    borderColor: "#fca5a5",
                    background: "#fef2f2",
                  }}
                  title="Cancel batch"
                >
                  <Ban size={15} color="#b91c1c" />
                  <span>Cancel Batch</span>
                </button>
              </>
            )}

            {activeBatch.status === "Cancelled" && (
              <button
                type="button"
                onClick={() => openStatusModal("Resume")}
                className="btn btn-secondary"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#0b5cab",
                  borderColor: "#93c5fd",
                  background: "#eff6ff",
                }}
                title="Reopen cancelled batch"
              >
                <RefreshCw size={15} color="#0b5cab" />
                <span>Reopen Batch</span>
              </button>
            )}

            {/* Edit Batch (Always available for active editing and post-approval adjustments) */}
            <button
              onClick={openEditModal}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Edit3 size={15} />
              <span>Edit Batch</span>
            </button>

            {canApprove && ["Requested", "Approval 1 Pending", "Approval 2 Pending"].includes(activeBatch.status) && onOpenApprove && (
              <button
                onClick={() => {
                  onClose();
                  onOpenApprove(activeBatch);
                }}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #0f7a5a 0%, #169570 100%)" }}
              >
                <CheckCircle2 size={16} />
                <span>Approve Batch</span>
              </button>
            )}
          </div>
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
          zIndex: 1050,
          padding: 16
        }} onClick={() => setIsAddSessionOpen(false)}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, padding: 24, background: "#ffffff" }}>
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

      {editingScheduledSession && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1060, padding: 16 }} onClick={() => setEditingScheduledSession(null)}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 5px" }}>Edit Scheduled Session</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 16px" }}>Correct any missing or incorrectly parsed timetable details.</p>
            {scheduledEditError && <div style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 10px", borderRadius: 6, fontSize: "0.8rem", marginBottom: 12 }}>{scheduledEditError}</div>}
            <form onSubmit={saveScheduledSessionEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Module / Topic *<input required value={scheduledEditForm.module} className="glass-input" style={{ width: "100%", marginTop: 4 }} onChange={(e) => setScheduledEditForm({ ...scheduledEditForm, module: e.target.value })} /></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Date *<input required type="date" value={scheduledEditForm.session_date} className="glass-input" style={{ width: "100%", marginTop: 4 }} onChange={(e) => setScheduledEditForm({ ...scheduledEditForm, session_date: e.target.value })} /></label>
                <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Hours *<input required type="number" min={1} max={24} value={scheduledEditForm.duration_hours} className="glass-input" style={{ width: "100%", marginTop: 4 }} onChange={(e) => setScheduledEditForm({ ...scheduledEditForm, duration_hours: Number(e.target.value) })} /></label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Start time<input type="time" value={scheduledEditForm.start_time} className="glass-input" style={{ width: "100%", marginTop: 4 }} onChange={(e) => setScheduledEditForm({ ...scheduledEditForm, start_time: e.target.value })} /></label>
                <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>End time<input type="time" value={scheduledEditForm.end_time} className="glass-input" style={{ width: "100%", marginTop: 4 }} onChange={(e) => setScheduledEditForm({ ...scheduledEditForm, end_time: e.target.value })} /></label>
              </div>
              <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Faculty<input value={scheduledEditForm.trainer_name} className="glass-input" style={{ width: "100%", marginTop: 4 }} onChange={(e) => setScheduledEditForm({ ...scheduledEditForm, trainer_name: e.target.value })} /></label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingScheduledSession(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSavingScheduledEdit}>{isSavingScheduledEdit ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Average Batch Feedback Completion */}
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
          zIndex: 1050,
          padding: 16
        }} onClick={() => setCompletingSession(null)}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 6px 0" }}>
              Average Batch Feedback: Complete Session
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
                  Topic Feedback / Notes *
                </label>
                <textarea
                  value={gate1Feedback}
                  onChange={(e) => setGate1Feedback(e.target.value)}
                  placeholder="Student comprehension, lab completion notes..."
                  className="glass-input"
                  style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                  required
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                  Add at least 3 characters before completing the session.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setCompletingSession(null)} className="btn btn-secondary" style={{ padding: "8px 14px" }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingGate1 || gate1Feedback.trim().length < 3} className="btn btn-primary" style={{ padding: "8px 14px" }}>
                  {isSubmittingGate1 ? "Completing..." : "Submit Average Batch Feedback & Complete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: NPS Closure */}
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
          zIndex: 1050,
          padding: 16
        }} onClick={() => setIsGate2ModalOpen(false)}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 500, padding: 24, background: "#ffffff" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 6px 0" }}>
              NPS Closure: Batch NPS Closure
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
                  {isSubmittingGate2 ? "Closing Batch..." : "Formally Close Batch (NPS Closure)"}
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
          zIndex: 1050,
          padding: 16
        }} onClick={() => setIsIngestModalOpen(false)}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 24, background: "#ffffff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Workflow 2: Timetable Ingestion & Conflict Engine
                </h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                  Upload `.xlsx` / `.csv` schedule, run dry-run conflict check, and batch schedule.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <a
                    href="/batch_schedule_january_2027.xlsx"
                    download="batch_schedule_january_2027.xlsx"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#1e40af",
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      padding: "4px 10px",
                      borderRadius: 6,
                      textDecoration: "none",
                    }}
                  >
                    <FileSpreadsheet size={14} color="#2563eb" />
                    <span>Download January 2027 Schedule Template (.xlsx)</span>
                  </a>
                </div>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {ingestSummary && (
                  <div style={{
                    background: ingestSummary.extractedRows > 0 ? "#f0fdf4" : "#fff7ed",
                    border: `1px solid ${ingestSummary.extractedRows > 0 ? "#bbf7d0" : "#fed7aa"}`,
                    color: ingestSummary.extractedRows > 0 ? "#166534" : "#9a3412",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: "0.8rem",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700 }}>
                      {ingestSummary.extractedRows > 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                      <span>{ingestSummary.message}</span>
                    </div>
                    <div style={{ marginTop: 5 }}>
                      Parsed {ingestSummary.extractedRows} row(s); skipped {ingestSummary.failedRows}.
                    </div>
                    {ingestSummary.errors.length > 0 && (
                      <ul style={{ margin: "6px 0 0 18px", padding: 0, maxHeight: 120, overflowY: "auto" }}>
                        {ingestSummary.errors.slice(0, 20).map((error, index) => <li key={index}>{error}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                <form onSubmit={handleIngestFileSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{
                  border: "2px dashed var(--border-subtle)",
                  borderRadius: 8,
                  padding: "32px 20px",
                  textAlign: "center",
                  background: "#f8fafc",
                  cursor: "pointer"
                }}>
                  <Upload size={32} style={{ margin: "0 auto 10px", color: "#0b5cab" }} />
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>
                    {ingestFile ? ingestFile.name : "Select Timetable Spreadsheet"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>
                    {ingestFile ? `${(ingestFile.size / 1024 / 1024).toFixed(2)} MB selected` : "Excel or CSV, up to 10 MB"}
                  </div>
                  <label className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14, cursor: "pointer" }}>
                    <FileSpreadsheet size={15} />
                    <span>{ingestFile ? "Choose another file" : "Browse files"}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const selected = e.target.files?.[0] || null;
                        if (selected && selected.size > 10 * 1024 * 1024) {
                          setIngestFile(null);
                          setIngestError("File is too large. Choose a timetable smaller than 10 MB.");
                          return;
                        }
                        setIngestFile(selected);
                        setIngestError(null);
                      }}
                      style={{ display: "none" }}
                      required
                    />
                  </label>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button type="button" onClick={() => setIsIngestModalOpen(false)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={!ingestFile || isIngesting} className="btn btn-primary">
                    {isIngesting ? "Extracting timetable..." : "Parse Timetable"}
                  </button>
                </div>
                </form>
              </div>
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
                        <th style={{ padding: "8px 12px" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedRows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                            {editingParsedRow === i ? <input type="date" value={r.date_of_training.slice(0, 10)} className="glass-input" onChange={(e) => setExtractedRows(rows => rows.map((row, index) => index === i ? { ...row, date_of_training: e.target.value } : row))} /> : formatDate(r.date_of_training)}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {editingParsedRow === i ? <input value={r.topic} className="glass-input" style={{ minWidth: 220 }} onChange={(e) => setExtractedRows(rows => rows.map((row, index) => index === i ? { ...row, topic: e.target.value } : row))} /> : r.topic}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {editingParsedRow === i ? <input value={r.faculty_name || ""} className="glass-input" onChange={(e) => setExtractedRows(rows => rows.map((row, index) => index === i ? { ...row, faculty_name: e.target.value } : row))} /> : r.faculty_name || "—"}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            {editingParsedRow === i ? <input type="number" min={1} max={24} value={r.no_of_hours} className="glass-input" style={{ width: 72 }} onChange={(e) => setExtractedRows(rows => rows.map((row, index) => index === i ? { ...row, no_of_hours: Number(e.target.value) } : row))} /> : `${r.no_of_hours}h`}
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <button type="button" className="btn btn-secondary" style={{ padding: "5px 9px", display: "inline-flex", alignItems: "center", gap: 4 }} onClick={() => { setEditingParsedRow(editingParsedRow === i ? null : i); setHasValidated(false); setValidationConflicts([]); }}>
                              {editingParsedRow === i ? <Check size={13} /> : <Edit3 size={13} />}
                              {editingParsedRow === i ? "Done" : "Edit"}
                            </button>
                          </td>
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

      {/* Modal: Edit Batch */}
      {isEditModalOpen && (
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
          zIndex: 1050,
          padding: 16
        }} onClick={() => setIsEditModalOpen(false)}>
          <div className="glass-panel" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 660, maxHeight: "90vh", overflowY: "auto", padding: 24, background: "#ffffff", borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                  Edit Batch Details
                </h3>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                  Modifying <strong>{activeBatch.batch_id}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#f43f5e",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: "0.825rem",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 14
              }}>
                <AlertCircle size={15} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Curriculum / Program Title *
                </label>
                <input
                  type="text"
                  value={editForm.program_name || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, program_name: e.target.value }))}
                  className="glass-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Client Account Name *
                </label>
                <input
                  type="text"
                  value={editForm.client_name || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, client_name: e.target.value }))}
                  className="glass-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Client SOW / PO Number *
                </label>
                <input
                  type="text"
                  value={editForm.sow_number || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, sow_number: e.target.value }))}
                  className="glass-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Technology Domain
                </label>
                <input
                  type="text"
                  value={editForm.domain || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, domain: e.target.value }))}
                  className="glass-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Technology Stack
                </label>
                <input
                  type="text"
                  value={editForm.technology || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, technology: e.target.value }))}
                  className="glass-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Delivery Mode
                </label>
                <select
                  value={editForm.delivery_mode || "Online"}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const matched = options.delivery_modes.find((m) => m.name === selectedName);
                    setEditForm((prev) => ({
                      ...prev,
                      delivery_mode: selectedName,
                      delivery_mode_id: matched ? matched.id : prev.delivery_mode_id,
                    }));
                  }}
                  className="glass-input"
                >
                  {options.delivery_modes.length > 0 ? (
                    options.delivery_modes.map((mode) => (
                      <option key={mode.id} value={mode.name}>
                        {mode.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Online">Online</option>
                      <option value="F2F">F2F</option>
                      <option value="Blended">Blended</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Training Venue / City
                </label>
                <input
                  type="text"
                  value={editForm.location_city || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, location_city: e.target.value }))}
                  className="glass-input"
                  placeholder="e.g. Bengaluru"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Commencement Date
                </label>
                <input
                  type="date"
                  value={editForm.start_date || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, start_date: e.target.value }))}
                  className="glass-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Conclusion Date
                </label>
                <input
                  type="date"
                  value={editForm.end_date || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, end_date: e.target.value }))}
                  className="glass-input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Active Training Days
                </label>
                <input
                  type="number"
                  value={editForm.training_days || 0}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, training_days: Number(e.target.value) }))}
                  className="glass-input"
                  min={0}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Total Training Hours
                </label>
                <input
                  type="number"
                  value={editForm.total_hours || 0}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, total_hours: Number(e.target.value) }))}
                  className="glass-input"
                  min={0}
                  step={0.5}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Total Candidate Headcount
                </label>
                <input
                  type="number"
                  value={editForm.total_enrollments || 0}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, total_enrollments: Number(e.target.value) }))}
                  className="glass-input"
                  min={1}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Proposed Faculty Member(s)
                </label>
                <input
                  type="text"
                  value={editForm.faculty_assigned_text || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, faculty_assigned_text: e.target.value }))}
                  placeholder="e.g. Dr. Srinivas Rao, Ananya Sharma"
                  className="glass-input"
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Operational Remarks
                </label>
                <textarea
                  value={editForm.remarks || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  rows={2}
                  className="glass-input"
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn btn-primary"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Batch Lifecycle Status Transition (OnHold / Cancelled / Resume) */}
      {isStatusModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            zIndex: 1100,
            padding: 16,
            overflowY: "auto",
          }}
          onClick={() => setIsStatusModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 490,
              width: "100%",
              background: "#ffffff",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: "18px 22px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: targetStatus === "Cancelled" ? "#fef2f2" : targetStatus === "OnHold" ? "#fffbeb" : "#f0fdf4",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {targetStatus === "Cancelled" ? (
                  <Ban size={22} color="#e11d48" />
                ) : targetStatus === "OnHold" ? (
                  <PauseCircle size={22} color="#d97706" />
                ) : (
                  <PlayCircle size={22} color="#16a34a" />
                )}
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
                    {targetStatus === "Cancelled" ? "Cancel Batch" : targetStatus === "OnHold" ? "Put Batch On Hold" : "Reactivate / Resume Batch"}
                  </h3>
                  <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    Batch Reference: <strong>{activeBatch.batch_id}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStatusModalOpen(false);
                }}
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveStatus} style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              {statusError && (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#f43f5e",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: "0.825rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <AlertCircle size={15} />
                  <span>{statusError}</span>
                </div>
              )}

              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                {targetStatus === "Cancelled" ? (
                  <span>
                    Are you sure you want to cancel this batch? This will halt operations and record an official cancellation note.
                  </span>
                ) : targetStatus === "OnHold" ? (
                  <span>
                    Placing this batch on hold will pause delivery milestones and notify coordinators and managers.
                  </span>
                ) : (
                  <span>
                    Resuming this batch will continue its workflow at <strong>{targetStatus}</strong>.
                  </span>
                )}
              </div>

              {targetStatus !== "OnHold" && targetStatus !== "Cancelled" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Target Resumed Status *
                  </label>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                  >
                    {activeBatch.approver_1_status !== "Approved" && (
                      <option value="Approval 1 Pending">Approval 1 Pending (Approver 1 Review)</option>
                    )}
                    {activeBatch.approver_1_status === "Approved" && activeBatch.approver_2_status !== "Approved" && (
                      <option value="Approval 2 Pending">Approval 2 Pending (Approver 2 Review)</option>
                    )}
                    {activeBatch.approver_1_status === "Approved" && activeBatch.approver_2_status === "Approved" && (
                      <>
                        <option value="Approved">Approved</option>
                        <option value="Upcoming">Upcoming</option>
                        <option value="Ongoing">Ongoing</option>
                      </>
                    )}
                    {(activeBatch.approver_1_status === "Rejected" || activeBatch.approver_2_status === "Rejected") && (
                      <option value="Requested">Requested (Revisions Needed)</option>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Reason / Justification *
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder={
                    targetStatus === "Cancelled"
                      ? "e.g. Client cancelled training contract due to internal budget reallocation..."
                      : targetStatus === "OnHold"
                      ? "e.g. Client requested start date deferral until curriculum revision is finalized..."
                      : "e.g. Client confirmed new schedule and faculty availability verified..."
                  }
                  rows={3}
                  className="glass-input"
                  style={{ width: "100%", resize: "vertical" }}
                  required
                />
                <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 4, display: "block" }}>
                  A clear reason (minimum 3 characters) is required for audit and governance compliance.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStatusModalOpen(false);
                  }}
                  className="btn btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStatus || statusReason.trim().length < 3}
                  className="btn btn-primary"
                  style={{
                    padding: "8px 16px",
                    fontSize: "0.85rem",
                    background: targetStatus === "Cancelled" ? "#e11d48" : targetStatus === "OnHold" ? "#d97706" : "#059669",
                  }}
                >
                  {isSubmittingStatus ? "Saving..." : targetStatus === "Cancelled" ? "Confirm Cancellation" : targetStatus === "OnHold" ? "Confirm On Hold" : "Confirm Resume"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Faculty Utilization on Session Day */}
      {isLogUtilizationOpen && selectedScheduleDay && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 16,
          }}
          onClick={() => setIsLogUtilizationOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 540,
              width: "100%",
              maxHeight: "calc(100vh - 32px)",
              background: "#ffffff",
              borderRadius: 14,
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "#eff6ff",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
                    Log Faculty Utilization
                  </h3>
                  <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                    Day {selectedScheduleDay.sequence_number} • {formatDate(selectedScheduleDay.session_date)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLogUtilizationOpen(false);
                }}
                style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message */}
            {utilError && (
              <div style={{ margin: "16px 22px 0", background: "#fef2f2", border: "1px solid #fecaca", color: "#e11d48", padding: "10px 14px", borderRadius: 8, fontSize: "0.825rem" }}>
                {utilError}
              </div>
            )}

            {/* Pre-filled Curriculum Context Banner */}
            <div style={{ margin: "16px 22px", padding: "12px 14px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "0.825rem" }}>
              <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>
                Curriculum Topic / Module:
              </div>
              <div style={{ color: "#1e293b", fontWeight: 600 }}>
                {selectedScheduleDay.module}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 6, color: "#475569", fontSize: "0.775rem" }}>
                <span>Scheduled Trainer: <strong>{selectedScheduleDay.trainer_name || activeBatch.faculty_assigned_text || "Unassigned"}</strong></span>
                <span>•</span>
                <span>Planned Hours: <strong>{selectedScheduleDay.duration_hours} hrs</strong></span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleLogUtilizationSubmit} style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Training Topic / Module *
                </label>
                <input
                  type="text"
                  value={utilTopic}
                  onChange={(e) => setUtilTopic(e.target.value)}
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Training Date *</label>
                  <input type="date" value={utilDate} onChange={(e) => setUtilDate(e.target.value)} className="glass-input" style={{ width: "100%" }} required />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Start Time *</label>
                  <input type="time" value={utilStartTime} onChange={(e) => setUtilStartTime(e.target.value)} className="glass-input" style={{ width: "100%" }} required />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>End Time *</label>
                  <input type="time" value={utilEndTime} onChange={(e) => setUtilEndTime(e.target.value)} className="glass-input" style={{ width: "100%" }} required />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Actual Faculty / Trainer Name *
                </label>
                <input
                  type="text"
                  value={utilFacultyName}
                  onChange={(e) => setUtilFacultyName(e.target.value)}
                  placeholder="Trainer full name"
                  className="glass-input"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Actual Hours Delivered *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={utilHours}
                    onChange={(e) => setUtilHours(parseFloat(e.target.value) || 0)}
                    className="glass-input"
                    style={{ width: "100%" }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Location City
                  </label>
                  <input
                    type="text"
                    value={utilCity}
                    onChange={(e) => setUtilCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="glass-input"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Delivery Mode *
                  </label>
                  <select
                    value={utilDeliveryMode}
                    onChange={(e) => setUtilDeliveryMode(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                    required
                  >
                    {options.delivery_modes.length > 0 ? (
                      options.delivery_modes.map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Online">Online</option>
                        <option value="F2F">F2F</option>
                        <option value="Blended">Blended</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Venue / Room
                  </label>
                  <input
                    type="text"
                    value={utilVenue}
                    onChange={(e) => setUtilVenue(e.target.value)}
                    placeholder="e.g. MS Teams Room 1 / Lab 3"
                    className="glass-input"
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                    Delivery Status *
                  </label>
                  <select
                    value={utilStatus}
                    onChange={(e) => setUtilStatus(e.target.value)}
                    className="glass-input"
                    style={{ width: "100%" }}
                    required
                  >
                    <option value="Completed">Completed / Delivered</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Scheduled">Scheduled</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                  Was Feedback Collected? *
                </label>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      value="yes"
                      checked={utilFeedbackCollected === "yes"}
                      onChange={(e) => setUtilFeedbackCollected("yes")}
                      style={{ accentColor: "#0b5cab" }}
                    />
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Yes</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      value="no"
                      checked={utilFeedbackCollected === "no"}
                      onChange={(e) => setUtilFeedbackCollected("no")}
                      style={{ accentColor: "#0b5cab" }}
                    />
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>No</span>
                  </label>
                </div>
              </div>

              {utilFeedbackCollected === "yes" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                      Feedback Rating (1-5) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="0.5"
                      value={utilFeedbackRating}
                      onChange={(e) => setUtilFeedbackRating(Number(e.target.value) || 0)}
                      className="glass-input"
                      style={{ width: "100%" }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                      Feedback Notes *
                    </label>
                    <textarea
                      value={utilFeedbackNotes}
                      onChange={(e) => setUtilFeedbackNotes(e.target.value)}
                      placeholder="Session summary, observations, learner uptake, or notes for later audit review"
                      className="glass-input"
                      style={{ width: "100%", minHeight: 72, resize: "vertical" }}
                      required
                    />
                  </div>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  type="button"
                  onClick={() => setIsLogUtilizationOpen(false)}
                  className="btn btn-secondary"
                  style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUtil || !utilFacultyName.trim()}
                  className="btn btn-primary"
                  style={{ padding: "8px 18px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}
                >
                  {isSubmittingUtil ? "Saving..." : "Save Faculty Utilization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
