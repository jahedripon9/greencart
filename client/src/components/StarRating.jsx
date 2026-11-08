import React, { useState } from 'react';
import { assets } from '../assets/assets';

/**
 * Reusable StarRating component supporting read-only display and interactive selection.
 *
 * @param {Object} props
 * @param {number} props.rating - Rating value (0 to 5)
 * @param {boolean} [props.interactive=false] - Whether user can click/hover to select rating
 * @param {Function} [props.onRatingChange] - Callback when rating changes (interactive mode)
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Star icon dimensions
 * @param {boolean} [props.disabled=false] - Whether interactive controls are disabled
 */
const StarRating = ({
    rating = 0,
    interactive = false,
    onRatingChange,
    size = 'md',
    disabled = false
}) => {
    const [hoverRating, setHoverRating] = useState(0);

    const sizeClasses = {
        sm: 'w-3.5 h-3.5',
        md: 'w-4 h-4',
        lg: 'w-6 h-6'
    };
    const iconClass = sizeClasses[size] || sizeClasses.md;

    const displayRating = interactive && hoverRating > 0 ? hoverRating : Math.round(rating);

    const handleKeyDown = (e, starValue) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onRatingChange?.(starValue);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = Math.min(5, (rating || 0) + 1);
            onRatingChange?.(next);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            const prev = Math.max(1, (rating || 0) - 1);
            onRatingChange?.(prev);
        }
    };

    if (!interactive) {
        return (
            <div
                className="flex items-center gap-0.5 select-none"
                role="img"
                aria-label={`${rating} out of 5 stars`}
            >
                {[1, 2, 3, 4, 5].map((star) => (
                    <img
                        key={star}
                        src={star <= displayRating ? assets.star_icon : assets.star_dull_icon}
                        alt=""
                        className={`${iconClass} object-contain`}
                    />
                ))}
            </div>
        );
    }

    return (
        <div
            className="flex items-center gap-1 select-none"
            role="radiogroup"
            aria-label="Star rating selector"
            onMouseLeave={() => !disabled && setHoverRating(0)}
        >
            {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= displayRating;
                const isSelected = star === rating;

                return (
                    <button
                        key={star}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        disabled={disabled}
                        onClick={() => !disabled && onRatingChange?.(star)}
                        onMouseEnter={() => !disabled && setHoverRating(star)}
                        onFocus={() => !disabled && setHoverRating(star)}
                        onBlur={() => !disabled && setHoverRating(0)}
                        onKeyDown={(e) => handleKeyDown(e, star)}
                        className={`p-1 rounded transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'
                        }`}
                    >
                        <img
                            src={isFilled ? assets.star_icon : assets.star_dull_icon}
                            alt=""
                            className={`${iconClass} object-contain pointer-events-none`}
                        />
                    </button>
                );
            })}
        </div>
    );
};

export default StarRating;
