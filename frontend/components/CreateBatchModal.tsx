"use client";

import React, { useState } from "react";
import { api, CreateBatchPayload } from "@/lib/api";
import { X, Sparkles, AlertCircle, Check } from "lucide-react";

interface CreateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchCreated: () => void;
}

export const CreateBatchModal: React.FC<CreateBatchModalProps> = ({ isOpen, onClose, onBatchCreated }) => {
  const [formData, setFormData] = useState<CreateBatchPayload>({
    batch_id: "",
    program_name: "",
    client_name: "",
    category: "Bootcamp",
    domain: "IT/ITES",
    delivery_mode: "Online",
    location_city: "Bengaluru",
    residential_type: "NR",
    start_date: "",
    end_date: "",
    total_enrollments: 30,
    residential_enrollments: 0,
    non_residential_enrollments: 30,
    technology: "",
    training_days: 15,
    total_hours: 120,
    faculty_assigned_text: "",
    remarks: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Auto compute total vs residential/non-residential
      if (name === "total_enrollments" || name === "residential_enrollments") {
        const total = Number(name === "total_enrollments" ? value : prev.total_enrollments) || 0;
        const resi = Number(name === "residential_enrollments" ? value : prev.residential_enrollments) || 0;
        updated.non_residential_enrollments = Math.max(0, total - resi);
      }

      return updated;
    });
  };

  const generateRandomBatchId = () => {
    const client = formData.client_name ? formData.client_name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 5).toUpperCase() : "ENT";
    const tech = formData.technology ? formData.technology.split(",")[0].replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase() : "TECH";
    const year = new Date().getFullYear();
    const rand = Math.floor(10 + Math.random() * 90);
    const suggested = `${client}_${tech}_${year}_B${rand}`;
    setFormData((prev) => ({ ...prev, batch_id: suggested }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!formData.batch_id.trim()) throw new Error("Batch ID is required");
      if (!formData.program_name.trim()) throw new Error("Program Name is required");

      const payload: CreateBatchPayload = {
        ...formData,
        total_enrollments: Number(formData.total_enrollments) || 0,
        residential_enrollments: Number(formData.residential_enrollments) || 0,
        non_residential_enrollments: Number(formData.non_residential_enrollments) || 0,
        training_days: Number(formData.training_days) || 0,
        total_hours: Number(formData.total_hours) || 0,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : undefined,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : undefined,
      };

      await api.createBatch(payload);
      onBatchCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create batch");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 760 }}>
        {/* Modal Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-main)" }}>
              Create New Batch Request
            </h2>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: 2 }}>
              Workflow 1: Batch initialized in <strong style={{ color: "#fbbf24" }}>Requested</strong> status pending Manager SOW approval.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
          {error && (
            <div style={{
              background: "rgba(244, 63, 94, 0.15)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              color: "#fb7185",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Batch ID */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>
                  Batch ID <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={generateRandomBatchId}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--primary)",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Sparkles size={12} /> Auto-format
                </button>
              </div>
              <input
                type="text"
                name="batch_id"
                value={formData.batch_id}
                onChange={handleChange}
                placeholder="e.g. DEL_PYSPARK_2026_B1"
                className="glass-input"
                required
              />
            </div>

            {/* Client Name */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Client Name <span style={{ color: "#f43f5e" }}>*</span>
              </label>
              <input
                type="text"
                name="client_name"
                value={formData.client_name}
                onChange={handleChange}
                placeholder="e.g. Deloitte, IBM, Capgemini"
                className="glass-input"
                required
              />
            </div>

            {/* Program Title */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Program Curriculum Title <span style={{ color: "#f43f5e" }}>*</span>
              </label>
              <input
                type="text"
                name="program_name"
                value={formData.program_name}
                onChange={handleChange}
                placeholder="e.g. Enterprise Big Data & PySpark Scala Immersion"
                className="glass-input"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Category
              </label>
              <select name="category" value={formData.category} onChange={handleChange} className="glass-input">
                <option value="Bootcamp">Bootcamp</option>
                <option value="RBT">RBT (Role-Based Training)</option>
                <option value="PJP">PJP (Pre-Joining Program)</option>
                <option value="Workshop">Workshop</option>
              </select>
            </div>

            {/* Domain */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Domain / Vertical
              </label>
              <select name="domain" value={formData.domain} onChange={handleChange} className="glass-input">
                <option value="IT/ITES">IT/ITES</option>
                <option value="Cloud">Cloud & DevOps</option>
                <option value="DS/ML">Data Science & AI/ML</option>
                <option value="CyberSecurity">CyberSecurity</option>
                <option value="FullStack">Full Stack Engineering</option>
              </select>
            </div>

            {/* Delivery Mode */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Delivery Mode
              </label>
              <select name="delivery_mode" value={formData.delivery_mode} onChange={handleChange} className="glass-input">
                <option value="Online">Online / Virtual ILT</option>
                <option value="F2F">F2F (Face to Face)</option>
                <option value="Blended">Blended Delivery</option>
              </select>
            </div>

            {/* Location City */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Location / City
              </label>
              <input
                type="text"
                name="location_city"
                value={formData.location_city}
                onChange={handleChange}
                placeholder="e.g. Bengaluru, Hyderabad, Remote"
                className="glass-input"
              />
            </div>

            {/* Start Date */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Start Date
              </label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="glass-input"
              />
            </div>

            {/* End Date */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                End Date
              </label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="glass-input"
              />
            </div>

            {/* Total Enrollments */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Total Enrollments
              </label>
              <input
                type="number"
                name="total_enrollments"
                value={formData.total_enrollments}
                onChange={handleChange}
                min={1}
                className="glass-input"
              />
            </div>

            {/* Residential Enrollments */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Residential Headcount
              </label>
              <input
                type="number"
                name="residential_enrollments"
                value={formData.residential_enrollments}
                onChange={handleChange}
                min={0}
                className="glass-input"
              />
            </div>

            {/* Technology Stack */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Technology Stack / Modules
              </label>
              <input
                type="text"
                name="technology"
                value={formData.technology}
                onChange={handleChange}
                placeholder="e.g. PySpark, Databricks, Scala, Delta Lake"
                className="glass-input"
              />
            </div>

            {/* Faculty Assigned Notes */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Faculty Proposed / Assigned
              </label>
              <input
                type="text"
                name="faculty_assigned_text"
                value={formData.faculty_assigned_text}
                onChange={handleChange}
                placeholder="e.g. Nagabhushan / Srinivas P"
                className="glass-input"
              />
            </div>

            {/* Training Days & Hours */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Days
                </label>
                <input
                  type="number"
                  name="training_days"
                  value={formData.training_days}
                  onChange={handleChange}
                  className="glass-input"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                  Hours
                </label>
                <input
                  type="number"
                  name="total_hours"
                  value={formData.total_hours}
                  onChange={handleChange}
                  className="glass-input"
                />
              </div>
            </div>

            {/* Remarks */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                Operational Remarks / Notes
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={2}
                placeholder="Specific batch delivery constraints or client requirements..."
                className="glass-input"
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary">
              {isLoading ? "Submitting..." : "Submit Batch Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
