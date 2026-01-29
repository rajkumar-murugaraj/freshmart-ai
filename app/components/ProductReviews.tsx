'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Trash2, MessageSquare, User } from 'lucide-react';
import { api } from '../lib/api';
import { Review } from '../types';
import { toast } from 'react-toastify';

interface ProductReviewsProps {
  productId: string;
  currentUser: { id: string; name: string; role: string } | null;
}

interface ReviewStats {
  total: number;
  average: number;
  breakdown: Record<number, number>;
}

const BAR_COLORS: Record<number, string> = {
  5: 'bg-green-500',
  4: 'bg-green-400',
  3: 'bg-yellow-400',
  2: 'bg-orange-400',
  1: 'bg-red-500',
};

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={
            star <= Math.round(rating)
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300 dark:text-gray-600'
          }
        />
      ))}
    </div>
  );
}

function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            size={28}
            className={
              star <= (hovered || value)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          {value} / 5
        </span>
      )}
    </div>
  );
}

export default function ProductReviews({ productId, currentUser }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, average: 0, breakdown: {} });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getReviews(productId);
      setReviews(data.reviews || []);
      setStats(data.stats || { total: 0, average: 0, breakdown: {} });
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || rating === 0) return;

    setSubmitError('');
    setSubmitting(true);
    try {
      await api.submitReview(productId, currentUser.id, rating, comment.trim() || undefined);
      toast.success('Review submitted successfully!');
      setRating(0);
      setComment('');
      await fetchReviews();
    } catch (err: any) {
      const message = err?.message || 'Failed to submit review';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    setDeletingId(reviewId);
    try {
      await api.deleteReview(reviewId);
      toast.success('Review deleted');
      await fetchReviews();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete review');
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (review: Review) => {
    if (!currentUser) return false;
    return currentUser.role === 'admin' || currentUser.id === review.user_id;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading reviews...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageSquare size={20} />
          Customer Reviews
        </h3>

        {stats.total > 0 ? (
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Average Rating */}
            <div className="flex flex-col items-center justify-center min-w-[120px]">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                {stats.average.toFixed(1)}
              </span>
              <StarRating rating={stats.average} size={20} />
              <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stats.total} {stats.total === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            {/* Breakdown Bars */}
            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.breakdown[star] || 0;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-6 text-right">
                      {star}
                    </span>
                    <Star size={14} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                    <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${BAR_COLORS[star]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-10 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No reviews yet. Be the first to review this product!
          </p>
        )}
      </div>

      {/* Write Review Form */}
      {currentUser && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Write a Review
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Rating
              </label>
              <StarSelector value={rating} onChange={setRating} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your Review
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this product..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:ring-2 focus:ring-green-500 focus:border-transparent
                           resize-none transition-colors"
              />
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400
                         disabled:cursor-not-allowed text-white font-medium rounded-lg
                         transition-colors focus:outline-none focus:ring-2 focus:ring-green-500
                         focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length > 0 ? (
          reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <User size={18} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {review.user_name || 'Anonymous'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StarRating rating={review.rating} size={14} />
                  {canDelete(review) && (
                    <button
                      onClick={() => handleDelete(review.id)}
                      disabled={deletingId === review.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400
                                 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20
                                 disabled:opacity-50"
                      title="Delete review"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {review.comment && (
                <p className="mt-3 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                  {review.comment}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <MessageSquare size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No reviews yet for this product.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
