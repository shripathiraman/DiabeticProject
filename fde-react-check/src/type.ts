export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type InterventionStatus =
    | "PENDING_REVIEW"
    | "ASSIGNED"
    | "CONTACTED"
    | "FOLLOW_UP_SCHEDULED"
    | "CLOSED";

export interface encounters {
    "encounter_id": number;
    "patient_nbr": number;
    "age": string;
    "time_in_hospital": number;
    "number_inpatient": number;
    "number_emergency": number;
    "number_outpatient": number;
    "num_medications": number;
    "num_lab_procedures": number;
    "discharge_disposition_id": number;
    "admission_type_id": number;
    "readmitted": string;
    "risk_score": number;
    "risk_level": RiskLevel;
}

export interface PatientSearchResult extends encounters {
    intervention_id?: number | null;
    status?: InterventionStatus | null;
    intervention_status?: InterventionStatus | null;
    assigned_to?: string | null;
    notes?: string | null;
}

export interface PatientSearchParams {
    patient_nbr?: number;
    risk_score?: number;
    risk_level?: RiskLevel;
    limit?: number;
    offset?: number;
}

export interface Intervention {
    intervention_id: number;
    encounter_id: number;
    patient_nbr?: number | null;
    risk_level?: RiskLevel | null;
    risk_score?: number | null;
    status: InterventionStatus;
    assigned_to: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface InterventionUpdate {
    status?: InterventionStatus;
    assigned_to?: string;
    notes?: string;
}

export interface InterventionHistoryItem {
    history_id: number;
    encounter_id: number;
    patient_nbr?: number | null;
    status: InterventionStatus;
    assigned_to: string | null;
    notes: string | null;
    changed_at: string;
}

export interface EncounterCreate {
    encounter_id: number;
    patient_nbr: number;
    age: string;
    time_in_hospital: number;
    number_inpatient: number;
    number_emergency: number;
    number_outpatient: number;
    num_medications: number;
    num_lab_procedures: number;
    discharge_disposition_id: number;
    admission_type_id: number;
    readmitted: string;
}