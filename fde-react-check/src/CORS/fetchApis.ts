/**
 * TypeScript Script demonstrating Interfaces and fetching from FastAPI GET endpoints.
 * Backend Docs: http://127.0.0.1:8000/docs
 */

// ============================================================================
// 1. TYPE ALIASES & UNION TYPES
// ============================================================================
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type InterventionStatus =
    | "PENDING_REVIEW"
    | "ASSIGNED"
    | "CONTACTED"
    | "FOLLOW_UP_SCHEDULED"
    | "CLOSED";

// ============================================================================
// 2. INTERFACES (Core Concept)
// ============================================================================

/** Health check response */
export interface HealthCheck {
    service: string;
    status: string;
    docs: string;
}

/** Base Encounter interface matching backend GET /encounters */
export interface Encounter {
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
    risk_score: number;
    risk_level: RiskLevel;
}

/**
 * Interface Inheritance: CareQueueItem extends Encounter
 * Demonstrates the power of TypeScript interfaces: reusability and extension!
 */
export interface CareQueueItem extends Encounter {
    intervention_id: number;
    status: InterventionStatus;
    assigned_to: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Patient search result matching backend GET /patients/search
 * Combines encounter fields with optional care intervention status
 */
export interface PatientSearchResult extends Encounter {
    intervention_id?: number | null;
    status?: InterventionStatus | null;
    intervention_status?: string | null;
    assigned_to?: string | null;
    notes?: string | null;
}

/** Filters for patient search (supports ID and/or Risk Score and/or Risk Level) */
export interface PatientSearchParams {
    patient_nbr?: number;
    risk_score?: number;
    risk_level?: RiskLevel;
    limit?: number;
    offset?: number;
}


/** Operations summary metrics */
export interface OperationsSummary {
    total_encounters: number;
    high_risk: number;
    medium_risk: number;
    low_risk: number;
    pending_interventions: number;
    completed_interventions: number;
}

/** Nested interface for readmission breakdown by risk group */
export interface RiskGroupReadmissionAnalysis {
    risk_level: RiskLevel;
    total_patients: number;
    readmitted_under_30_days: number;
    readmission_rate: number;
}

/** Aggregated 30-day readmission analysis */
export interface ReadmissionAnalysis {
    total_encounters: number;
    readmitted_under_30_days: number;
    readmission_rate: number;
    risk_groups: RiskGroupReadmissionAnalysis[];
}

/** Executive management dashboard */
export interface ManagementDashboard {
    total_encounters: number;
    care_queue_size: number;
    high_risk_queue: number;
    medium_risk_queue: number;
    pending_interventions: number;
    completed_interventions: number;
    high_risk_readmission_rate: number;
}

// ============================================================================
// 3. GENERIC REUSABLE FETCH FUNCTION
// ============================================================================
const BASE_URL = "http://127.0.0.1:8000";

/**
 * Generic fetch utility leveraging TypeScript interfaces <T>
 * Guarantees that the returned Promise resolves to the expected Interface type.
 */
async function apiGet<T>(endpoint: string): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`API Error [${response.status} ${response.statusText}] at ${url}`);
    }

    return (await response.json()) as T;
}

// ============================================================================
// 4. API FUNCTIONS FOR DIFFERENT GET ENDPOINTS
// ============================================================================

/** 1. GET / - Service health check */
export async function fetchHealth(): Promise<HealthCheck> {
    return apiGet<HealthCheck>("/");
}

/** 2. GET /encounters - Paginated patient encounters */
export async function fetchEncounters(limit = 3, offset = 0): Promise<Encounter[]> {
    return apiGet<Encounter[]>(`/encounters?limit=${limit}&offset=${offset}`);
}

/** 3. GET /encounters/{encounter_id} - Single encounter by ID */
export async function fetchEncounterById(id: number): Promise<Encounter> {
    return apiGet<Encounter>(`/encounters/${id}`);
}

