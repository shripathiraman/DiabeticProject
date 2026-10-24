import { useEffect } from "react";
import { Intervention } from "./Intervention";
import type { encounters } from "../type";

interface EncounterDetailsModalProps {
    encounter: encounters;
    onClose: () => void;
}

const DETAILS: { label: string; field: keyof encounters }[] = [
    { label: "Patient Number", field: "patient_nbr" },
    { label: "Encounter ID", field: "encounter_id" },
    { label: "Age", field: "age" },
    { label: "Time in Hospital", field: "time_in_hospital" },
    { label: "Number Inpatient", field: "number_inpatient" },
    { label: "Number Emergency", field: "number_emergency" },
    { label: "Number Outpatient", field: "number_outpatient" },
    { label: "Number of Medications", field: "num_medications" },
    { label: "Number of Lab Procedures", field: "num_lab_procedures" },
    { label: "Discharge Disposition ID", field: "discharge_disposition_id" },
    { label: "Admission Type ID", field: "admission_type_id" },
    { label: "Readmitted", field: "readmitted" },
    { label: "Risk Score", field: "risk_score" },
    { label: "Risk Level", field: "risk_level" },
];

export const EncounterDetailsModal = ({ encounter, onClose }: EncounterDetailsModalProps) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <section
                className="encounter-details-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="encounter-details-title"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="encounter-details-header">
                    <h2 id="encounter-details-title">
                        Encounter {encounter.encounter_id} Details
                    </h2>
                    <button
                        type="button"
                        className="modal-close-btn"
                        onClick={onClose}
                        aria-label="Close encounter details"
                    >
                        ×
                    </button>
                </header>
                <div className="encounter-details-content">
                    <dl className="encounter-details-grid">
                        {DETAILS.map(({ label, field }) => (
                            <div className="encounter-detail" key={field}>
                                <dt>{label}</dt>
                                <dd>{encounter[field]}</dd>
                            </div>
                        ))}
                    </dl>
                    <Intervention
                        key={encounter.encounter_id}
                        encounterId={encounter.encounter_id}
                        patientNumber={encounter.patient_nbr}
                    />
                </div>
            </section>
        </div>
    );
};
