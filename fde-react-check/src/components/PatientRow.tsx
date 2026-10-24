import type { encounters } from "../type";


export const PatientRow = ({ patient }: { patient: encounters }) => {
    const riskClass = `risk-${patient.risk_level?.toLowerCase() || 'low'}`;
    return (
        <tr>
            <td>{patient.patient_nbr}</td>
            <td>{patient.encounter_id}</td>
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