/** 4. GET /care-queue - Prioritized care queue (High and Medium risk) */
export async function fetchCareQueue(minRiskScore?: number, limit = 3): Promise<CareQueueItem[]> {
    const query = minRiskScore !== undefined ? `?min_risk_score=${minRiskScore}&limit=${limit}` : `?limit=${limit}`;
    return apiGet<CareQueueItem[]>(`/care-queue${query}`);
}

/** 5. GET /care-queue/high - High-risk encounters exclusively */
export async function fetchHighRiskCareQueue(limit = 3): Promise<CareQueueItem[]> {
    return apiGet<CareQueueItem[]>(`/care-queue/high?limit=${limit}`);
}

/** 6. GET /operations/summary - Operational encounter counts and status */
export async function fetchOperationsSummary(): Promise<OperationsSummary> {
    return apiGet<OperationsSummary>("/operations/summary");
}

/** 7. GET /operations/readmission-analysis - 30-day readmission analytics */
export async function fetchReadmissionAnalysis(): Promise<ReadmissionAnalysis> {
    return apiGet<ReadmissionAnalysis>("/operations/readmission-analysis");
}

/** 8. GET /management/dashboard - Executive metrics */
export async function fetchManagementDashboard(): Promise<ManagementDashboard> {
    return apiGet<ManagementDashboard>("/management/dashboard");
}

/**
 * 9. GET /patients/search - Search for Patient by Id and/or Risk Score and/or Risk Level
 * Calls FastAPI backend and returns strongly typed PatientSearchResult[]
 */
export async function searchPatients(params: PatientSearchParams = {}): Promise<PatientSearchResult[]> {
    const searchParams = new URLSearchParams();

    if (params.patient_nbr !== undefined) {
        searchParams.append("patient_nbr", params.patient_nbr.toString());
    }
    if (params.risk_score !== undefined) {
        searchParams.append("risk_score", params.risk_score.toString());
    }
    if (params.risk_level !== undefined) {
        searchParams.append("risk_level", params.risk_level);
    }
    if (params.limit !== undefined) {
        searchParams.append("limit", params.limit.toString());
    }
    if (params.offset !== undefined) {
        searchParams.append("offset", params.offset.toString());
    }

    const queryString = searchParams.toString();
    const endpoint = `/patients/search${queryString ? `?${queryString}` : ""}`;
    return apiGet<PatientSearchResult[]>(endpoint);
}


