import React from 'react';
import { CheckCircle2, Clock, Calendar, ArrowRight, ShieldAlert, PackageCheck } from 'lucide-react';
import { Booking } from '../../types/booking';

export interface BookingTimelineProps {
  booking: Booking;
}

export const BookingTimeline: React.FC<BookingTimelineProps> = ({ booking }) => {
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Pending';
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const steps = [
    {
      title: 'Reservation Requested',
      time: formatDate(booking.createdAt),
      description: `Requested by ${booking.requesterName}`,
      completed: true,
      current: booking.status === 'pending',
      icon: Clock,
    },
    {
      title: booking.status === 'rejected' ? 'Request Rejected' : 'Owner Review',
      time: booking.status === 'pending' ? 'Awaiting Review' : formatDate(booking.updatedAt),
      description:
        booking.status === 'rejected'
          ? `Reason: ${booking.rejectionReason || 'No reason specified'}`
          : booking.ownerNotes || 'Review by lab supervisor',
      completed: booking.status !== 'pending' && booking.status !== 'waitlisted',
      current: booking.status === 'approved',
      failed: booking.status === 'rejected',
      icon: booking.status === 'rejected' ? ShieldAlert : CheckCircle2,
    },
    {
      title: 'Equipment Checkout & Handover',
      time: formatDate(booking.checkedOutAt),
      description:
        booking.conditionReports?.find((r) => r.stage === 'checkout')
          ? `Initial inspection: ${booking.conditionReports.find((r) => r.stage === 'checkout')?.grade.toUpperCase()} condition`
          : 'Pending physical collection at lab',
      completed: booking.status === 'checked_out' || booking.status === 'returned',
      current: booking.status === 'checked_out',
      icon: PackageCheck,
    },
    {
      title: 'Return & Final Inspection',
      time: formatDate(booking.returnedAt),
      description:
        booking.conditionReports?.find((r) => r.stage === 'return')
          ? `Verified return: ${booking.conditionReports.find((r) => r.stage === 'return')?.grade.toUpperCase()} condition`
          : 'Due by scheduled booking completion',
      completed: booking.status === 'returned',
      current: false,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isLast = idx === steps.length - 1;

          return (
            <li key={step.title}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className={`absolute top-4 left-4 -ml-px h-full w-0.5 ${
                      step.completed ? 'bg-blue-600' : 'bg-neutral-200'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3 items-start">
                  <div>
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white ${
                        step.failed
                          ? 'bg-rose-50 text-rose-600 border border-rose-300'
                          : step.completed
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm font-semibold ${
                          step.failed
                            ? 'text-rose-600'
                            : step.completed
                            ? 'text-neutral-900'
                            : 'text-neutral-500'
                        }`}
                      >
                        {step.title}
                      </p>
                      <span className="text-xs text-neutral-400 font-medium">{step.time}</span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">{step.description}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
