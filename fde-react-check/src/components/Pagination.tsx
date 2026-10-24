interface PaginationProps {
    currentPage: number;
    canGoToPreviousPage: boolean;
    canGoToNextPage: boolean;
    disabled?: boolean;
    onPreviousPage: () => void;
    onNextPage: () => void;
}

export const Pagination = ({
    currentPage,
    canGoToPreviousPage,
    canGoToNextPage,
    disabled = false,
    onPreviousPage,
    onNextPage,
}: PaginationProps) => {
    return (
        <nav className="pagination-container" aria-label="Encounter pages">
            <div className="pagination-controls">
                <button
                    type="button"
                    className="pagination-btn"
                    onClick={onPreviousPage}
                    disabled={disabled || !canGoToPreviousPage}
                    aria-label="Previous page"
                    title="Previous page"
                >
                    {"<"}
                </button>
                <span className="pagination-page-btn active pagination-current-page" aria-current="page" aria-live="polite">
                    {currentPage}
                </span>
                <button
                    type="button"
                    className="pagination-btn"
                    onClick={onNextPage}
                    disabled={disabled || !canGoToNextPage}
                    aria-label="Next page"
                    title="Next page"
                >
                    {">"}
                </button>
            </div>
        </nav>
    );
};