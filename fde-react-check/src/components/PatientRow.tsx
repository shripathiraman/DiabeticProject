import type { encounters } from "../type";

interface PatientRowProps {
    patient: encounters;
    onEncounterSelect?: (patient: encounters) => void;
}

export const PatientRow = ({ patient, onEncounterSelect }: PatientRowProps) => {
    const riskClass = `risk-${patient.risk_level?.toLowerCase() || 'low'}`;
    return (
        <tr>
            <td>{patient.patient_nbr}</td>
            <td>
                {onEncounterSelect ? (
                    <button
                        type="button"
                        className="encounter-link"
                        onClick={() => onEncounterSelect(patient)}
                        aria-label={`View details for encounter ${patient.encounter_id}`}
                    >
                        {patient.encounter_id}
                    </button>
                ) : (
                    patient.encounter_id
                )}
            </td>
            <td>{patient.age}</td>
            <td>{patient.time_in_hospital}</td>
            <td>{patient.number_inpatient}</td>
            <td>{patient.number_emergency}</td>
            <td>{patient.number_outpatient}</td>
            <td>{patient.num_medications}</td>
            <td>{patient.num_lab_procedures}</td>
            <td>{patient.discharge_disposition_id}</td>
            <td>{patient.admission_type_id}</td>
            <td>{patient.readmitted}</td>
            <td>{patient.risk_score}</td>
            <td>
                <span className={`badge ${riskClass}`}>
                    {patient.risk_level}
                </span>
            </td>
        </tr>
    );
};
