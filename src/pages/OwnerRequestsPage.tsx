import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Filter,
  PackageCheck,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { bookingService } from '../services/bookingService';
import { Booking, BookingReviewInput } from '../types/booking';
import { ConditionGrade } from '../types/conditionReport';
import { useAuth } from '../hooks/useAuth';
import { PageHeader } from '../components/ui/PageHeader';
import { BookingCard } from '../components/bookings/BookingCard';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { ConditionReportModal } from '../components/bookings/ConditionReportModal';
import { formatErrorMessage } from '../lib/errors';

export const OwnerRequestsPage: React.FC = () => {
  const { user, isOwner, switchDemoRole } = useAuth();
  const [requests, setRequests] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab filter: 'pending' | 'approved' | 'checked_out' | 'all'
  const [filterTab, setFilterTab] = useState<'pending' | 'approved' | 'checked_out' | 'all'>('pending');

  // Review modal (Approve / Reject)
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Handover / Return Condition modal
  const [conditionModalBooking, setConditionModalBooking] = useState<Booking | null>(null);
  const [conditionStage, setConditionStage] = useState<'checkout' | 'return'>('checkout');
  const [isSubmittingCondition, setIsSubmittingCondition] = useState(false);

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await bookingService.listOwnerRequests(user?.id);
      setRequests(data);
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (filterTab === 'all') return requests;
    return requests.filter((r) => r.status === filterTab);
  }, [requests, filterTab]);

  // Handle Review (Approve / Reject)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBooking || !user) return;
    setIsSubmittingReview(true);
    try {
      await bookingService.reviewBooking(
        {
          bookingId: reviewBooking.id,
          decision: reviewDecision,
          rejectionReason: reviewDecision === 'reject' ? rejectionReason : undefined,
        },
        user
      );
      setReviewBooking(null);
      setRejectionReason('');
      await loadRequests();
    } catch (err) {
      alert(formatErrorMessage(err));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Handle Handover / Return Condition Submission
  const handleConditionSubmit = async (grade: ConditionGrade, notes: string) => {
    if (!conditionModalBooking || !user) return;
    setIsSubmittingCondition(true);
    try {
      if (conditionStage === 'checkout') {
        await bookingService.checkOutBooking(
          {
            bookingId: conditionModalBooking.id,
            grade,
            notes,
          },
          user
        );
      } else {
        await bookingService.returnBooking(
          {
            bookingId: conditionModalBooking.id,
            grade,
            notes,
          },
          user
        );
      }
      setConditionModalBooking(null);
      await loadRequests();
    } catch (err) {
      alert(formatErrorMessage(err));
    } finally {
      setIsSubmittingCondition(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <PageHeader
        title="Equipment Custodian Dashboard"
        description="Review incoming reservation requests, perform initial condition audits at checkout, and verify returns."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Owner Requests' }]}
        actions={
          !isOwner ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => switchDemoRole('owner')}
              className="text-blue-600 border-blue-200"
            >
              Switch to Owner Persona
            </Button>
          ) : undefined
        }
      />

      {/* Role Notice Banner for Hackathon Demo */}
      {!isOwner && (
        <div className="mb-8 p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              You are currently viewing in Student mode. Switch to <strong>Lab Owner Persona</strong> to test approvals and return condition logging.
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => switchDemoRole('owner')}
            className="shrink-0"
          >
            Switch to Lab Manager
          </Button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-neutral-200/90 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Total Inquiries
          </span>
          <div className="mt-1 text-2xl font-bold text-neutral-900">{requests.length}</div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 bg-amber-50/20 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            Awaiting Review
          </span>
          <div className="mt-1 text-2xl font-bold text-amber-800">
            {requests.filter((r) => r.status === 'pending').length}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-blue-200/80 bg-blue-50/20 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
            In Circulation
          </span>
          <div className="mt-1 text-2xl font-bold text-blue-800">
            {requests.filter((r) => r.status === 'checked_out').length}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-4 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Completed / Verified
          </span>
          <div className="mt-1 text-2xl font-bold text-emerald-800">
            {requests.filter((r) => r.status === 'returned').length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-neutral-200/80 mb-6">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setFilterTab('pending')}
            className={`pb-3 border-b-2 transition-colors ${
              filterTab === 'pending'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Pending Requests ({requests.filter((r) => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterTab('approved')}
            className={`pb-3 border-b-2 transition-colors ${
              filterTab === 'approved'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Awaiting Pickup ({requests.filter((r) => r.status === 'approved').length})
          </button>
          <button
            onClick={() => setFilterTab('checked_out')}
            className={`pb-3 border-b-2 transition-colors ${
              filterTab === 'checked_out'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Active Checkouts ({requests.filter((r) => r.status === 'checked_out').length})
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`pb-3 border-b-2 transition-colors ${
              filterTab === 'all'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            All Logs ({requests.length})
          </button>
        </nav>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load requests"
          message={error}
          onRetry={loadRequests}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No requests in this view"
          description="Incoming student requests for your assigned lab equipment will appear here for review."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((r) => (
            <BookingCard
              key={r.id}
              booking={r}
              isOwnerView={true}
              onReview={(b) => {
                setReviewBooking(b);
                setReviewDecision('approve');
              }}
              onCheckout={(b) => {
                setConditionModalBooking(b);
                setConditionStage('checkout');
              }}
              onReturn={(b) => {
                setConditionModalBooking(b);
                setConditionStage('return');
              }}
            />
          ))}
        </div>
      )}

      {/* Review Dialog Modal (Approve / Reject) */}
      <Modal
        isOpen={Boolean(reviewBooking)}
        onClose={() => setReviewBooking(null)}
        title="Review Equipment Booking Request"
        description={`Request by ${reviewBooking?.requesterName} for "${reviewBooking?.resource?.title || 'Equipment'}"`}
        maxWidth="md"
      >
        {reviewBooking && (
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-500">Student ID / Dept:</span>
                <span className="font-semibold text-neutral-800">
                  {reviewBooking.requesterStudentId} • {reviewBooking.requesterDepartment}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Requested Time:</span>
                <span className="font-medium text-neutral-700">
                  {new Date(reviewBooking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {new Date(reviewBooking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {reviewBooking.purposeNotes && (
                <div className="pt-1 text-neutral-600 italic">
                  "{reviewBooking.purposeNotes}"
                </div>
              )}
            </div>

            {/* Decision selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-2">
                Custodian Decision
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReviewDecision('approve')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                    reviewDecision === 'approve'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-500/20'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Approve Request</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewDecision('reject')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                    reviewDecision === 'reject'
                      ? 'bg-rose-50 text-rose-800 border-rose-400 ring-2 ring-rose-500/20'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>Reject Request</span>
                </button>
              </div>
            </div>

            {/* If rejecting, prompt for reason */}
            {reviewDecision === 'reject' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
                  Reason for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Lab is scheduled for recalibration; required safety briefing incomplete..."
                  required={reviewDecision === 'reject'}
                  className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 outline-none"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setReviewBooking(null)}
                disabled={isSubmittingReview}
              >
                Cancel
              </Button>
              <Button
                variant={reviewDecision === 'approve' ? 'primary' : 'danger'}
                size="sm"
                type="submit"
                isLoading={isSubmittingReview}
              >
                {reviewDecision === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Handover / Return Condition Modal */}
      <ConditionReportModal
        isOpen={Boolean(conditionModalBooking)}
        onClose={() => setConditionModalBooking(null)}
        booking={conditionModalBooking}
        stage={conditionStage}
        onSubmit={handleConditionSubmit}
        isLoading={isSubmittingCondition}
      />
    </div>
  );
};
