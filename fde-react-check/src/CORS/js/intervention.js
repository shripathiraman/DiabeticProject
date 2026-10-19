/**
 * updateIntervention.js
 * Frontend controller for Care Intervention Details & Update Management
 * Communicates with FastAPI backend at http://127.0.0.1:8000
 */

// -----------------------------------------------------------------------------
// 1. Configuration & State
// -----------------------------------------------------------------------------
const CONFIG = {
    BASE_URL: 'http://127.0.0.1:8000',
    INTERVENTIONS_ENDPOINT: '/interventions',
    HEALTH_ENDPOINT: '/',
};

const state = {
    encounterId: null,
    patientNbr: null,
    currentIntervention: null,
    updatesHistory: [],
    loading: false,
    isConnected: false,
};

// -----------------------------------------------------------------------------
// 2. DOM Elements Cache
// -----------------------------------------------------------------------------
const elements = {
    interventionForm: document.getElementById('interventionForm'),
    encounterIdInput: document.getElementById('encounterIdInput'),
    patientNumberInput: document.getElementById('patientNumberInput'),
    statusSelect: document.getElementById('statusSelect'),
    assignedToInput: document.getElementById('assignedToInput'),
    notesInput: document.getElementById('notesInput'),
    updateBtn: document.getElementById('updateBtn'),
    fetchStatusBtn: document.getElementById('fetchStatusBtn'),
    backToSearchBtn: document.getElementById('backToSearchBtn'),

    // Badges & Status
    encounterRiskBadge: document.getElementById('encounterRiskBadge'),
    encounterStatusBadge: document.getElementById('encounterStatusBadge'),
    apiStatusPill: document.getElementById('apiStatusPill'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    errorBanner: document.getElementById('errorBanner'),
    errorMessage: document.getElementById('errorMessage'),
    successBanner: document.getElementById('successBanner'),
    successMessage: document.getElementById('successMessage'),

    // List the update here section
    updateCountBadge: document.getElementById('updateCountBadge'),
    updatesTableContainer: document.getElementById('updatesTableContainer'),
    updatesTableBody: document.getElementById('updatesTableBody'),
    noUpdatesState: document.getElementById('noUpdatesState'),
    noUpdatesTitle: document.getElementById('noUpdatesTitle'),
    noUpdatesDesc: document.getElementById('noUpdatesDesc'),
    interventionLoadingState: document.getElementById('interventionLoadingState'),
};

let successTimeout = null;

// -----------------------------------------------------------------------------
// 3. API Communication
// -----------------------------------------------------------------------------

/**
 * Health check to verify backend connectivity
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
 * Fetch intervention status for an encounter ID (GET /interventions/{encounter_id})
 */
async function fetchInterventionStatus(encounterId) {
    if (!encounterId) return;

    hideError();
    hideSuccess();
    setLoading(true);

    try {
        const url = `${CONFIG.BASE_URL}${CONFIG.INTERVENTIONS_ENDPOINT}/${encounterId}`;
        console.log(`[API Call] Fetching intervention: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
            let detail = response.statusText;
            try {
                const errData = await response.json();
                if (errData.detail) detail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
            } catch (_) {}
            throw new Error(`Encounter #${encounterId} fetch error: ${detail}`);
        }

        const data = await response.json();
        state.currentIntervention = data;
        state.encounterId = data.encounter_id;
        state.patientNbr = data.patient_nbr;

        // Populate Form Fields
        populateForm(data);

        // Load or initialize updates history from session storage
        loadUpdateHistory(data.encounter_id, data);

        updateStatusPill(true, 'API Connected (Port 8000)');
    } catch (error) {
        console.error('Fetch intervention error:', error);
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

/**
 * Submit care intervention updates (PATCH /interventions/{encounter_id})
 */
async function submitInterventionUpdate(e) {
    if (e) e.preventDefault();

    hideError();
    hideSuccess();

    const encounterIdVal = elements.encounterIdInput.value.trim();
    if (!encounterIdVal) {
        showError('Please provide a valid Encounter ID.');
        elements.encounterIdInput.focus();
        return;
    }

    const encounterId = Number(encounterIdVal);
    if (isNaN(encounterId) || encounterId <= 0) {
        showError('Encounter ID must be a positive integer.');
        elements.encounterIdInput.focus();
        return;
    }

    const status = elements.statusSelect.value;
    const assignedTo = elements.assignedToInput.value.trim() || null;
    const notes = elements.notesInput.value.trim() || null;

    setUpdating(true);

    try {
        const url = `${CONFIG.BASE_URL}${CONFIG.INTERVENTIONS_ENDPOINT}/${encounterId}`;
        const payload = {
            status: status,
            assigned_to: assignedTo,
            notes: notes,
        };

        console.log(`[API Call] Submitting update to ${url}:`, payload);

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let detail = response.statusText;
            try {
                const errData = await response.json();
                if (errData.detail) detail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
            } catch (_) {}
            throw new Error(`Failed to update intervention: ${detail}`);
        }

        const updatedData = await response.json();
        state.currentIntervention = updatedData;
        state.encounterId = updatedData.encounter_id;
        if (updatedData.patient_nbr) state.patientNbr = updatedData.patient_nbr;

        // Update form values and badges
        populateForm(updatedData);

        // Record update entry in history
        const record = {
            timestamp: new Date().toISOString(),
            encounter_id: updatedData.encounter_id,
            patient_nbr: updatedData.patient_nbr || state.patientNbr || '-',
            status: updatedData.status,
            assigned_to: updatedData.assigned_to || 'Unassigned',
            notes: updatedData.notes || 'No notes provided',
            isLatest: true,
        };

        addUpdateHistoryRecord(encounterId, record);

        showSuccess(`Care intervention for Encounter #${encounterId} successfully updated and persisted in database.`);

    } catch (error) {
        console.error('Update error:', error);
        showError(error.message);
    } finally {
        setUpdating(false);
    }
}

// -----------------------------------------------------------------------------
// 4. UI Rendering & History Management
// -----------------------------------------------------------------------------

/**
 * Populate UI form fields from intervention data object
 */
function populateForm(data) {
    if (!data) return;

    elements.encounterIdInput.value = data.encounter_id ?? '';
    if (data.patient_nbr != null) {
        elements.patientNumberInput.value = data.patient_nbr;
    }

    if (data.status) {
        elements.statusSelect.value = data.status;
    }
    elements.assignedToInput.value = data.assigned_to || '';
    elements.notesInput.value = data.notes || '';

    // Badges
    if (data.risk_level) {
        elements.encounterRiskBadge.textContent = `${data.risk_level} RISK (Score ${data.risk_score ?? '-'})`;
        elements.encounterRiskBadge.className = `risk-badge risk-${data.risk_level.toLowerCase()}`;
        elements.encounterRiskBadge.style.display = 'inline-flex';
    } else {
        elements.encounterRiskBadge.style.display = 'none';
    }

    if (data.status) {
        elements.encounterStatusBadge.textContent = data.status.replace(/_/g, ' ');
        elements.encounterStatusBadge.className = `status-badge status-${data.status.toLowerCase()}`;
        elements.encounterStatusBadge.style.display = 'inline-flex';
    } else {
        elements.encounterStatusBadge.style.display = 'none';
    }
}

/**
 * Load or initialize history for a specific encounter
 */
function loadUpdateHistory(encounterId, currentData) {
    const storageKey = `intervention_updates_${encounterId}`;
    let history = [];

    try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
            history = JSON.parse(stored);
        }
    } catch (_) {}

    // If no prior updates recorded in this session, seed with the current record from PostgreSQL
    if (!history || history.length === 0) {
        history = [{
            timestamp: currentData.updated_at || currentData.created_at || new Date().toISOString(),
            encounter_id: currentData.encounter_id,
            patient_nbr: currentData.patient_nbr || '-',
            status: currentData.status,
            assigned_to: currentData.assigned_to || 'Unassigned',
            notes: currentData.notes || 'Current active care record',
            isLatest: true,
        }];
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(history));
        } catch (_) {}
    }

    state.updatesHistory = history;
    renderUpdatesTable();
}

