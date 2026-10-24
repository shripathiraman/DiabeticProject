import React, { useState, useEffect } from "react";
import type { encounters } from "../type";

interface AddEncounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newEncounter: encounters) => void;
}

interface FormState {
  encounter_id: string;
  patient_nbr: string;
  age: string;
  time_in_hospital: string;
  number_inpatient: string;
  number_emergency: string;
  number_outpatient: string;
  num_medications: string;
  num_lab_procedures: string;
  discharge_disposition_id: string;
  admission_type_id: string;
  readmitted: string;
}

const INITIAL_FORM_STATE: FormState = {
  encounter_id: "",
  patient_nbr: "",
  age: "[50-60)",
  time_in_hospital: "1",
  number_inpatient: "0",
  number_emergency: "0",
  number_outpatient: "0",
  num_medications: "1",
  num_lab_procedures: "1",
  discharge_disposition_id: "1",
  admission_type_id: "1",
  readmitted: "NO",
};

const AGE_OPTIONS = [
  "[0-10)",
  "[10-20)",
  "[20-30)",
  "[30-40)",
  "[40-50)",
  "[50-60)",
  "[60-70)",
  "[70-80)",
  "[80-90)",
  "[90-100)",
];

const READMITTED_OPTIONS = ["NO", ">30", "<30"];

export const AddEncounterModal: React.FC<AddEncounterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.encounter_id || !formData.patient_nbr) {
      setError("Encounter ID and Patient Number are required.");
      return;
    }

    const payload = {
      encounter_id: Number(formData.encounter_id),
      patient_nbr: Number(formData.patient_nbr),
      age: formData.age,
      time_in_hospital: Number(formData.time_in_hospital),
      number_inpatient: Number(formData.number_inpatient),
      number_emergency: Number(formData.number_emergency),
      number_outpatient: Number(formData.number_outpatient),
      num_medications: Number(formData.num_medications),
      num_lab_procedures: Number(formData.num_lab_procedures),
      discharge_disposition_id: Number(formData.discharge_disposition_id),
      admission_type_id: Number(formData.admission_type_id),
      readmitted: formData.readmitted,
    };

    try {
      setLoading(true);
      const response = await fetch("http://127.0.0.1:8000/encounters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(
          errData?.detail || `Failed to create encounter (${response.status})`
        );
      }

      const createdEncounter: encounters = await response.json();
      setFormData(INITIAL_FORM_STATE);
      onSuccess(createdEncounter);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title" className="modal-title">
              Add New Encounter
            </h2>
            <p className="modal-subtitle">
              Enter patient hospital encounter metrics to score readmission risk
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {error && <div className="modal-error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            {/* Encounter ID */}
            <div className="form-group">
              <label htmlFor="encounter_id">Encounter ID *</label>
              <input
                id="encounter_id"
                name="encounter_id"
                type="number"
                required
                placeholder="e.g. 1024501"
                value={formData.encounter_id}
                onChange={handleChange}
              />
            </div>

            {/* Patient Nbr */}
            <div className="form-group">
              <label htmlFor="patient_nbr">Patient Number *</label>
              <input
                id="patient_nbr"
                name="patient_nbr"
                type="number"
                required
                placeholder="e.g. 8222157"
                value={formData.patient_nbr}
                onChange={handleChange}
              />
            </div>

            {/* Age */}
            <div className="form-group">
              <label htmlFor="age">Age Range *</label>
              <select
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
              >
                {AGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Time in Hospital */}
            <div className="form-group">
              <label htmlFor="time_in_hospital">Time in Hospital (Days) *</label>
              <input
                id="time_in_hospital"
                name="time_in_hospital"
                type="number"
                min="1"
                max="14"
                required
                value={formData.time_in_hospital}
                onChange={handleChange}
              />
            </div>

            {/* Number Inpatient */}
            <div className="form-group">
              <label htmlFor="number_inpatient">Inpatient Visits (Past Year) *</label>
              <input
                id="number_inpatient"
                name="number_inpatient"
                type="number"
                min="0"
                required
                value={formData.number_inpatient}
                onChange={handleChange}
              />
            </div>

            {/* Number Emergency */}
            <div className="form-group">
              <label htmlFor="number_emergency">Emergency Visits (Past Year) *</label>
              <input
                id="number_emergency"
                name="number_emergency"
                type="number"
                min="0"
                required
                value={formData.number_emergency}
                onChange={handleChange}
              />
            </div>

            {/* Number Outpatient */}
            <div className="form-group">
              <label htmlFor="number_outpatient">Outpatient Visits (Past Year) *</label>
              <input
                id="number_outpatient"
                name="number_outpatient"
                type="number"
                min="0"
                required
                value={formData.number_outpatient}
                onChange={handleChange}
              />
            </div>

            {/* Num Medications */}
            <div className="form-group">
              <label htmlFor="num_medications">Number of Medications *</label>
              <input
                id="num_medications"
                name="num_medications"
                type="number"
                min="1"
                required
                value={formData.num_medications}
                onChange={handleChange}
              />
            </div>

            {/* Num Lab Procedures */}
            <div className="form-group">
              <label htmlFor="num_lab_procedures">Lab Procedures Count *</label>
              <input
                id="num_lab_procedures"
                name="num_lab_procedures"
                type="number"
                min="1"
                required
                value={formData.num_lab_procedures}
                onChange={handleChange}
              />
            </div>

            {/* Admission Type ID */}
            <div className="form-group">
              <label htmlFor="admission_type_id">Admission Type ID *</label>
              <input
                id="admission_type_id"
                name="admission_type_id"
                type="number"
                min="1"
                required
                value={formData.admission_type_id}
                onChange={handleChange}
              />
            </div>

            {/* Discharge Disposition ID */}
            <div className="form-group">
              <label htmlFor="discharge_disposition_id">
                Discharge Disposition ID *
              </label>
              <input
                id="discharge_disposition_id"
                name="discharge_disposition_id"
                type="number"
                min="1"
                required
                value={formData.discharge_disposition_id}
                onChange={handleChange}
              />
            </div>

            {/* Readmitted */}
            <div className="form-group">
              <label htmlFor="readmitted">Readmitted Status *</label>
              <select
                id="readmitted"
                name="readmitted"
                value={formData.readmitted}
                onChange={handleChange}
              >
                {READMITTED_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? "Saving Encounter..." : "Save Encounter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
