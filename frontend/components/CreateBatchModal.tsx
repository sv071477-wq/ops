"use client";

import React, { useEffect, useState } from "react";
import { api, BatchOption, CreateBatchPayload, User } from "@/lib/api";
import {
  X,
  AlertCircle,
  Check,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Users,
  Building,
  Plus,
  Info,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchCreated: () => void;
}

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({ isOpen, onClose, onBatchCreated }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  const [formData, setFormData] = useState<CreateBatchPayload>({
    batch_id: "",
    program_name: "",
    client_name: "",
    category: "",
    category_id: "",
    entity_id: "",
    domain: "",
    technology: "",
    delivery_mode: "Online",
    delivery_mode_id: "",
    location_city: "",
    accommodation_id: "",
    residential_type: "NR",
    start_date: "",
    end_date: "",
    total_enrollments: 0,
    residential_enrollments: 0,
    non_residential_enrollments: 0,
    training_days: 0,
    total_hours: 0,
    sow_number: "",
    sales_spoc_id: "",
    coordinator_id: "",
    primary_manager_id: "",
    faculty_assigned_text: "",
    remarks: "",
  });

  // Multiple faculty members management as chips
  const [facultyList, setFacultyList] = useState<string[]>([]);
  const [facultyInput, setFacultyInput] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<string, BatchOption[]>>({});
  const [assignableUsers, setAssignableUsers] = useState<Record<string, User[]>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setError(null);
      return;
    }

    Promise.all([
      api.getBatchOptions("entities"),
      api.getBatchOptions("categories"),
      api.getBatchOptions("delivery-modes"),
      api.getBatchOptions("accommodations"),
      api.getAssignableUsers("Sales"),
      api.getAssignableUsers("Coordinator"),
      api.getAssignableUsers("Manager"),
    ])
      .then(([entities, categories, modes, accommodations, sales, coordinators, managers]) => {
        setOptions({ entities, categories, modes, accommodations });
        setAssignableUsers({ sales, coordinators, managers });

        // Pre-select defaults if empty
        setFormData((prev) => {
          const updated = { ...prev };
          if (!updated.entity_id && entities.length > 0) {
            updated.entity_id = entities[0].id;
          }
          if (!updated.category_id && categories.length > 0) {
            updated.category_id = categories[0].id;
            updated.category = categories[0].name;
          }
          if (!updated.delivery_mode_id && modes.length > 0) {
            const defaultMode = modes.find((m) => m.name.toLowerCase() === "online") || modes[0];
            updated.delivery_mode_id = defaultMode.id;
            updated.delivery_mode = defaultMode.name;
          }
          if (!updated.accommodation_id && accommodations.length > 0) {
            const defaultAcc = accommodations.find((a) => a.name.toLowerCase().includes("non")) || accommodations[0];
            updated.accommodation_id = defaultAcc.id;
            updated.residential_type = defaultAcc.name.toLowerCase().includes("non") ? "NR" : "R";
          }
          return updated;
        });
      })
      .catch((err) => setError(err.message || "Failed to load configuration options"));
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedDeliveryMode =
    (options["delivery-modes"] || options.modes || []).find((option) => option.id === formData.delivery_mode_id)?.name ||
    formData.delivery_mode ||
    "Online";

  const requiresLocation = ["F2F", "Blended"].includes(selectedDeliveryMode);

  const calendarDays =
    formData.start_date && formData.end_date
      ? Math.max(
          0,
          Math.round((new Date(formData.end_date).getTime() - new Date(formData.start_date).getTime()) / 86400000)
        )
      : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setError(null);

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === "delivery_mode_id") {
        const selectedMode = (options["delivery-modes"] || options.modes || []).find((m) => m.id === value)?.name || "Online";
        updated.delivery_mode = selectedMode;
        if (selectedMode === "Online") {
          updated.location_city = "";
        }
      }

      if (name === "category_id") {
        const catName = (options.categories || []).find((c) => c.id === value)?.name || "";
        updated.category = catName;
      }

      if (name === "accommodation_id") {
        const acc = (options.accommodations || []).find((a) => a.id === value);
        const isResi = acc ? !acc.name.toLowerCase().includes("non") : false;
        updated.residential_type = isResi ? "R" : "NR";
      }

      // Automatically maintain candidate enrollment distribution
      if (name === "total_enrollments") {
        const total = Math.max(0, parseInt(value, 10) || 0);
        updated.total_enrollments = total;
        updated.non_residential_enrollments = total;
        updated.residential_enrollments = 0;
      }

      // Suggest training hours when training days changes
      if (name === "training_days") {
        const days = Math.max(0, parseInt(value, 10) || 0);
        updated.training_days = days;
        if (!prev.total_hours || prev.total_hours === Number(prev.training_days) * 8) {
          updated.total_hours = days * 8;
        }
      }

      return updated;
    });
  };

  // Multiple faculty management functions
  const handleAddFaculty = () => {
    const trimmed = facultyInput.trim();
    if (!trimmed) return;

    // Support comma separated addition as well
    const incomingNames = trimmed
      .split(/[,;]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    const updated = Array.from(new Set([...facultyList, ...incomingNames]));
    setFacultyList(updated);
    setFacultyInput("");
    setFormData((prev) => ({
      ...prev,
      faculty_assigned_text: updated.join(", "),
    }));
  };

  const handleRemoveFaculty = (nameToRemove: string) => {
    const updated = facultyList.filter((f) => f !== nameToRemove);
    setFacultyList(updated);
    setFormData((prev) => ({
      ...prev,
      faculty_assigned_text: updated.join(", "),
    }));
  };

  const handleFacultyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddFaculty();
    }
  };

  // Step-by-step validation guards
  const validateStep = (step: number): boolean => {
    setError(null);

    if (step === 1) {
      if (!formData.batch_id?.trim()) {
        setError("Batch Identifier / Code is required");
        return false;
      }
      if (!/^[A-Za-z0-9_\-.:]+$/.test(formData.batch_id.trim())) {
        setError("Batch Identifier can only contain letters, numbers, hyphens, and underscores");
        return false;
      }
      if (!formData.client_name?.trim()) {
        setError("Client Account Name is required");
        return false;
      }
      if (!formData.program_name?.trim()) {
        setError("Curriculum / Program Title is required");
        return false;
      }
      if (!formData.entity_id) {
        setError("Operating Entity is required");
        return false;
      }
      if (!formData.category_id) {
        setError("Training Category is required");
        return false;
      }
      if (!formData.domain?.trim()) {
        setError("Technology Domain is required");
        return false;
      }
      if (!formData.technology?.trim()) {
        setError("Technology Stack & Modules is required");
        return false;
      }
      return true;
    }

    if (step === 2) {
      if (!formData.delivery_mode_id) {
        setError("Delivery Mode is required");
        return false;
      }
      if (requiresLocation && !formData.location_city?.trim()) {
        setError(`Training Venue / City is mandatory for ${selectedDeliveryMode} delivery mode`);
        return false;
      }
      if (!formData.accommodation_id) {
        setError("Faculty Accommodation status is required");
        return false;
      }
      if (!formData.start_date) {
        setError("Commencement (Start) Date is required");
        return false;
      }
      if (!formData.end_date) {
        setError("Conclusion (End) Date is required");
        return false;
      }
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        setError("Conclusion (End) Date must be on or after Commencement (Start) Date");
        return false;
      }
      if (Number(formData.training_days) < 0) {
        setError("Active Training Days cannot be negative");
        return false;
      }
      if (Number(formData.total_hours) < 0) {
        setError("Total Training Hours cannot be negative");
        return false;
      }
      return true;
    }

    if (step === 3) {
      if (Number(formData.total_enrollments) <= 0) {
        setError("Total Candidate Headcount must be at least 1");
        return false;
      }
      return true;
    }

    if (step === 4) {
      if (!formData.sow_number || !String(formData.sow_number).trim()) {
        setError("Client SOW Number is mandatory for commercial tracking");
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload: CreateBatchPayload = {
        ...formData,
        batch_id: formData.batch_id.trim().toUpperCase(),
        program_name: formData.program_name.trim(),
        client_name: formData.client_name?.trim() || undefined,
        domain: formData.domain?.trim() || undefined,
        technology: formData.technology?.trim() || undefined,
        sow_number: formData.sow_number ? String(formData.sow_number).trim() : undefined,
        entity_id: formData.entity_id?.trim() || undefined,
        category_id: formData.category_id?.trim() || undefined,
        delivery_mode_id: formData.delivery_mode_id?.trim() || undefined,
        accommodation_id: formData.accommodation_id?.trim() || undefined,
        sales_spoc_id: formData.sales_spoc_id?.trim() || undefined,
        coordinator_id: formData.coordinator_id?.trim() || undefined,
        primary_manager_id: formData.primary_manager_id?.trim() || undefined,
        delivery_mode: selectedDeliveryMode,
        location_city: requiresLocation ? formData.location_city?.trim() || undefined : undefined,
        total_enrollments: Number(formData.total_enrollments) || 0,
        residential_enrollments: Number(formData.residential_enrollments) || 0,
        non_residential_enrollments: Number(formData.non_residential_enrollments) || 0,
        training_days: Number(formData.training_days) || 0,
        total_hours: Number(formData.total_hours) || 0,
        calendar_days: calendarDays,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : undefined,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : undefined,
        faculty_assigned_text: facultyList.length > 0 ? facultyList.join(", ") : formData.faculty_assigned_text?.trim() || undefined,
        remarks: formData.remarks?.trim() || undefined,
      };

      await api.createBatch(payload);
      onBatchCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create batch request");
    } finally {
      setIsLoading(false);
    }
  };

  // Step descriptor configuration
  const steps = [
    { num: 1, title: "Program & Client", icon: Building },
    { num: 2, title: "Schedule & Delivery", icon: Calendar },
    { num: 3, title: "Headcount & Faculty", icon: Users },
    { num: 4, title: "Review & SOW", icon: ShieldCheck },
  ];

  const getEntityName = (id?: string) => (options.entities || []).find((e) => e.id === id)?.name || "Not specified";
  const getCategoryName = (id?: string) => (options.categories || []).find((c) => c.id === id)?.name || formData.category || "Not specified";
  const getAccommodationName = (id?: string) => (options.accommodations || []).find((a) => a.id === id)?.name || "Not specified";
  const getUserName = (users?: User[], id?: string) => (users || []).find((u) => u.id === id)?.full_name || "Unassigned";

  return (
    <div className="modal-overlay">
      <div
        className="modal-content glass-panel"
        style={{
          maxWidth: 820,
          width: "95%",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid rgba(160, 190, 223, 0.8)",
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.16)",
        }}
      >
        {/* Header with Progress Bar */}
        <div
          style={{
            padding: "20px 28px 16px 28px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 250, 255, 0.94) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="badge badge-requested">Workflow 1: Batch Request</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Step {currentStep} of 4
                </span>
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-main)", marginTop: 4 }}>
                Create New Batch Request
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              style={{
                background: "rgba(226, 232, 240, 0.5)",
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
              <X size={18} />
            </button>
          </div>

          {/* Stepper Navigation */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 10 }}>
            {steps.map((step) => {
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;

              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => {
                    if (isCompleted) setCurrentStep(step.num as 1 | 2 | 3 | 4);
                  }}
                  disabled={!isCompleted && !isActive}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: isActive
                      ? "rgba(11, 92, 171, 0.08)"
                      : isCompleted
                      ? "rgba(15, 122, 90, 0.08)"
                      : "transparent",
                    border: isActive
                      ? "1px solid rgba(11, 92, 171, 0.4)"
                      : isCompleted
                      ? "1px solid rgba(15, 122, 90, 0.3)"
                      : "1px solid transparent",
                    cursor: isCompleted ? "pointer" : "default",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: isActive
                        ? "var(--primary)"
                        : isCompleted
                        ? "var(--emerald)"
                        : "rgba(148, 163, 184, 0.2)",
                      color: isActive || isCompleted ? "#ffffff" : "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    {isCompleted ? <Check size={13} strokeWidth={3} /> : step.num}
                  </div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: isActive ? "var(--primary)" : isCompleted ? "var(--emerald)" : "var(--text-muted)" }}>
                      {step.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Body Scrollable Area */}
        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                background: "rgba(244, 63, 94, 0.12)",
                border: "1px solid rgba(244, 63, 94, 0.35)",
                color: "#e11d48",
                padding: "12px 16px",
                borderRadius: 12,
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 20,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{error}</span>
            </div>
          )}

          {/* STEP 1: PROGRAM & CLIENT CONTEXT */}
          {currentStep === 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {/* Batch Identifier (Manual Entry) */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Batch Identifier / Code <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  type="text"
                  name="batch_id"
                  value={formData.batch_id}
                  onChange={handleChange}
                  placeholder="e.g. DEL_PYSPARK_2026_B1"
                  className="glass-input"
                  autoFocus
                  required
                />
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Enter the unique client batch code (e.g. CLIENT_TECH_YEAR_B#)
                </p>
              </div>

              {/* Client Name */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Client Account Name <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  type="text"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleChange}
                  placeholder="e.g. Deloitte USI, IBM, Capgemini"
                  className="glass-input"
                  required
                />
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Sponsoring enterprise client account
                </p>
              </div>

              {/* Program Curriculum Title */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Curriculum / Program Title <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  type="text"
                  name="program_name"
                  value={formData.program_name}
                  onChange={handleChange}
                  placeholder="e.g. Enterprise Big Data & PySpark Scala Immersion Bootcamp"
                  className="glass-input"
                  required
                />
              </div>

              {/* Operating Entity */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Operating Entity <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <select name="entity_id" value={formData.entity_id || ""} onChange={handleChange} className="glass-input" required>
                  <option value="">Select operating entity</option>
                  {(options.entities || []).map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Business division governing delivery
                </p>
              </div>

              {/* Training Category */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Training Category <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <select name="category_id" value={formData.category_id || ""} onChange={handleChange} className="glass-input" required>
                  <option value="">Select category</option>
                  {(options.categories || []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Format category (Bootcamp, RBT, PJP, Workshop)
                </p>
              </div>

              {/* Technology Domain */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Technology Domain <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  type="text"
                  name="domain"
                  value={formData.domain || ""}
                  onChange={handleChange}
                  placeholder="e.g. IT/ITES, Cloud & DevOps, Data Science, CyberSecurity"
                  className="glass-input"
                  required
                />
              </div>

              {/* Technology Stack & Modules */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Technology Stack & Modules <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  type="text"
                  name="technology"
                  value={formData.technology || ""}
                  onChange={handleChange}
                  placeholder="e.g. PySpark, Databricks, Scala, Delta Lake"
                  className="glass-input"
                  required
                />
              </div>
            </div>
          )}

          {/* STEP 2: SCHEDULE & DELIVERY LOGISTICS */}
          {currentStep === 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              {/* Delivery Mode */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Delivery Mode <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <select name="delivery_mode_id" value={formData.delivery_mode_id || ""} onChange={handleChange} className="glass-input" required>
                  <option value="">Select delivery mode</option>
                  {(options["delivery-modes"] || options.modes || []).map((mode) => (
                    <option key={mode.id} value={mode.id}>
                      {mode.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Training Venue / Location City */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Training Venue / City {requiresLocation ? <span style={{ color: "#f43f5e" }}>*</span> : <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>(Online)</span>}
                </label>
                <input
                  type="text"
                  name="location_city"
                  value={formData.location_city || ""}
                  onChange={handleChange}
                  placeholder={requiresLocation ? "e.g. Bengaluru, Hyderabad Campus" : "Not applicable for Online"}
                  disabled={!requiresLocation}
                  className="glass-input"
                  style={{
                    opacity: requiresLocation ? 1 : 0.6,
                    background: requiresLocation ? "rgba(255, 255, 255, 0.94)" : "rgba(241, 245, 249, 0.7)",
                  }}
                  required={requiresLocation}
                />
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  {requiresLocation ? "Physical classroom delivery center" : "Online delivery requires no physical venue"}
                </p>
              </div>

              {/* Faculty Accommodation */}
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <label style={{ fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Faculty Accommodation <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    (Logistics for visiting trainer/faculty travel and stay)
                  </span>
                </div>
                <select name="accommodation_id" value={formData.accommodation_id || ""} onChange={handleChange} className="glass-input" required>
                  <option value="">Select faculty accommodation requirement</option>
                  {(options.accommodations || []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — {acc.name.toLowerCase().includes("non") ? "Trainer local / self-arranged" : "Hotel / Guest house arranged"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Commencement (Start) Date */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Commencement Date <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="glass-input"
                  required
                />
              </div>

              {/* Conclusion (End) Date */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Conclusion Date <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  min={formData.start_date || undefined}
                  className="glass-input"
                  required
                />
              </div>

              {/* Calendar Duration Indicator */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Calendar Duration (Days)
                </label>
                <div
                  className="glass-input"
                  style={{
                    background: "rgba(241, 245, 249, 0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontWeight: 600,
                  }}
                >
                  <span>{calendarDays} Calendar Days</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Calculated</span>
                </div>
              </div>

              {/* Active Training Days & Total Hours */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                    Active Training Days <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <input
                    type="number"
                    name="training_days"
                    value={formData.training_days}
                    onChange={handleChange}
                    min={0}
                    className="glass-input"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                    Total Training Hours <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <input
                    type="number"
                    name="total_hours"
                    value={formData.total_hours}
                    onChange={handleChange}
                    min={0}
                    step={0.5}
                    className="glass-input"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: HEADCOUNT & FACULTY ASSIGNMENT */}
          {currentStep === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Total Candidate Headcount */}
              <div>
                <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                  Total Candidate Headcount <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  type="number"
                  name="total_enrollments"
                  value={formData.total_enrollments}
                  onChange={handleChange}
                  min={1}
                  placeholder="e.g. 45"
                  className="glass-input"
                  style={{ maxWidth: 280 }}
                  required
                />
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Total enrolled corporate students attending the training curriculum
                </p>
              </div>

              {/* Proposed Faculty Members (Multiple Entry as Chips) */}
              <div style={{ background: "rgba(248, 250, 252, 0.7)", padding: "16px", borderRadius: 14, border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Proposed Faculty Member(s)
                  </label>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    Multiple trainers can be assigned
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input
                    type="text"
                    value={facultyInput}
                    onChange={(e) => setFacultyInput(e.target.value)}
                    onKeyDown={handleFacultyKeyDown}
                    placeholder="Type trainer name and press Enter or click Add (e.g. Dr. Srinivas Rao)"
                    className="glass-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddFaculty}
                    className="btn btn-secondary"
                    style={{ padding: "8px 14px", fontSize: "0.825rem" }}
                  >
                    <Plus size={14} /> Add Faculty
                  </button>
                </div>

                {/* Faculty Chips Display */}
                {facultyList.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {facultyList.map((facultyName) => (
                      <span
                        key={facultyName}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(11, 92, 171, 0.1)",
                          color: "var(--primary-strong)",
                          border: "1px solid rgba(11, 92, 171, 0.25)",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: "0.825rem",
                          fontWeight: 600,
                        }}
                      >
                        <GraduationCap size={13} />
                        {facultyName}
                        <button
                          type="button"
                          onClick={() => handleRemoveFaculty(facultyName)}
                          aria-label={`Remove ${facultyName}`}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-dim)",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontStyle: "italic" }}>
                    No faculty members added yet. You can add trainers now or assign sessions later in the schedule timetable.
                  </div>
                )}
              </div>

              {/* Stakeholder Role Assignments */}
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>
                  Stakeholder Role Assignments
                </h4>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  {/* Sales SPOC */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                      Sales Account SPOC
                    </label>
                    <select name="sales_spoc_id" value={formData.sales_spoc_id || ""} onChange={handleChange} className="glass-input">
                      <option value="">Select Sales SPOC</option>
                      {(assignableUsers.sales || []).map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Operations Coordinator */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                      Operations Coordinator / SPOC
                    </label>
                    <select name="coordinator_id" value={formData.coordinator_id || ""} onChange={handleChange} className="glass-input">
                      <option value="">Select Coordinator</option>
                      {(assignableUsers.coordinators || []).map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Delivery Manager */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                      Delivery Manager
                    </label>
                    <select name="primary_manager_id" value={formData.primary_manager_id || ""} onChange={handleChange} className="glass-input">
                      <option value="">Select Manager</option>
                      {(assignableUsers.managers || []).map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: COMMERCIAL SOW, REMARKS & REVIEW */}
          {currentStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* SOW Number (Manual Entry) & Operational Remarks */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                    Client SOW Number <span style={{ color: "#f43f5e" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="sow_number"
                    value={formData.sow_number || ""}
                    onChange={handleChange}
                    placeholder="e.g. SOW-2026-DEL-089"
                    className="glass-input"
                    required
                  />
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                    Official client agreement / statement of work reference
                  </p>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.825rem", fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>
                    Operational Remarks & Special Instructions
                  </label>
                  <textarea
                    name="remarks"
                    value={formData.remarks || ""}
                    onChange={handleChange}
                    rows={2}
                    placeholder="e.g. Special lab environment required, weekend session schedule..."
                    className="glass-input"
                    style={{ resize: "vertical" }}
                  />
                </div>
              </div>

              {/* Pre-submission Summary Review Card */}
              <div
                style={{
                  background: "linear-gradient(180deg, #ffffff 0%, #f7faff 100%)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 14,
                  padding: "18px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h4 style={{ fontSize: "0.925rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                    Pre-Flight Submission Summary
                  </h4>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    Please review before sending for approval
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, fontSize: "0.85rem" }}>
                  <div style={{ borderLeft: "3px solid var(--primary)", paddingLeft: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Program & Client</div>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>{formData.batch_id}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{formData.client_name} — {formData.program_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                      {getEntityName(formData.entity_id)} • {getCategoryName(formData.category_id)} • {formData.domain}
                    </div>
                  </div>

                  <div style={{ borderLeft: "3px solid var(--emerald)", paddingLeft: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Delivery & Logistics</div>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                      {selectedDeliveryMode} {requiresLocation ? `(${formData.location_city})` : ""}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      {formData.start_date} to {formData.end_date} ({calendarDays} Days)
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                      Training: {formData.training_days} Days / {formData.total_hours} Hours • Faculty Acc: {getAccommodationName(formData.accommodation_id)}
                    </div>
                  </div>

                  <div style={{ borderLeft: "3px solid #8b5cf6", paddingLeft: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Headcount & Faculty</div>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                      {formData.total_enrollments} Candidates
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      Faculty: {facultyList.length > 0 ? facultyList.join(", ") : formData.faculty_assigned_text || "Unassigned"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                      Coord: {getUserName(assignableUsers.coordinators, formData.coordinator_id)} • Mgr: {getUserName(assignableUsers.managers, formData.primary_manager_id)}
                    </div>
                  </div>

                  <div style={{ borderLeft: "3px solid #f59e0b", paddingLeft: 10 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Commercial & Status</div>
                    <div style={{ fontWeight: 700, color: "var(--text-main)", marginTop: 2 }}>
                      SOW: {formData.sow_number}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      Initial Status: <strong style={{ color: "var(--amber)" }}>Requested</strong>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                      Sales: {getUserName(assignableUsers.sales, formData.sales_spoc_id)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lifecycle Notice Callout */}
              <div
                style={{
                  background: "rgba(11, 92, 171, 0.06)",
                  border: "1px solid rgba(11, 92, 171, 0.2)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                  <strong style={{ color: "var(--primary)" }}>Two-Level Approval & Schedule Readiness:</strong>
                  {" "}Creating this batch immediately sends it to <strong style={{ color: "var(--amber)" }}>Approval 1 Pending</strong> and assigns the configured Approver 1 and Approver 2. If rejected, the batch remains editable for correction.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: "16px 28px",
            borderTop: "1px solid var(--border-subtle)",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Step {currentStep} of 4
            </span>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isLoading}
                className="btn btn-primary"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {isLoading ? "Submitting Request..." : "Submit Batch Request"}
                <Check size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