/**
 * Add a new record to the update history and persist
 */
function addUpdateHistoryRecord(encounterId, record) {
    // Mark previous latest as not latest
    state.updatesHistory.forEach(item => item.isLatest = false);

    // Prepend latest update
    state.updatesHistory.unshift(record);

    const storageKey = `intervention_updates_${encounterId}`;
    try {
        sessionStorage.setItem(storageKey, JSON.stringify(state.updatesHistory));
    } catch (_) {}

    renderUpdatesTable();
}

/**
 * Render the "List the update here" table
 */
function renderUpdatesTable() {
    elements.updatesTableBody.innerHTML = '';
    const records = state.updatesHistory || [];
    elements.updateCountBadge.textContent = `${records.length} Update${records.length === 1 ? '' : 's'}`;

    if (records.length === 0) {
        elements.updatesTableContainer.style.display = 'none';
        elements.noUpdatesState.style.display = 'flex';
        return;
    }

    elements.noUpdatesState.style.display = 'none';
    elements.updatesTableContainer.style.display = 'block';

    const fragment = document.createDocumentFragment();

    records.forEach(item => {
        const tr = document.createElement('tr');
        if (item.isLatest) {
            tr.classList.add('latest-update-row');
        }

        const formattedTime = formatTimestamp(item.timestamp);
        const statusHtml = createStatusBadgeHtml(item.status);
        const notesHtml = escapeHtml(item.notes || 'None');
        const assignedHtml = escapeHtml(item.assigned_to || 'Unassigned');
        const encounterIdHtml = escapeHtml(String(item.encounter_id));
        const patientNbrHtml = escapeHtml(String(item.patient_nbr));

        tr.innerHTML = `
            <td>
                <span class="update-timestamp">${formattedTime}</span>
                ${item.isLatest ? '<span class="update-tag-latest">LATEST</span>' : ''}
            </td>
            <td><strong>#${encounterIdHtml}</strong></td>
            <td><span class="patient-id-badge">${patientNbrHtml}</span></td>
            <td>${statusHtml}</td>
            <td><span class="assigned-user-pill">${assignedHtml}</span></td>
            <td class="notes-cell">${notesHtml}</td>
            <td><span class="persisted-pill"><span class="check-icon">&#10003;</span> Persisted</span></td>
        `;

        fragment.appendChild(tr);
    });

    elements.updatesTableBody.appendChild(fragment);
}

