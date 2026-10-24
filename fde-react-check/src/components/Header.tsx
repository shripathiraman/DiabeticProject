interface HeaderProps {
    onAddEncounter?: () => void;
}

export const Header = ({ onAddEncounter }: HeaderProps) => {
    return (
        <div className='app-header'>
            <div>
                <h1>Diabetic Project</h1>
                <p>Hospital Encounter & Readmission Risk Management</p>
            </div>
            {onAddEncounter && (
                <button
                    type="button"
                    className="btn-primary"
                    onClick={onAddEncounter}
                    id="btn-add-encounter"
                >
                    + Add Encounter
                </button>
            )}
        </div>
    );
};