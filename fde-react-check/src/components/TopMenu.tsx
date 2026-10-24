export type PatientScreen = "patient" | "patient1";

interface TopMenuProps {
    activeScreen: PatientScreen;
    onScreenChange: (screen: PatientScreen) => void;
}

export const TopMenu = ({ activeScreen, onScreenChange }: TopMenuProps) => (
    <nav className="patient-top-menu" aria-label="Patient sections">
        <button
            type="button"
            className={`patient-top-menu-item${activeScreen === "patient" ? " active" : ""}`}
            aria-current={activeScreen === "patient" ? "page" : undefined}
            onClick={() => onScreenChange("patient")}
        >
            Patient
        </button>
        <button
            type="button"
            className={`patient-top-menu-item${activeScreen === "patient1" ? " active" : ""}`}
            aria-current={activeScreen === "patient1" ? "page" : undefined}
            onClick={() => onScreenChange("patient1")}
        >
            Patient 1
        </button>
    </nav>
);