/**
 * Format timestamps nicely for clinicians
 */
function formatTimestamp(isoStr) {
    if (!isoStr) return '-';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    } catch (_) {
        return isoStr;
    }
}

/**
 * HTML Badge for Intervention Status
 */
function createStatusBadgeHtml(status) {
    if (!status) return `<span class="status-badge status-none">None</span>`;
    const normalized = status.toUpperCase();
    const className = `status-${normalized.toLowerCase()}`;
    const readable = normalized.replace(/_/g, ' ');
    return `<span class="status-badge ${className}">${escapeHtml(readable)}</span>`;
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
 * Toggle initial data loading state
 */
function setLoading(isLoading) {
    state.loading = isLoading;
    if (isLoading) {
        elements.interventionLoadingState.style.display = 'flex';
        elements.noUpdatesState.style.display = 'none';
        elements.updatesTableContainer.style.display = 'none';
        elements.fetchStatusBtn.disabled = true;
    } else {
        elements.interventionLoadingState.style.display = 'none';
        elements.fetchStatusBtn.disabled = false;
    }
}

/**
 * Toggle button state while updating
 */
function setUpdating(isUpdating) {
    if (isUpdating) {
        elements.updateBtn.disabled = true;
        elements.updateBtn.innerHTML = `Updating...`;
    } else {
        elements.updateBtn.disabled = false;
        elements.updateBtn.innerHTML = `Update <span class="arrow-down">&#9662;</span>`;
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
 * Display success banner
 */
function showSuccess(message) {
    if (successTimeout) clearTimeout(successTimeout);
    elements.successMessage.textContent = message;
    elements.successBanner.classList.add('visible');

    successTimeout = setTimeout(() => {
        elements.successBanner.classList.remove('visible');
    }, 5000);
}

/**
 * Hide success banner
 */
function hideSuccess() {
    elements.successBanner.classList.remove('visible');
    elements.successMessage.textContent = '';
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
// 5. Initialization & URL Param Handling
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // 1. Health check
    checkApiHealth();

    // 2. Parse URL parameters (e.g. ?encounter_id=67162368&patient_nbr=84002391)
    const urlParams = new URLSearchParams(window.location.search);
    const encounterIdParam = urlParams.get('encounter_id');
    const patientNbrParam = urlParams.get('patient_nbr');

    if (patientNbrParam) {
        elements.patientNumberInput.value = patientNbrParam;
        state.patientNbr = Number(patientNbrParam);
    }

    if (encounterIdParam) {
        const id = Number(encounterIdParam);
        if (!isNaN(id) && id > 0) {
            elements.encounterIdInput.value = id;
            state.encounterId = id;
            fetchInterventionStatus(id);
        }
    }

    // 3. Form Submit Event (Update button)
    if (elements.interventionForm) {
        elements.interventionForm.addEventListener('submit', submitInterventionUpdate);
    }

    // 4. Fetch Status button
    if (elements.fetchStatusBtn) {
        elements.fetchStatusBtn.addEventListener('click', () => {
            const val = elements.encounterIdInput.value.trim();
            if (val) {
                const id = Number(val);
                if (!isNaN(id) && id > 0) {
                    fetchInterventionStatus(id);
                } else {
                    showError('Please enter a valid positive numeric Encounter ID.');
                }
            } else {
                showError('Please enter an Encounter ID to fetch status.');
            }
        });
    }

    // 5. Optional: When user finishes typing in encounterIdInput, offer quick lookup
    if (elements.encounterIdInput) {
        elements.encounterIdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                elements.fetchStatusBtn.click();
            }
        });
    }
});
