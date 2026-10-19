/**
 * searchPatient.js
 * Frontend controller for Patient Encounter Search & CORS API integration
 * Communicates with FastAPI backend at http://127.0.0.1:8000
 */

// -----------------------------------------------------------------------------
// 1. Configuration & State
// -----------------------------------------------------------------------------
const CONFIG = {
    BASE_URL: 'http://127.0.0.1:8000',
    SEARCH_ENDPOINT: '/patients/search',
    HEALTH_ENDPOINT: '/',
    DEFAULT_LIMIT: 50,
};

const state = {
    patients: [],
    loading: false,
    isConnected: false,
};

// -----------------------------------------------------------------------------
// 2. DOM Elements Cache
// -----------------------------------------------------------------------------
const elements = {
    searchForm: document.getElementById('searchForm'),
    patientNumberInput: document.getElementById('patientNumber'),
    riskLevelSelect: document.getElementById('riskLevel'),
    riskScoreInput: document.getElementById('riskScore'),
    searchBtn: document.getElementById('searchBtn'),
    resetBtn: document.getElementById('resetBtn'),
    
    // Status & Feedback
    apiStatusPill: document.getElementById('apiStatusPill'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    errorBanner: document.getElementById('errorBanner'),
    errorMessage: document.getElementById('errorMessage'),
    
    // Results
    resultsCard: document.getElementById('resultsCard'),
    resultCountBadge: document.getElementById('resultCountBadge'),
    tableContainer: document.getElementById('tableContainer'),
    patientsTableBody: document.getElementById('patientsTableBody'),
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    emptyStateTitle: document.getElementById('emptyStateTitle'),
    emptyStateDesc: document.getElementById('emptyStateDesc'),
    
    // Quick filter chips
    quickFilterChips: document.querySelectorAll('.chip-btn'),
};

// -----------------------------------------------------------------------------
// 3. API Communication
// -----------------------------------------------------------------------------

/**
 * Health check to verify backend connectivity and CORS accessibility
 */
async function checkApiHealth() {
    try {
        const response = await fetch(`${CONFIG.BASE_URL}${CONFIG.HEALTH_ENDPOINT}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
            state.isConnected = true;
            updateStatusPill(true, 'API Connected (Port 8000)');
        } else {
            state.isConnected = false;
            updateStatusPill(false, `API Error (${response.status})`);
        }
    } catch (err) {
        state.isConnected = false;
        updateStatusPill(false, 'API Offline / CORS Blocked');
        console.warn('Backend health check failed:', err);
    }
}

/**
 * Query /patients/search with flexible filters
 */
async function fetchPatients(params = {}) {
    hideError();
    setLoading(true);

    try {
        const url = new URL(`${CONFIG.BASE_URL}${CONFIG.SEARCH_ENDPOINT}`);
        
        if (params.patient_nbr !== undefined && params.patient_nbr !== '') {
            url.searchParams.append('patient_nbr', params.patient_nbr);
        }
        if (params.risk_level && params.risk_level !== 'ALL') {
            url.searchParams.append('risk_level', params.risk_level);
        }
        if (params.risk_score !== undefined && params.risk_score !== '') {
            url.searchParams.append('risk_score', params.risk_score);
        }
        url.searchParams.append('limit', params.limit || CONFIG.DEFAULT_LIMIT);

        console.log(`[API Call] Fetching: ${url.toString()}`);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            let detail = response.statusText;
            try {
                const errData = await response.json();
                if (errData.detail) detail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
            } catch (_) { /* ignore JSON parse error */ }
            throw new Error(`Server returned HTTP ${response.status}: ${detail}`);
        }

        const data = await response.json();
        state.patients = Array.isArray(data) ? data : [];
        renderTable(state.patients);
        updateStatusPill(true, 'API Connected (Port 8000)');

    } catch (error) {
        console.error('Fetch error:', error);
        state.patients = [];
        renderTable([]);
        
        let message = error.message;
        if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
            message = `Unable to connect to FastAPI backend at ${CONFIG.BASE_URL}. Ensure uvicorn is running: "python -m uvicorn backend.app.main:app --reload --port 8000"`;
            updateStatusPill(false, 'API Disconnected');
        }
        showError(message);
    } finally {
        setLoading(false);
    }
}

// -----------------------------------------------------------------------------
// 4. UI Rendering Functions
// -----------------------------------------------------------------------------

/**
 * Render patient records into the HTML table
 */
function renderTable(patients) {
    elements.patientsTableBody.innerHTML = '';
    elements.resultCountBadge.textContent = `${patients.length} Record${patients.length === 1 ? '' : 's'}`;

    if (!patients || patients.length === 0) {
        elements.tableContainer.style.display = 'none';
        elements.emptyState.style.display = 'flex';
        if (elements.emptyStateTitle) elements.emptyStateTitle.textContent = 'No Matching Encounters Found';
        if (elements.emptyStateDesc) elements.emptyStateDesc.textContent = 'Try adjusting your Patient Number, Risk Level, or Risk Score filters.';
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.tableContainer.style.display = 'block';
    elements.tableContainer.scrollLeft = 0;

    const fragment = document.createDocumentFragment();

    patients.forEach(patient => {
        const tr = document.createElement('tr');

        // Formatted values
        const encounterId = escapeHtml(String(patient.encounter_id ?? '-'));
        const patientNbr = escapeHtml(String(patient.patient_nbr ?? '-'));
        const age = escapeHtml(String(patient.age ?? '-'));
        const timeInHospital = patient.time_in_hospital != null ? `${patient.time_in_hospital} days` : '-';
        const riskScore = escapeHtml(String(patient.risk_score ?? '-'));
        const riskLevel = patient.risk_level || 'UNKNOWN';
        const readmitted = patient.readmitted || 'NO';
        const inpatient = patient.number_inpatient ?? 0;
        const emergency = patient.number_emergency ?? 0;
        const outpatient = patient.number_outpatient ?? 0;
        const medications = patient.num_medications ?? 0;
        const interventionStatus = patient.intervention_status || patient.status || null;

        tr.innerHTML = `
            <td>
                <a href="intervention.html?encounter_id=${encodeURIComponent(patient.encounter_id)}&patient_nbr=${encodeURIComponent(patient.patient_nbr)}" 
                   class="encounter-id-link" 
                   title="Click to view and update care intervention for Encounter #${encounterId}">
                    <strong>#${encounterId}</strong>
                    <span class="link-arrow">&rarr;</span>
                </a>
            </td>
            <td><span class="patient-id-badge">${patientNbr}</span></td>
            <td>${age}</td>
            <td>${timeInHospital}</td>
            <td><strong>${riskScore}</strong> / 8</td>
            <td>${createRiskBadgeHtml(riskLevel)}</td>
            <td>${createReadmittedHtml(readmitted)}</td>
            <td><small>In: ${inpatient} | ER: ${emergency} | Out: ${outpatient}</small></td>
            <td>${medications} meds</td>
            <td>${createStatusBadgeHtml(interventionStatus)}</td>
        `;

        fragment.appendChild(tr);
    });

    elements.patientsTableBody.appendChild(fragment);
}

/**
 * HTML Badge for Risk Level
 */
function createRiskBadgeHtml(level) {
    const normalized = (level || '').toUpperCase();
    let badgeClass = 'risk-low';
    if (normalized === 'HIGH') badgeClass = 'risk-high';
    else if (normalized === 'MEDIUM') badgeClass = 'risk-medium';

    return `<span class="risk-badge ${badgeClass}">${escapeHtml(normalized)}</span>`;
}

/**
 * HTML Badge for Intervention Status
 */
function createStatusBadgeHtml(status) {
    if (!status) {
        return `<span class="status-badge status-none">None</span>`;
    }
    const normalized = status.toUpperCase();
    const className = `status-${normalized.toLowerCase()}`;
    const readable = normalized.replace(/_/g, ' ');

    return `<span class="status-badge ${className}">${escapeHtml(readable)}</span>`;
}

/**
 * HTML tag for readmission status
 */
function createReadmittedHtml(val) {
    const clean = String(val).trim();
    if (clean === '<30') {
        return `<span class="readmitted-tag urgent" title="Readmitted in less than 30 days">&lt; 30 Days</span>`;
    } else if (clean === '>30') {
        return `<span class="readmitted-tag later" title="Readmitted after 30 days">&gt; 30 Days</span>`;
    } else {
        return `<span class="readmitted-tag no">No</span>`;
    }
}

/**
 * Update UI connection status pill
 */
function updateStatusPill(connected, text) {
    if (connected) {
        elements.statusDot.classList.remove('disconnected');
        elements.statusText.textContent = text || 'API Connected';
    } else {
        elements.statusDot.classList.add('disconnected');
        elements.statusText.textContent = text || 'API Disconnected';
    }
}

/**
 * Toggle loading state
 */
function setLoading(isLoading) {
    state.loading = isLoading;
    if (isLoading) {
        elements.loadingState.style.display = 'flex';
        elements.emptyState.style.display = 'none';
        elements.tableContainer.style.display = 'none';
        elements.searchBtn.disabled = true;
        elements.searchBtn.innerHTML = `Searching...`;
    } else {
        elements.loadingState.style.display = 'none';
        elements.searchBtn.disabled = false;
        elements.searchBtn.innerHTML = `Search <span class="arrow">&gt;</span>`;
    }
}

/**
 * Display error banner
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorBanner.classList.add('visible');
}

/**
 * Hide error banner
 */
function hideError() {
    elements.errorBanner.classList.remove('visible');
    elements.errorMessage.textContent = '';
}

/**
 * Sanitize HTML strings
 */
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// -----------------------------------------------------------------------------
// 5. Event Handlers
// -----------------------------------------------------------------------------

/**
 * Form Submission handler
 */
function handleSearch(e) {
    if (e) e.preventDefault();

    hideError();

    const patientNbr = elements.patientNumberInput.value.trim();
    const riskLevel = elements.riskLevelSelect.value.trim();
    const riskScore = elements.riskScoreInput.value.trim();

    // Validation: Require at least one search field
    if (!patientNbr && !riskLevel && riskScore === '') {
        showError('Please provide at least one search field: Patient Number, Risk Level, or Risk Score.');
        elements.tableContainer.style.display = 'none';
        elements.emptyState.style.display = 'flex';
        if (elements.emptyStateTitle) elements.emptyStateTitle.textContent = 'Search Criteria Required';
        if (elements.emptyStateDesc) elements.emptyStateDesc.textContent = 'Please enter a Patient Number, select a Risk Level, or enter a Risk Score before searching.';
        elements.resultCountBadge.textContent = '0 Records';
        return;
    }

    // Validation for risk score range
    if (riskScore !== '') {
        const scoreNum = Number(riskScore);
        if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 8) {
            showError('Risk Score must be a number between 0 and 8.');
            elements.riskScoreInput.focus();
            return;
        }
    }

    // Validation for patient number
    if (patientNbr !== '') {
        const idNum = Number(patientNbr);
        if (isNaN(idNum) || idNum <= 0) {
            showError('Please enter a valid positive numeric Patient Number.');
            elements.patientNumberInput.focus();
            return;
        }
    }

    const params = {};
    if (patientNbr) params.patient_nbr = Number(patientNbr);
    if (riskLevel) params.risk_level = riskLevel;
    if (riskScore !== '') params.risk_score = Number(riskScore);

    try {
        sessionStorage.setItem('last_patient_search', JSON.stringify(params));
    } catch (_) {}

    fetchPatients(params);
}

/**
 * Reset / Clear Form handler
 */
function handleReset() {
    try {
        sessionStorage.removeItem('last_patient_search');
    } catch (_) {}

    elements.searchForm.reset();
    hideError();
    state.patients = [];
    elements.patientsTableBody.innerHTML = '';
    elements.tableContainer.style.display = 'none';
    elements.emptyState.style.display = 'flex';
    if (elements.emptyStateTitle) elements.emptyStateTitle.textContent = 'No Search Criteria Provided';
    if (elements.emptyStateDesc) elements.emptyStateDesc.textContent = 'Please enter a Patient Number, select a Risk Level, or enter a Risk Score, then click Search.';
    elements.resultCountBadge.textContent = '0 Records';
}

/**
 * Quick filter chip handler
 */
function handleQuickFilter(e) {
    const btn = e.target.closest('.chip-btn');
    if (!btn) return;

    const patient = btn.dataset.patient;
    const level = btn.dataset.level;
    const score = btn.dataset.score;

    elements.searchForm.reset();

    if (patient) elements.patientNumberInput.value = patient;
    if (level) elements.riskLevelSelect.value = level;
    if (score !== undefined) elements.riskScoreInput.value = score;

    handleSearch();
}

// -----------------------------------------------------------------------------
// 6. Initialization
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Bind Event Listeners
    if (elements.searchForm) {
        elements.searchForm.addEventListener('submit', handleSearch);
    }
    if (elements.resetBtn) {
        elements.resetBtn.addEventListener('click', handleReset);
    }
    if (elements.quickFilterChips) {
        elements.quickFilterChips.forEach(chip => {
            chip.addEventListener('click', handleQuickFilter);
        });
    }

    // Health check verification
    checkApiHealth();

    // Check for saved search parameters (e.g. when returning from intervention update page)
    try {
        const saved = sessionStorage.getItem('last_patient_search');
        if (saved) {
            const params = JSON.parse(saved);
            let hasParams = false;
            if (params.patient_nbr) {
                elements.patientNumberInput.value = params.patient_nbr;
                hasParams = true;
            }
            if (params.risk_level) {
                elements.riskLevelSelect.value = params.risk_level;
                hasParams = true;
            }
            if (params.risk_score !== undefined && params.risk_score !== null) {
                elements.riskScoreInput.value = params.risk_score;
                hasParams = true;
            }
            if (hasParams) {
                fetchPatients(params);
            }
        }
    } catch (_) {}

    // Fullscreen table view toggle
    const fullscreenBtn = document.getElementById('fullscreenToggleBtn');
    const resultsCard = document.getElementById('resultsCard');
    const fullscreenText = document.getElementById('fullscreenBtnText');

    if (fullscreenBtn && resultsCard) {
        fullscreenBtn.addEventListener('click', () => {
            const isFull = resultsCard.classList.toggle('is-fullscreen');
            if (fullscreenText) {
                fullscreenText.textContent = isFull ? 'Exit Full Screen' : 'Full Screen';
            }
            if (elements.tableContainer) {
                elements.tableContainer.scrollLeft = 0;
            }
        });

        // Exit full screen with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && resultsCard.classList.contains('is-fullscreen')) {
                resultsCard.classList.remove('is-fullscreen');
                if (fullscreenText) fullscreenText.textContent = 'Full Screen';
            }
        });
    }
});
