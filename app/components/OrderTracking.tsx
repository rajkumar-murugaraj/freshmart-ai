'use client';

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { OrderStatus, OrderStatusHistory } from '../types';
import {
  Package,
  CheckCircle,
  XCircle,
  Truck,
  MapPin,
  Clock,
  ArrowLeft,
  Box,
} from 'lucide-react';

interface OrderTrackingProps {
  orderId: string;
  onBack: () => void;
}

const STATUS_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Order Placed',
  confirmed: 'Order Confirmed',
  processing: 'Preparing Order',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending: <Clock className="w-5 h-5" />,
  confirmed: <CheckCircle className="w-5 h-5" />,
  processing: <Box className="w-5 h-5" />,
  shipped: <Package className="w-5 h-5" />,
  out_for_delivery: <Truck className="w-5 h-5" />,
  delivered: <MapPin className="w-5 h-5" />,
  completed: <CheckCircle className="w-5 h-5" />,
  cancelled: <XCircle className="w-5 h-5" />,
};

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function OrderTracking({ orderId, onBack }: OrderTrackingProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<OrderStatus | null>(null);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getOrderStatusHistory(orderId);
        setCurrentStatus(data.currentStatus as OrderStatus);
        setHistory(data.history || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load order tracking data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [orderId]);

  const isCancelled = currentStatus === 'cancelled';

  // Build a map from status to its history entry for quick lookup
  const historyMap = new Map<string, OrderStatusHistory>();
  for (const entry of history) {
    historyMap.set(entry.status, entry);
  }

  // Determine the index of the current status in the flow
  const currentFlowIndex = currentStatus
    ? STATUS_FLOW.indexOf(currentStatus)
    : -1;

  function getStepState(
    status: OrderStatus,
    index: number
  ): 'completed' | 'current' | 'future' {
    if (isCancelled) {
      // If cancelled, show all steps that have history entries as completed
      if (historyMap.has(status)) {
        if (status === currentStatus) return 'current';
        return 'completed';
      }
      return 'future';
    }
    if (index < currentFlowIndex) return 'completed';
    if (index === currentFlowIndex) return 'current';
    return 'future';
  }

  // Skeleton loader
  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-6">
        {/* Back button skeleton */}
        <div className="mb-6">
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
        {/* Header skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        {/* Timeline skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 mb-8 last:mb-0">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse flex-shrink-0" />
              <div className="flex-1 pt-1">
                <div className="h-5 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
                <div className="h-4 w-48 bg-gray-100 dark:bg-gray-600 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-700 dark:text-red-300 font-medium text-lg">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 rounded-lg hover:bg-red-200 dark:hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Build the timeline steps
  const timelineSteps = STATUS_FLOW.map((status, index) => {
    const state = getStepState(status, index);
    const historyEntry = historyMap.get(status);
    return { status, state, historyEntry, index };
  });

  // If cancelled, add the cancelled step at the end
  const cancelledEntry = historyMap.get('cancelled');

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back</span>
      </button>

      {/* Order Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Order Tracking
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
              ID: {orderId}
            </p>
          </div>
          <div>
            {currentStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  isCancelled
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    : currentStatus === 'delivered'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}
              >
                {STATUS_ICONS[currentStatus]}
                {STATUS_LABELS[currentStatus]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          Status Timeline
        </h2>

        <div className="relative">
          {timelineSteps.map((step, idx) => {
            const isLast = idx === timelineSteps.length - 1 && !isCancelled;

            return (
              <div key={step.status} className="flex items-start gap-4 relative">
                {/* Vertical line */}
                {!isLast && (
                  <div
                    className={`absolute left-5 top-10 w-0.5 h-full -translate-x-1/2 ${
                      step.state === 'completed'
                        ? 'bg-green-400 dark:bg-green-500'
                        : step.state === 'current' && !isCancelled
                        ? 'bg-gradient-to-b from-green-400 to-gray-200 dark:from-green-500 dark:to-gray-600'
                        : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  />
                )}

                {/* Circle indicator */}
                <div className="flex-shrink-0 relative z-10">
                  {step.state === 'completed' ? (
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 border-2 border-green-500 dark:border-green-400 flex items-center justify-center text-green-600 dark:text-green-400">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  ) : step.state === 'current' ? (
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 border-2 border-green-500 dark:border-green-400 flex items-center justify-center text-green-600 dark:text-green-400 animate-pulse">
                      {STATUS_ICONS[step.status]}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 flex items-center justify-center text-gray-400 dark:text-gray-500">
                      {STATUS_ICONS[step.status]}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-8 ${isLast ? 'pb-0' : ''}`}>
                  <p
                    className={`font-semibold text-sm ${
                      step.state === 'future'
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {STATUS_LABELS[step.status]}
                  </p>
                  {step.historyEntry ? (
                    <div className="mt-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(step.historyEntry.created_at)}
                      </p>
                      {step.historyEntry.note && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-1.5 inline-block">
                          {step.historyEntry.note}
                        </p>
                      )}
                    </div>
                  ) : (
                    step.state === 'future' && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Pending
                      </p>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {/* Cancelled step */}
          {isCancelled && cancelledEntry && (
            <div className="flex items-start gap-4 relative">
              {/* Circle indicator */}
              <div className="flex-shrink-0 relative z-10">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 border-2 border-red-500 dark:border-red-400 flex items-center justify-center text-red-600 dark:text-red-400">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <p className="font-semibold text-sm text-red-700 dark:text-red-300">
                  {STATUS_LABELS.cancelled}
                </p>
                <div className="mt-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateTime(cancelledEntry.created_at)}
                  </p>
                  {cancelledEntry.note && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1.5 inline-block">
                      {cancelledEntry.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
