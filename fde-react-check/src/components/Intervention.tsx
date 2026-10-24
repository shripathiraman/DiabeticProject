import { useEffect, useState, type FormEvent } from "react";
import {
    fetchInterventionByEncounterId,
    fetchInterventionHistory,
    updateIntervention,
} from "../CORS/fetchApis";
import type {
    Intervention as InterventionData,
    InterventionHistoryItem,
    InterventionStatus,
} from "../type";

interface InterventionProps {
    encounterId: number | null;
    patientNumber: number | null;
}

const STATUSES: InterventionStatus[] = [
    "PENDING_REVIEW",
    "ASSIGNED",
    "CONTACTED",
    "FOLLOW_UP_SCHEDULED",
    "CLOSED",
];

const readableStatus = (status: string) => status.replaceAll("_", " ");

const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
};

export const Intervention = ({ encounterId: selectedEncounterId, patientNumber: selectedPatientNumber }: InterventionProps) => {
    const [encounterId, setEncounterId] = useState(selectedEncounterId?.toString() ?? "");
    const [patientNumber, setPatientNumber] = useState<number | null>(selectedPatientNumber);
    const [status, setStatus] = useState<InterventionStatus>("PENDING_REVIEW");
    const [assignedTo, setAssignedTo] = useState("");
    const [notes, setNotes] = useState("");
    const [intervention, setIntervention] = useState<InterventionData | null>(null);
    const [history, setHistory] = useState<InterventionHistoryItem[]>([]);
    const [loading, setLoading] = useState(selectedEncounterId !== null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadIntervention = async (id: number) => {
        try {
            const data = await fetchInterventionByEncounterId(id);
            const loadedHistory = await fetchInterventionHistory(id);
            setIntervention(data);
            setEncounterId(data.encounter_id.toString());
            setPatientNumber(data.patient_nbr ?? null);
            setStatus(data.status);
            setAssignedTo(data.assigned_to ?? "");
            setNotes(data.notes ?? "");
            setHistory(loadedHistory);
            setError(null);
        } catch (loadError) {
            setIntervention(null);
            setHistory([]);
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Failed to fetch intervention details.",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedEncounterId === null) return;

        let cancelled = false;
        const fetchSelectedEncounter = async () => {
            try {
                const data = await fetchInterventionByEncounterId(selectedEncounterId);
                const loadedHistory = await fetchInterventionHistory(selectedEncounterId);
                if (cancelled) return;
                setIntervention(data);
                setEncounterId(data.encounter_id.toString());
                setPatientNumber(data.patient_nbr ?? null);
                setStatus(data.status);
                setAssignedTo(data.assigned_to ?? "");
                setNotes(data.notes ?? "");
                setHistory(loadedHistory);
            } catch (loadError) {
                if (!cancelled) {
                    setIntervention(null);
                    setHistory([]);
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Failed to fetch intervention details.",
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchSelectedEncounter();
        return () => {
            cancelled = true;
        };
    }, [selectedEncounterId]);

    const getValidEncounterId = (): number | null => {
        const id = Number(encounterId);
        if (!Number.isInteger(id) || id <= 0) {
            setError("Enter a valid positive encounter ID.");
            return null;
        }
        return id;
    };

    const handleFetch = () => {
        const id = getValidEncounterId();
        if (id !== null) {
            setLoading(true);
            setError(null);
            setSuccess(null);
            void loadIntervention(id);
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const id = getValidEncounterId();
        if (id === null) return;

        setSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const updated = await updateIntervention(id, {
                status,
                assigned_to: assignedTo.trim(),
                notes: notes.trim(),
            });
            setIntervention(updated);
            setEncounterId(updated.encounter_id.toString());
            setPatientNumber(updated.patient_nbr ?? patientNumber);
            setStatus(updated.status);
            setAssignedTo(updated.assigned_to ?? "");
            setNotes(updated.notes ?? "");
            setHistory(await fetchInterventionHistory(id));
            setSuccess(`Intervention for encounter ${id} was updated.`);
        } catch (updateError) {
            setError(
                updateError instanceof Error
                    ? updateError.message
                    : "Failed to update intervention.",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="patient-screen">
            <section className="management-card" aria-labelledby="intervention-heading">
                <header className="management-card-header results-card-header">
                    <h2 id="intervention-heading">Care Intervention Details</h2>
                    {intervention && (
                        <span className={`risk-label risk-${intervention.risk_level?.toLowerCase() ?? "unknown"}`}>
                            {intervention.risk_level ?? "Risk unavailable"}
                            {intervention.risk_score !== null && intervention.risk_score !== undefined
                                ? ` (Score ${intervention.risk_score})`
                                : ""}
                        </span>
                    )}
                </header>
                <form className="management-card-body intervention-form" onSubmit={handleSubmit}>
                    <div className="management-form-grid">
                        <label className="management-field">
                            <span>Encounter ID</span>
                            <input
                                type="number"
                                min="1"
                                required
                                value={encounterId}
                                onChange={(event) => setEncounterId(event.target.value)}
                                placeholder="Enter encounter ID"
                            />
                        </label>
                        <label className="management-field">
                            <span>Patient Number</span>
                            <input value={patientNumber ?? ""} readOnly placeholder="Loaded with encounter" />
                        </label>
                        <label className="management-field">
                            <span>Status</span>
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value as InterventionStatus)}
                            >
                                {STATUSES.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <label className="management-field">
                            <span>Assigned To</span>
                            <input
                                type="text"
                                maxLength={100}
                                value={assignedTo}
                                onChange={(event) => setAssignedTo(event.target.value)}
                                placeholder="Care team member"
                            />
                        </label>
                    </div>
                    <label className="management-field">
                        <span>Notes</span>
                        <textarea
                            rows={4}
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Clinical notes, care actions, or follow-up details"
                        />
                    </label>
                    <div className="management-actions intervention-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleFetch}
                            disabled={loading || saving}
                        >
                            {loading ? "Loading..." : "Fetch Status"}
                        </button>
                        <button type="submit" className="btn-primary" disabled={saving || loading}>
                            {saving ? "Updating..." : "Update"}
                        </button>
                    </div>
                    {error && <p className="status-message status-error" role="alert">{error}</p>}
                    {success && <p className="status-message status-success" role="status">{success}</p>}
                </form>
            </section>

            <section className="management-card" aria-labelledby="intervention-history-heading">
                <header className="management-card-header results-card-header">
                    <h2 id="intervention-history-heading">Intervention History</h2>
                    <span className="management-count">
                        {history.length} {history.length === 1 ? "Record" : "Records"}
                    </span>
                </header>
                {history.length === 0 ? (
                    <p className="management-empty-state">
                        {intervention
                            ? "No intervention updates recorded yet."
                            : "Fetch an encounter to view its intervention history."}
                    </p>
                ) : (
                    <div className="management-table-wrapper">
                        <table className="management-table">
                            <thead>
                                <tr>
                                    <th>Update Time</th>
                                    <th>Encounter ID</th>
                                    <th>Patient Number</th>
                                    <th>Status</th>
                                    <th>Assigned To</th>
                                    <th>Clinical Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item) => (
                                    <tr key={item.history_id}>
                                        <td>{formatTimestamp(item.changed_at)}</td>
                                        <td>{item.encounter_id}</td>
                                        <td>{item.patient_nbr ?? patientNumber ?? "-"}</td>
                                        <td>{readableStatus(item.status)}</td>
                                        <td>{item.assigned_to || "Unassigned"}</td>
                                        <td className="history-notes">{item.notes || "None"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </section>
    );
};
