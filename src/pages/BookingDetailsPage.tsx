import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  ArrowLeft,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { bookingService } from '../services/bookingService';
import { Booking } from '../types/booking';
import { BookingStatusBadge } from '../components/bookings/BookingStatusBadge';
import { BookingTimeline } from '../components/bookings/BookingTimeline';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../hooks/useAuth';
import { formatErrorMessage } from '../lib/errors';

export const BookingDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const loadBooking = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await bookingService.getBookingById(id);
      setBooking(data);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [id]);

  const handleCancel = async () => {
    if (!booking || !user) return;
    setIsCancelling(true);
    try {
      await bookingService.cancelBooking(booking.id, user.id);
      setShowCancelModal(false);
      await loadBooking();
    } catch (err) {
      alert(formatErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Skeleton className="w-32 h-6 mb-6" />
        <Skeleton className="w-full h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <ErrorState
          title="Reservation record not found"
          message={error || 'The requested booking details could not be found.'}
          onRetry={loadBooking}
        />
        <div className="mt-6 text-center">
          <Link to="/my-bookings">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to My Bookings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const canCancel =
    (booking.status === 'pending' || booking.status === 'approved' || booking.status === 'waitlisted') &&
    user?.id === booking.requesterId;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Main Reservation Header */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-neutral-100">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-neutral-400 uppercase">
                #{booking.id.slice(-8)}
              </span>
              <BookingStatusBadge status={booking.status} size="md" />
            </div>
            <h1 className="mt-2 text-2xl font-bold text-neutral-900">
              {booking.resource?.title || 'Equipment Reservation'}
            </h1>
          </div>

          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 self-start sm:self-auto"
            >
              Cancel Reservation
            </Button>
          )}
        </div>

        {/* Schedule Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6 border-b border-neutral-100">
          <div className="p-4 rounded-2xl bg-neutral-50/70 border border-neutral-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Checkout Window</span>
            </div>
            <div className="text-sm font-semibold text-neutral-900">
              {formatDateTime(booking.startTime)}
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              Location: {booking.resource?.location || 'Designated Campus Lab'}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50/70 border border-neutral-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Return Deadline</span>
            </div>
            <div className="text-sm font-semibold text-neutral-900">
              {formatDateTime(booking.endTime)}
            </div>
            <div className="text-xs text-neutral-400 mt-1">
              Must be returned clean and undamaged
            </div>
          </div>
        </div>

        {/* Purpose Notes */}
        {booking.purposeNotes && (
          <div className="py-4 border-b border-neutral-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
              Academic Purpose / Project Notes
            </h3>
            <p className="text-sm text-neutral-700 bg-neutral-50 p-3.5 rounded-xl border border-neutral-100 italic">
              "{booking.purposeNotes}"
            </p>
          </div>
        )}

        {/* Rejection Notification if any */}
        {booking.status === 'rejected' && (
          <div className="my-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Request Declined by Lab Custodian</span>
            </div>
            <p>{booking.rejectionReason || 'No specific rejection reason provided.'}</p>
          </div>
        )}

        {/* Quick Link to Equipment profile */}
        {booking.resourceId && (
          <div className="pt-4 flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              Supervisor:{' '}
              <span className="font-semibold text-neutral-800">
                {booking.resource?.owner?.name || 'Lab Supervisor'}
              </span>
            </div>
            <Link
              to={`/resources/${booking.resourceId}`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              View Equipment Specs →
            </Link>
          </div>
        )}
      </div>

      {/* Lifecycle Timeline */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-8 shadow-xs mb-8">
        <h2 className="text-base font-bold text-neutral-900 mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Reservation Lifecycle & Audit Trail</span>
        </h2>
        <BookingTimeline booking={booking} />
      </div>

      {/* Condition Reports Inspection Records */}
      {booking.conditionReports && booking.conditionReports.length > 0 && (
        <div className="bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-8 shadow-xs">
          <h2 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Digital Condition Inspection Logs</span>
          </h2>
          <div className="space-y-3">
            {booking.conditionReports.map((report) => (
              <div
                key={report.id}
                className="p-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/60 text-xs"
              >
                <div className="flex items-center justify-between font-semibold text-neutral-900 mb-1">
                  <span className="capitalize">{report.stage} Inspection Log</span>
                  <span className="px-2 py-0.5 rounded-md bg-white border text-[11px] font-bold uppercase text-blue-700">
                    Grade: {report.grade}
                  </span>
                </div>
                <p className="text-neutral-600 mt-1">{report.notes}</p>
                <div className="mt-2 text-[11px] text-neutral-400">
                  Audited by {report.inspectorName} on{' '}
                  {new Date(report.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Reservation"
        description="Are you sure you want to cancel this booking? This will immediately free up the equipment."
        maxWidth="sm"
      >
        <div className="pt-2 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCancelModal(false)}
            disabled={isCancelling}
          >
            Go Back
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={isCancelling}
            onClick={handleCancel}
          >
            Confirm Cancellation
          </Button>
        </div>
      </Modal>
    </div>
  );
};
