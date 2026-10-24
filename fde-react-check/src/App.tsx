import { useState } from 'react'
import './App.css'
import { Header } from './components/Header'
import { AddEncounterModal } from './components/AddEncounterModal'
import { EncounterDetailsModal } from './components/EncounterDetailsModal'
import { PatientTable } from './components/PatientTable'
import { Pagination } from './components/Pagination'
import { SearchPatient } from './components/SearchPatient'
import { TopMenu, type PatientScreen } from './components/TopMenu'
import { usePaginationFetch } from './hooks/usePaginationFetch'
import type { encounters } from './type'

export const App = () => {
  const [activeScreen, setActiveScreen] = useState<PatientScreen>('patient')
  const [selectedEncounter, setSelectedEncounter] = useState<encounters | null>(null)
  const [isAddEncounterOpen, setIsAddEncounterOpen] = useState(false)
  const {
    encounters,
    currentPage,
    canGoToPreviousPage,
    canGoToNextPage,
    loading,
    error,
    goToPreviousPage,
    goToNextPage,
    refresh,
  } = usePaginationFetch()

  const openEncounterDetails = (patient: encounters) => {
    setSelectedEncounter(patient)
  }

  return (
    <>
      <div className="app-container">
        <Header
          onAddEncounter={
            activeScreen === 'patient1'
              ? () => setIsAddEncounterOpen(true)
              : undefined
          }
        />
        <TopMenu activeScreen={activeScreen} onScreenChange={setActiveScreen} />
        {activeScreen === 'patient' ? (
          <SearchPatient onSelectEncounter={openEncounterDetails} />
        ) : (
          <>
            {loading && <p className="status-message status-loading">Loading encounters...</p>}
            {error && <p className="status-message status-error" role="alert">Error: {error}</p>}
            {!loading && !error && (
              <PatientTable
                patients={encounters}
                onEncounterSelect={openEncounterDetails}
                pagination={
                  <Pagination
                    currentPage={currentPage}
                    canGoToPreviousPage={canGoToPreviousPage}
                    canGoToNextPage={canGoToNextPage}
                    disabled={loading}
                    onPreviousPage={goToPreviousPage}
                    onNextPage={goToNextPage}
                  />
                }
              />
            )}
          </>
        )}
        <AddEncounterModal
          isOpen={isAddEncounterOpen && activeScreen === 'patient1'}
          onClose={() => setIsAddEncounterOpen(false)}
          onSuccess={refresh}
        />
        {selectedEncounter && (
          <EncounterDetailsModal
            encounter={selectedEncounter}
            onClose={() => setSelectedEncounter(null)}
          />
        )}
      </div>
    </>
  )
}

export default App
