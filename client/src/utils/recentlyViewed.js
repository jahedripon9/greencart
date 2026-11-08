const STORAGE_KEY = 'greencart_recently_viewed';
const MAX_RECENTLY_VIEWED = 10;

/**
 * Record a product view in localStorage.
 * Keeps at most 10 unique product IDs, ordered by most recent first.
 * Dispatches an event for cross-component reactivity.
 */
export const trackRecentlyViewed = (productId) => {
    if (!productId || typeof productId !== 'string' || typeof window === 'undefined') {
        return;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        let items = [];
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    items = parsed;
                }
            } catch {
                items = [];
            }
        }

        // Remove any previous occurrence of this product ID
        items = items.filter(item => {
            const itemId = typeof item === 'string' ? item : item?.id;
            return itemId && itemId !== productId;
        });

        // Add to front with timestamp
        items.unshift({
            id: productId,
            timestamp: Date.now()
        });

        // Enforce maximum 10 products
        const trimmed = items.slice(0, MAX_RECENTLY_VIEWED);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

        // Notify active components
        window.dispatchEvent(new CustomEvent('recently_viewed_updated'));
    } catch (err) {
        // Silently handle quota or disabled storage
        console.warn("Could not record recently viewed product:", err);
    }
};

/**
 * Retrieve the list of recently viewed product IDs (most recent first).
 */
export const getRecentlyViewedIds = () => {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map(item => (typeof item === 'string' ? item : item?.id))
            .filter(Boolean);
    } catch {
        return [];
    }
};

/**
 * Clear recently viewed products history.
 */
export const clearRecentlyViewed = () => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('recently_viewed_updated'));
    } catch (err) {
        console.warn("Could not clear recently viewed products:", err);
    }
};
