import { AlertCircle, Clock } from 'lucide-react';
import React, { useState } from 'react';
import { formatErrorMessage } from '../../lib/errors';
import { BookingRequestInput } from '../../types/booking';
import { Resource } from '../../types/resource';
import { Button } from '../ui/Button';
const INITIAL_DEFAULT_START = new Date(Date.now() + 60 * 60 * 1000);
const INITIAL_DEFAULT_END = new Date(Date.now() + 4 * 60 * 60 * 1000);

export interface BookingFormProps {
  resource: Resource;
  onSubmit: (input: BookingRequestInput) => Promise<void>;
  isLoading?: boolean;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  resource,
  onSubmit,
  isLoading = false,
}) => {
  // Helper to format Date to YYYY-MM-DDTHH:mm for datetime-local input
  const toLocalInputString = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

 const [startTime, setStartTime] = useState(
  toLocalInputString(INITIAL_DEFAULT_START)
);
const [endTime, setEndTime] = useState(
  toLocalInputString(INITIAL_DEFAULT_END)
);
  const [purposeNotes, setPurposeNotes] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Compute reservation duration
  const getDurationHours = () => {
    const s = new Date(startTime).getTime();
    const e = new Date(endTime).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return 0;
    return Math.round(((e - s) / 3600000) * 10) / 10;
  };

  const duration = getDurationHours();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const s = new Date(startTime);
    const eTime = new Date(endTime);

    if (isNaN(s.getTime()) || isNaN(eTime.getTime())) {
      setValidationError('Please select valid start and end dates.');
      return;
    }

    if (eTime <= s) {
      setValidationError('Reservation end time must be later than the start time.');
      return;
    }

    if (eTime.getTime() - s.getTime() < 30 * 60 * 1000) {
      setValidationError('Minimum reservation duration is 30 minutes.');
      return;
    }

    if (!purposeNotes.trim()) {
      setValidationError('Please briefly describe your academic or project purpose.');
      return;
    }

    if (!acceptedPolicy) {
      setValidationError('Please confirm compliance with campus lab safety and equipment care guidelines.');
      return;
    }

    try {
      await onSubmit({
        resourceId: resource.id,
        startTime: s.toISOString(),
        endTime: eTime.toISOString(),
        purposeNotes: purposeNotes.trim(),
      });
    } catch (err) {
      setValidationError(formatErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date-time inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
            Start Window <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setValidationError(null);
              }}
              required
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 outline-none transition-all cursor-pointer"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
            Return Deadline <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setValidationError(null);
              }}
              required
              className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 outline-none transition-all cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Duration Summary Helper */}
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>Scheduled Duration:</span>
        </div>
        <span className="font-semibold">{duration > 0 ? `${duration} hours` : 'Invalid Range'}</span>
      </div>

      {/* Purpose / Notes */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 mb-1.5">
          Project or Course Purpose <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows={3}
          value={purposeNotes}
          onChange={(e) => {
            setPurposeNotes(e.target.value);
            setValidationError(null);
          }}
          placeholder="e.g. Senior Capstone milestone testing, EE302 lab assignment, hackathon robotics demo..."
          required
          className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15 outline-none transition-all"
        />
      </div>

      {/* Student Responsibility Checkbox */}
      <div className="pt-1">
        <label className="flex items-start gap-2.5 text-xs text-neutral-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acceptedPolicy}
            onChange={(e) => setAcceptedPolicy(e.target.checked)}
            className="mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
          />
          <span>
            I agree to inspect the hardware upon collection, follow lab safety standards, and return it clean and undamaged before the scheduled deadline.
          </span>
        </label>
      </div>

      {/* Validation / Service Error Box */}
      {validationError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isLoading}
        disabled={!resource.availability.isAvailable || isLoading}
        className="w-full mt-2"
      >
        {resource.availability.isAvailable ? 'Submit Booking Request' : 'Equipment Currently Reserved'}
      </Button>

      <p className="text-[11px] text-center text-neutral-400">
        Requires approval by {resource.owner?.name || 'Lab Supervisor'}. Real-time notification sent upon submission.
      </p>
    </form>
  );
};
