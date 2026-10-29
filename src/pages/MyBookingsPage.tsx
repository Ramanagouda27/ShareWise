import {
  PlusCircle
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookingCard } from '../components/bookings/BookingCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { formatErrorMessage } from '../lib/errors';
import { bookingService } from '../services/bookingService';
import { Booking, BookingSummaryStats } from '../types/booking';

export const MyBookingsPage: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingSummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab filter: 'all' | 'active' | 'pending' | 'completed'
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'completed'>('all');

  // Cancel dialog state
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [list, userStats] = await Promise.all([
        bookingService.listMyBookings(user.id),
        bookingService.getBookingSummaryStats(user.id),
      ]);
      setBookings(list);
      setStats(userStats);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
  let cancelled = false;

  if (!user?.id) {
    return () => {
      cancelled = true;
    };
  }

  Promise.all([
    bookingService.listMyBookings(user.id),
    bookingService.getBookingSummaryStats(user.id),
  ])
    .then(([list, userStats]) => {
      if (cancelled) return;

      setBookings(list);
      setStats(userStats);
    })
    .catch((err: unknown) => {
      if (!cancelled) setError(formatErrorMessage(err));
    })
    .finally(() => {
      if (!cancelled) setIsLoading(false);
    });

  return () => {
    cancelled = true;
  };
}, [user?.id]);

  const handleCancelBooking = async () => {
    if (!cancelTargetId || !user) return;
    setIsCancelling(true);
    try {
      await bookingService.cancelBooking(cancelTargetId, user.id);
      setCancelTargetId(null);
      await loadData();
    } catch (err) {
      alert(formatErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  // Filter bookings based on selected tab
  const filteredBookings = useMemo(() => {
    if (activeTab === 'all') return bookings;
    if (activeTab === 'pending') return bookings.filter((b) => b.status === 'pending');
    if (activeTab === 'active')
      return bookings.filter((b) => b.status === 'approved' || b.status === 'checked_out');
    if (activeTab === 'completed')
      return bookings.filter(
        (b) => b.status === 'returned' || b.status === 'cancelled' || b.status === 'rejected'
      );
    return bookings;
  }, [bookings, activeTab]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <PageHeader
        title="My Equipment Reservations"
        description="Track the status of your college hardware requests, scheduled pickup times, active checkouts, and return records."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'My Bookings' }]}
        actions={
          <Link to="/resources">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
              Reserve Equipment
            </Button>
          </Link>
        }
      />

      {/* Real Summary Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-neutral-200/90 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              Total Requests
            </span>
            <div className="mt-1 text-2xl font-bold text-neutral-900">{stats.total}</div>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200/80 bg-amber-50/20 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Pending Review
            </span>
            <div className="mt-1 text-2xl font-bold text-amber-800">{stats.pending}</div>
          </div>

          <div className="bg-white rounded-2xl border border-blue-200/80 bg-blue-50/20 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Active / In-Hand
            </span>
            <div className="mt-1 text-2xl font-bold text-blue-800">
              {stats.approved + stats.checkedOut}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-4 shadow-2xs">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Returned & Audited
            </span>
            <div className="mt-1 text-2xl font-bold text-emerald-800">{stats.returned}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-neutral-200/80 mb-6">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            All Bookings ({bookings.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Approved & In Hand ({stats ? stats.approved + stats.checkedOut : 0})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Pending Review ({stats?.pending || 0})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'completed'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            History & Past ({stats ? stats.returned + stats.cancelled + stats.rejected : 0})
          </button>
        </nav>
      </div>

      {/* Content State */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load bookings"
          message={error}
          onRetry={loadData}
        />
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'all'
              ? 'No equipment reservations yet'
              : `No ${activeTab} reservations found`
          }
          description="Browse campus inventory to discover oscilloscopes, development boards, and prototyping kits available for booking."
          actionLabel="Browse Available Equipment"
          onAction={() => (window.location.href = '/resources')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              onCancel={(id) => setCancelTargetId(id)}
            />
          ))}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={Boolean(cancelTargetId)}
        onClose={() => setCancelTargetId(null)}
        title="Cancel Equipment Reservation"
        description="Are you sure you want to cancel this booking? This action will release the reserved time slot for other students."
        maxWidth="sm"
      >
        <div className="pt-2 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCancelTargetId(null)}
            disabled={isCancelling}
          >
            Keep Reservation
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={isCancelling}
            onClick={handleCancelBooking}
          >
            Confirm Cancellation
          </Button>
        </div>
      </Modal>
    </div>
  );
};
