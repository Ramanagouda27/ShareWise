import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, ArrowRight, XCircle } from 'lucide-react';
import { Booking } from '../../types/booking';
import { BookingStatusBadge } from './BookingStatusBadge';
import { Button } from '../ui/Button';

export interface BookingCardProps {
  booking: Booking;
  isOwnerView?: boolean;
  onCancel?: (bookingId: string) => void;
  onReview?: (booking: Booking) => void;
  onCheckout?: (booking: Booking) => void;
  onReturn?: (booking: Booking) => void;
}

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  isOwnerView = false,
  onCancel,
  onReview,
  onCheckout,
  onReturn,
}) => {
  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const canCancel =
    !isOwnerView &&
    (booking.status === 'pending' || booking.status === 'approved' || booking.status === 'waitlisted');

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 hover:border-neutral-300 p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
      <div>
        {/* Top Header: Category/Location & Status Badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md">
              {booking.resource?.category || 'Hardware'}
            </span>
            {booking.resource?.location && (
              <span className="text-xs text-neutral-400 flex items-center gap-1 truncate max-w-[180px]">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{booking.resource.location}</span>
              </span>
            )}
          </div>
          <BookingStatusBadge status={booking.status} size="sm" />
        </div>

        {/* Title & Requester */}
        <Link
          to={`/bookings/${booking.id}`}
          className="text-base font-semibold text-neutral-900 hover:text-blue-600 transition-colors line-clamp-1 block"
        >
          {booking.resource?.title || `Equipment Reservation #${booking.id.slice(-6)}`}
        </Link>

        {isOwnerView && (
          <div className="mt-1 text-xs text-neutral-500">
            Requester:{' '}
            <span className="font-medium text-neutral-800">{booking.requesterName}</span>
            {booking.requesterDepartment && ` (${booking.requesterDepartment})`}
          </div>
        )}

        {/* Booking Schedule Window */}
        <div className="mt-4 p-3 bg-neutral-50/70 rounded-xl border border-neutral-100/90 text-xs text-neutral-600 space-y-1.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="font-medium text-neutral-700">From:</span>
            <span>{formatDateTime(booking.startTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="font-medium text-neutral-700">Until:</span>
            <span>{formatDateTime(booking.endTime)}</span>
          </div>
        </div>

        {/* Purpose / Rejection Note */}
        {booking.purposeNotes && (
          <p className="mt-3 text-xs text-neutral-500 line-clamp-2 italic">
            "{booking.purposeNotes}"
          </p>
        )}

        {booking.status === 'rejected' && booking.rejectionReason && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-700">
            <span className="font-semibold">Declined:</span> {booking.rejectionReason}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-5 pt-3.5 border-t border-neutral-100 flex items-center justify-between gap-2">
        <Link
          to={`/bookings/${booking.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 hover:text-blue-600 transition-colors"
        >
          <span>View Details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        <div className="flex items-center gap-2">
          {canCancel && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(booking.id)}
              className="text-xs text-neutral-500 hover:text-rose-600 hover:bg-rose-50"
            >
              Cancel
            </Button>
          )}

          {isOwnerView && booking.status === 'pending' && onReview && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onReview(booking)}
              className="text-xs"
            >
              Review Request
            </Button>
          )}

          {isOwnerView && booking.status === 'approved' && onCheckout && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onCheckout(booking)}
              className="text-xs bg-blue-600 hover:bg-blue-700"
            >
              Handover Equipment
            </Button>
          )}

          {isOwnerView && booking.status === 'checked_out' && onReturn && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReturn(booking)}
              className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              Process Return
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
