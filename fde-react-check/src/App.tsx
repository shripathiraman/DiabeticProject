import { useState } from 'react'
import './App.css'
import { Header } from './components/Header'
import { PatientTable } from './components/PatientTable'
import { AddEncounterModal } from './components/AddEncounterModal'
import { Pagination } from './components/Pagination'
import { usePaginationFetch } from './hooks/usePaginationFetch'

export const App = () => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
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

  return (
    <>
      <div className="app-container">
        <Header onAddEncounter={() => setIsModalOpen(true)} />
        {loading && <p className="status-message status-loading">Loading encounters...</p>}
        {error && <p className="status-message status-error">Error: {error}</p>}
        {!loading && !error && (
          <PatientTable
            patients={encounters}
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

        <AddEncounterModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={refresh}
        />
      </div>
    </>
  )
}

export default App
