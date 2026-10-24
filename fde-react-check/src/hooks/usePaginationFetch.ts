import { useEffect, useState } from "react";
import type { encounters } from "../type";

const ENCOUNTERS_URL = "http://127.0.0.1:8000/encounters";

interface PaginationFetchState {
    encounters: encounters[];
    currentPage: number;
    canGoToPreviousPage: boolean;
    canGoToNextPage: boolean;
    loading: boolean;
    error: string | null;
    goToPreviousPage: () => void;
    goToNextPage: () => void;
    refresh: () => void;
}

export function usePaginationFetch(pageSize = 10): PaginationFetchState {
    const [encounters, setEncounters] = useState<encounters[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [canGoToNextPage, setCanGoToNextPage] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const canGoToPreviousPage = currentPage > 1;

    useEffect(() => {
        const controller = new AbortController();
        let isRedirectingToPreviousPage = false;

        const fetchPage = async () => {
            setLoading(true);
            setError(null);

            try {
                const offset = (currentPage - 1) * pageSize;
                const response = await fetch(
                    `${ENCOUNTERS_URL}?limit=${pageSize + 1}&offset=${offset}`,
                    { signal: controller.signal },
                );

                if (!response.ok) {
                    throw new Error(`Failed to fetch encounters (${response.status})`);
                }

                const fetchedEncounters: encounters[] = await response.json();
                if (fetchedEncounters.length === 0 && currentPage > 1) {
                    isRedirectingToPreviousPage = true;
                    setCurrentPage(currentPage - 1);
                    return;
                }

                setEncounters(fetchedEncounters.slice(0, pageSize));
                setCanGoToNextPage(fetchedEncounters.length > pageSize);
            } catch (fetchError) {
                if (!controller.signal.aborted) {
                    setError(
                        fetchError instanceof Error
                            ? fetchError.message
                            : "Failed to fetch encounters",
                    );
                }
            } finally {
                if (!controller.signal.aborted && !isRedirectingToPreviousPage) {
                    setLoading(false);
                }
            }
        };

        void fetchPage();
        return () => controller.abort();
    }, [currentPage, pageSize, refreshToken]);

    const goToPreviousPage = () => {
        if (canGoToPreviousPage) {
            setCurrentPage((page) => page - 1);
        }
    };
    const goToNextPage = () => {
        if (canGoToNextPage) {
            setCurrentPage((page) => page + 1);
        }
    };
    const refresh = () => {
        setRefreshToken((token) => token + 1);
    };

    return {
        encounters,
        currentPage,
        canGoToPreviousPage,
        canGoToNextPage,
        loading,
        error,
        goToPreviousPage,
        goToNextPage,
        refresh,
    };
}