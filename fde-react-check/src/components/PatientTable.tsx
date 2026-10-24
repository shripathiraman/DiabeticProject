import type { ReactNode } from "react";
import type { encounters } from "../type";
import { PatientRow } from "./PatientRow";

interface PatientTableProps {
    patients: encounters[];
    pagination?: ReactNode;
    onEncounterSelect?: (patient: encounters) => void;
}

export const PatientTable = ({ patients, pagination, onEncounterSelect }: PatientTableProps) => {
    return (
        <div className="table-card">
            <div className="table-wrapper">
                <table className="patient-table">
                    <thead>
                        <tr>
                            <th>Patient Nbr</th>
                            <th>Encounter Id</th>
                            <th>Age</th>
                            <th>Time in Hospital</th>
                            <th>Number Inpatient</th>
                            <th>Number Emergency</th>
                            <th>Number Outpatient</th>
                            <th>Num Medications</th>
                            <th>Num Lab Procedures</th>
                            <th>Discharge Disposition Id</th>
                            <th>Admission Type Id</th>
                            <th>Readmitted</th>
                            <th>Risk Score</th>
                            <th>Risk Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        {patients.map((patient) => (
                            <PatientRow
                                key={patient.encounter_id}
                                patient={patient}
                                onEncounterSelect={onEncounterSelect}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
            {pagination}
        </div>
    );
};
