import { useState, type FormEvent } from "react";
import { searchPatients } from "../CORS/fetchApis";
import type {
    PatientSearchParams,
    PatientSearchResult,
    RiskLevel,
} from "../type";

interface SearchPatientProps {
    onSelectEncounter: (patient: PatientSearchResult) => void;
}

const RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

const isRiskLevel = (value: string): value is RiskLevel =>
    value === "LOW" || value === "MEDIUM" || value === "HIGH";

const formatStatus = (status?: string | null) =>
    status ? status.replaceAll("_", " ") : "None";

export const SearchPatient = ({ onSelectEncounter }: SearchPatientProps) => {
    const [patientNumber, setPatientNumber] = useState("");
    const [riskLevel, setRiskLevel] = useState("");
    const [riskScore, setRiskScore] = useState("");
    const [patients, setPatients] = useState<PatientSearchResult[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runSearch = async (filters: PatientSearchParams) => {
        setLoading(true);
        setError(null);
        setHasSearched(true);

        try {
            setPatients(await searchPatients(filters));
        } catch (searchError) {
            setPatients([]);
            setError(
                searchError instanceof Error
                    ? searchError.message
                    : "Failed to search patients.",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const filters: PatientSearchParams = {};
        if (patientNumber.trim()) {
            const parsedPatientNumber = Number(patientNumber);
            if (!Number.isInteger(parsedPatientNumber) || parsedPatientNumber < 1) {
                setError("Patient number must be a positive whole number.");
                return;
            }
            filters.patient_nbr = parsedPatientNumber;
        }
        if (isRiskLevel(riskLevel)) {
            filters.risk_level = riskLevel;
        }
        if (riskScore.trim()) {
            const parsedRiskScore = Number(riskScore);
            if (!Number.isInteger(parsedRiskScore) || parsedRiskScore < 0 || parsedRiskScore > 8) {
                setError("Risk score must be a whole number between 0 and 8.");
                return;
            }
            filters.risk_score = parsedRiskScore;
        }

        if (
            filters.patient_nbr === undefined &&
            filters.risk_level === undefined &&
            filters.risk_score === undefined
        ) {
            setError("Enter a patient number, risk level, or risk score to search.");
            return;
        }

        void runSearch(filters);
    };

    const setQuickFilter = (filter: "patient" | "high" | "score" | "all") => {
        const nextPatientNumber = filter === "patient" ? "84002391" : "";
        const nextRiskLevel = filter === "high" ? "HIGH" : filter === "all" ? "ALL" : "";
        const nextRiskScore = filter === "score" ? "8" : "";
        setPatientNumber(nextPatientNumber);
        setRiskLevel(nextRiskLevel);
        setRiskScore(nextRiskScore);

        const filters: PatientSearchParams = {};
        if (nextPatientNumber) filters.patient_nbr = Number(nextPatientNumber);
        if (isRiskLevel(nextRiskLevel)) {
            filters.risk_level = nextRiskLevel;
        }
        if (nextRiskScore) filters.risk_score = Number(nextRiskScore);
        void runSearch(filters);
    };

    const reset = () => {
        setPatientNumber("");
        setRiskLevel("");
        setRiskScore("");
        setPatients([]);
        setHasSearched(false);
        setError(null);
    };

    return (
        <section className="patient-screen">
            <section className="management-card" aria-labelledby="search-patient-heading">
                <header className="management-card-header">
                    <h2 id="search-patient-heading">Search Patient</h2>
                </header>
                <form className="management-card-body" onSubmit={handleSubmit}>
                    <div className="management-form-grid">
                        <label className="management-field">
                            <span>Patient Number</span>
                            <input
                                type="number"
                                min="1"
                                value={patientNumber}
                                onChange={(event) => setPatientNumber(event.target.value)}
                                placeholder="Enter patient number"
                            />
                        </label>
                        <label className="management-field">
                            <span>Risk Level</span>
                            <select
                                value={riskLevel}
                                onChange={(event) => setRiskLevel(event.target.value)}
                            >
                                <option value="">Select a risk level</option>
                                <option value="ALL">All risk levels</option>
                                {RISK_LEVELS.map((level) => (
                                    <option key={level} value={level}>
                                        {level.charAt(0) + level.slice(1).toLowerCase()}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="management-field">
                            <span>Risk Score (0-8)</span>
                            <input
                                type="number"
                                min="0"
                                max="8"
                                value={riskScore}
                                onChange={(event) => setRiskScore(event.target.value)}
                                placeholder="Enter risk score"
                            />
                        </label>
                    </div>

                    <div className="management-form-actions">
                        <div className="patient-quick-filters" aria-label="Quick searches">
                            <span>Quick search:</span>
                            <button type="button" onClick={() => setQuickFilter("patient")}>
                                Patient #84002391
                            </button>
                            <button type="button" onClick={() => setQuickFilter("high")}>
                                High Risk
                            </button>
                            <button type="button" onClick={() => setQuickFilter("score")}>
                                Score = 8
                            </button>
                            <button type="button" onClick={() => setQuickFilter("all")}>
                                All Risk Levels
                            </button>
                        </div>
                        <div className="management-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={reset}
                                disabled={loading}
                            >
                                Reset
                            </button>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                {loading ? "Searching..." : "Search"}
                            </button>
                        </div>
                    </div>
                    {error && <p className="status-message status-error" role="alert">{error}</p>}
                </form>
            </section>

            <section className="management-card" aria-labelledby="patient-results-heading">
                <header className="management-card-header results-card-header">
                    <h2 id="patient-results-heading">Encounter Details</h2>
                    <span className="management-count">
                        {patients.length} {patients.length === 1 ? "Record" : "Records"}
                    </span>
                </header>
                {loading ? (
                    <p className="management-empty-state" role="status">Fetching patient encounters...</p>
                ) : patients.length === 0 ? (
                    <p className="management-empty-state">
                        {hasSearched
                            ? "No matching encounters found. Try adjusting your filters."
                            : "Enter a patient number, risk level, or risk score to begin."}
                    </p>
                ) : (
                    <div className="management-table-wrapper">
                        <table className="management-table">
                            <thead>
                                <tr>
                                    <th>Encounter ID</th>
                                    <th>Patient Number</th>
                                    <th>Age</th>
                                    <th>Hospital Stay</th>
                                    <th>Risk Score</th>
                                    <th>Risk Level</th>
                                    <th>Readmitted</th>
                                    <th>Prior Visits (In/ER/Out)</th>
                                    <th>Medications</th>
                                    <th>Intervention Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map((patient) => (
                                    <tr key={patient.encounter_id}>
                                        <td>
                                            <button
                                                type="button"
                                                className="encounter-link"
                                                onClick={() => onSelectEncounter(patient)}
                                                title={`View intervention for encounter ${patient.encounter_id}`}
                                            >
                                                {patient.encounter_id}
                                            </button>
                                        </td>
                                        <td>{patient.patient_nbr}</td>
                                        <td>{patient.age}</td>
                                        <td>{patient.time_in_hospital} days</td>
                                        <td>{patient.risk_score} / 8</td>
                                        <td>
                                            <span className={`risk-label risk-${patient.risk_level.toLowerCase()}`}>
                                                {patient.risk_level}
                                            </span>
                                        </td>
                                        <td>{patient.readmitted}</td>
                                        <td>
                                            {patient.number_inpatient} / {patient.number_emergency} / {patient.number_outpatient}
                                        </td>
                                        <td>{patient.num_medications}</td>
                                        <td>{formatStatus(patient.intervention_status ?? patient.status)}</td>
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
