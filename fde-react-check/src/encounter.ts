export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type InterventionStatus =
    | "PENDING_REVIEW"
    | "ASSIGNED"
    | "CONTACTED"
    | "FOLLOW_UP_SCHEDULED"
    | "CLOSED";

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
    intervention_status?: InterventionStatus;
}

// ============================================================================
// PART 1: Hardcoded Encounters Array
// ============================================================================
const encounters: Encounter[] = [
    {
        encounter_id: 12522,
        patient_nbr: 48330783,
        age: "[80-90)",
        time_in_hospital: 13,
        number_inpatient: 0,
        number_emergency: 0,
        number_outpatient: 0,
        num_medications: 28,
        num_lab_procedures: 68,
        discharge_disposition_id: 1,
        admission_type_id: 2,
        readmitted: "NO",
        risk_score: 2,
        risk_level: "LOW",
        intervention_status: "PENDING_REVIEW",
    },
    {
        encounter_id: 13010,
        patient_nbr: 30919878,
        age: "[80-90)",
        time_in_hospital: 9,
        number_inpatient: 0,
        number_emergency: 0,
        number_outpatient: 1,
        num_medications: 19,
        num_lab_procedures: 36,
        discharge_disposition_id: 1,
        admission_type_id: 1,
        readmitted: "NO",
        risk_score: 1,
        risk_level: "LOW",
        intervention_status: "PENDING_REVIEW",
    },
];

console.log("--- Hardcoded Encounters Array ---");
console.log(encounters);

// ============================================================================
// PART 2: Fetching from Backend API (http://127.0.0.1:8000)
// ============================================================================

/**
 * Fetch a list of encounters from the FastAPI backend with a limit
 */
async function fetchEncounters(limit = 5): Promise<void> {
    const url = `http://127.0.0.1:8000/encounters?limit=${limit}`;

    try {
        console.log(`\nFetching encounters list from: ${url} ...`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }

        const data: Encounter[] = await response.json();
        console.log(`--- API Response: ${data.length} Encounters fetched ---`);
        console.log(JSON.stringify(data.slice(0, 2), null, 2));
    } catch (error) {
        console.error("Failed to fetch encounters list:", error);
    }
}

/**
 * Fetch a specific encounter by ID from the FastAPI backend
 */
async function fetchEncounterById(encounterId: number): Promise<void> {
    const url = `http://127.0.0.1:8000/encounters/${encounterId}`;

    try {
        console.log(`\nFetching single encounter from: ${url} ...`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }

        const data: Encounter = await response.json();
        console.log("--- API Response: Single Encounter ---");
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Failed to fetch encounter ${encounterId}:`, error);
    }
}

// Run the API calls
async function run() {
    await fetchEncounters(5);
    await fetchEncounterById(12522);
}

run();