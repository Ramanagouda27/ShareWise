import { CheckCircle2, ShieldCheck } from 'lucide-react';
import React, { useState } from 'react';
import { Booking } from '../../types/booking';
import { ConditionGrade } from '../../types/conditionReport';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

export interface ConditionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  stage: 'checkout' | 'return';
  onSubmit: (grade: ConditionGrade, notes: string) => Promise<void>;
  isLoading?: boolean;
}

export const ConditionReportModal: React.FC<ConditionReportModalProps> = ({
  isOpen,
  onClose,
  booking,
  stage,
  onSubmit,
  isLoading = false,
}) => {
  const [grade, setGrade] = useState<ConditionGrade>('excellent');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!booking) return null;

  const isCheckout = stage === 'checkout';

  const grades: Array<{ value: ConditionGrade; label: string; desc: string }> = [
    { value: 'excellent', label: 'Excellent', desc: 'Flawless condition, clean, fully functional, all accessories present' },
    { value: 'good', label: 'Good', desc: 'Minor cosmetic wear, normal usage marks, 100% operational' },
    { value: 'fair', label: 'Fair', desc: 'Moderate cosmetic signs, fully functional but noted imperfections' },
    { value: 'damaged', label: 'Damaged / Needs Service', desc: 'Physical damage or degraded operational performance' },
    { value: 'missing_parts', label: 'Missing Accessories', desc: 'Key probes, cables, power bricks, or accessories absent' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!notes.trim() && (grade === 'damaged' || grade === 'missing_parts')) {
      setError('Detailed notes are required when reporting damage or missing accessories.');
      return;
    }

    try {
      await onSubmit(grade, notes.trim() || `Inspection completed in ${grade} grade.`);
      onClose();
    } catch (err: unknown) {
  setError(
    err instanceof Error
      ? err.message
      : 'Failed to submit condition report'
  );
}
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCheckout ? 'Equipment Handover Inspection' : 'Return Verification Inspection'}
      description={`Record official physical condition log for "${booking.resource?.title || 'Equipment'}"`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Requester / Resource summary */}
        <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-neutral-500">Student Borrower:</span>
            <span className="font-semibold text-neutral-800">{booking.requesterName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Scheduled Return:</span>
            <span className="font-medium text-neutral-700">
              {new Date(booking.endTime).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        {/* Condition Grade Radio Buttons */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-2">
            Inspection Grade <span className="text-rose-500">*</span>
          </label>
          <div className="space-y-2">
            {grades.map((g) => (
              <label
                key={g.value}
                onClick={() => setGrade(g.value)}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  grade === g.value
                    ? 'bg-blue-50/60 border-blue-500 ring-1 ring-blue-500/20'
                    : 'bg-white border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <input
                  type="radio"
                  name="conditionGrade"
                  value={g.value}
                  checked={grade === g.value}
                  onChange={() => setGrade(g.value)}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="text-xs font-semibold text-neutral-900">{g.label}</div>
                  <div className="text-[11px] text-neutral-500">{g.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Inspection Notes */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
            Condition Inspection Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Verified 4x probes and power lead included, casing clean, zero display scratches..."
            className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 outline-none transition-all"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            isLoading={isLoading}
            leftIcon={isCheckout ? <ShieldCheck className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          >
            {isCheckout ? 'Confirm Handover & Checkout' : 'Verify & Complete Return'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