// ============================================================================
// 5. DEMO EXECUTION
// ============================================================================
async function runDemo() {
    console.log("==================================================================");
    console.log("🚀 FETCHING DATA FROM FASTAPI GET APIS USING TYPESCRIPT INTERFACES");
    console.log("==================================================================\n");

    try {
        // 1. Health Check
        console.log("1️⃣  Testing Health Check (GET /)...");
        const health: HealthCheck = await fetchHealth();
        console.log(`   Status: ${health.status.toUpperCase()} | Service: ${health.service}\n`);

        // 2. Paginated Encounters List
        console.log("2️⃣  Testing List Encounters (GET /encounters?limit=2)...");
        const encounters: Encounter[] = await fetchEncounters(2);
        console.table(
            encounters.map((e) => ({
                encounter_id: e.encounter_id,
                patient_nbr: e.patient_nbr,
                age: e.age,
                time_in_hospital: `${e.time_in_hospital} days`,
                risk_score: e.risk_score,
                risk_level: e.risk_level,
                readmitted: e.readmitted,
            }))
        );
        console.log();

        // 3. Single Encounter Fetch
        const sampleId = encounters[0]?.encounter_id ?? 12522;
        console.log(`3️⃣  Testing Single Encounter (GET /encounters/${sampleId})...`);
        const singleEncounter: Encounter = await fetchEncounterById(sampleId);
        console.log(`   Encounter #${singleEncounter.encounter_id}: Patient ${singleEncounter.patient_nbr}, Risk: ${singleEncounter.risk_level} (${singleEncounter.risk_score} pts)\n`);

        // 4. Care Queue (Interface Inheritance: CareQueueItem extends Encounter)
        console.log("4️⃣  Testing Care Queue (GET /care-queue/high?limit=2)...");
        const highRiskQueue: CareQueueItem[] = await fetchHighRiskCareQueue(2);
        console.table(
            highRiskQueue.map((item) => ({
                intervention_id: item.intervention_id,
                encounter_id: item.encounter_id,
                risk_level: item.risk_level,
                risk_score: item.risk_score,
                intervention_status: item.status,
                assigned_to: item.assigned_to ?? "Unassigned",
            }))
        );
        console.log();

        // 5. Operations Summary
        console.log("5️⃣  Testing Operations Summary (GET /operations/summary)...");
        const opsSummary: OperationsSummary = await fetchOperationsSummary();
        console.log(`   Total Encounters: ${opsSummary.total_encounters.toLocaleString()}`);
        console.log(`   High Risk: ${opsSummary.high_risk.toLocaleString()} | Medium Risk: ${opsSummary.medium_risk.toLocaleString()} | Low Risk: ${opsSummary.low_risk.toLocaleString()}`);
        console.log(`   Pending Interventions: ${opsSummary.pending_interventions.toLocaleString()}\n`);

        // 6. Readmission Analysis (Nested Interfaces)
        console.log("6️⃣  Testing Readmission Analysis (GET /operations/readmission-analysis)...");
        const readmission: ReadmissionAnalysis = await fetchReadmissionAnalysis();
        console.log(`   Overall 30-Day Readmission Rate: ${readmission.readmission_rate}% (${readmission.readmitted_under_30_days} patients)`);
        console.table(
            readmission.risk_groups.map((group) => ({
                risk_level: group.risk_level,
                total_patients: group.total_patients,
                readmitted_under_30_days: group.readmitted_under_30_days,
                readmission_rate: `${group.readmission_rate}%`,
            }))
        );
        console.log();

        // 7. Management Dashboard
        console.log("7️⃣  Testing Management Dashboard (GET /management/dashboard)...");
        const dashboard: ManagementDashboard = await fetchManagementDashboard();
        console.log(`   Queue Size: ${dashboard.care_queue_size} (High: ${dashboard.high_risk_queue}, Medium: ${dashboard.medium_risk_queue})`);
        console.log(`   High-Risk Readmission Rate: ${dashboard.high_risk_readmission_rate}%\n`);

        // 8. Patient Search (By ID and/or Risk Score and/or Risk Level)
        console.log("8️⃣  Testing Patient Search (GET /patients/search)...");

        // 8a. Search by Patient Number
        console.log("   --> Search by Patient ID (patient_nbr = 84002391):");
        const resultsByPatient = await searchPatients({ patient_nbr: 84002391 });
        console.log(`       Found ${resultsByPatient.length} encounter(s) for patient 84002391`);

        // 8b. Combined Search (patient_nbr + risk_score + risk_level)
        console.log("   --> Combined Search (patient_nbr=84002391, risk_score=8, risk_level=HIGH):");
        const combinedResults = await searchPatients({
            patient_nbr: 84002391,
            risk_score: 8,
            risk_level: "HIGH",
        });
        console.table(
            combinedResults.map((r) => ({
                encounter_id: r.encounter_id,
                patient_nbr: r.patient_nbr,
                age: r.age,
                time_in_hospital: `${r.time_in_hospital} days`,
                risk_score: r.risk_score,
                risk_level: r.risk_level,
                intervention_status: r.intervention_status ?? "None",
            }))
        );
        console.log();

        console.log("✅ All GET endpoints successfully queried and validated against TypeScript Interfaces!");
    } catch (err) {
        console.error("❌ Error while fetching API data:", err);
    }
}

// Execute the demo
runDemo();
