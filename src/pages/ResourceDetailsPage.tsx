import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Wrench
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookingForm } from '../components/bookings/BookingForm';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';
import { formatErrorMessage } from '../lib/errors';
import { bookingService } from '../services/bookingService';
import { resourceService } from '../services/resourceService';
import { BookingRequestInput } from '../types/booking';
import { Resource } from '../types/resource';

export const ResourceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  // Success modal state after booking request
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);

  const loadResource = useCallback(async () => {
  if (!id) return;

  setIsLoading(true);
  setError(null);

  try {
    const data = await resourceService.getResourceById(id);
    setResource(data);
  } catch (err) {
    setError(formatErrorMessage(err));
  } finally {
    setIsLoading(false);
  }
}, [id]);

useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadResource();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadResource]);

  const handleBookingSubmit = async (input: BookingRequestInput) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setIsSubmitting(true);
    try {
      const createdBooking = await bookingService.requestBooking(input, user);
      setSuccessBookingId(createdBooking.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Skeleton className="w-32 h-6 mb-6 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="w-full aspect-16/9 rounded-2xl" />
            <Skeleton className="w-3/4 h-8 rounded-lg" />
            <Skeleton className="w-full h-24 rounded-xl" />
          </div>
          <div>
            <Skeleton className="w-full h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <ErrorState
          title="Equipment not found"
          message={error || 'The requested equipment profile could not be loaded.'}
          onRetry={loadResource}
        />
        <div className="mt-6 text-center">
          <Link to="/resources">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Catalog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      {/* Back link */}
      <div className="mb-6">
        <Link
          to="/resources"
          className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Equipment Catalog</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Image, Details & Specs */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          {/* Main Photo Container */}
          <div className="relative aspect-16/10 w-full overflow-hidden rounded-3xl border border-neutral-200/90 bg-neutral-100 shadow-xs">
            {resource.imageUrl && !imageFailed ? (
              <img
                src={resource.imageUrl}
                alt={resource.title}
                onError={() => setImageFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 bg-neutral-50 gap-3">
                <Wrench className="w-12 h-12 stroke-[1.5]" />
                <span className="text-sm font-medium">Campus Lab Hardware</span>
              </div>
            )}

            <div className="absolute top-4 left-4">
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-xs text-neutral-900 shadow-xs border border-white">
                {resource.category}
              </span>
            </div>

            <div className="absolute top-4 right-4">
              {resource.availability.isAvailable ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500 text-white shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {resource.availability.availableQuantity > 1
                    ? `${resource.availability.availableQuantity} Available Now`
                    : 'Available Now'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-neutral-800 text-white shadow-xs">
                  <Clock className="w-3.5 h-3.5" />
                  Currently Reserved
                </span>
              )}
            </div>
          </div>

          {/* Title, Location & Description */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              {resource.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-neutral-400" />
                <span>{resource.location}</span>
              </div>
              {resource.serialNumber && (
                <div className="font-mono bg-neutral-100 px-2 py-0.5 rounded text-[11px] text-neutral-600">
                  SN: {resource.serialNumber}
                </div>
              )}
            </div>

            <div className="mt-6 prose prose-neutral max-w-none">
              <p className="text-sm sm:text-base text-neutral-600 leading-relaxed">
                {resource.description}
              </p>
            </div>
          </div>

          {/* Technical Specifications */}
          {resource.specifications && Object.keys(resource.specifications).length > 0 && (
            <div className="bg-neutral-50/70 rounded-2xl border border-neutral-200/80 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-700 mb-4">
                Technical Specifications
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                {Object.entries(resource.specifications).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1.5 border-b border-neutral-200/50">
                    <dt className="text-neutral-500 font-medium">{key.replace(/_/g, ' ')}</dt>
                    <dd className="text-neutral-900 font-semibold text-right">{val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Eligibility Requirements */}
          {resource.eligibilityRequirements && resource.eligibilityRequirements.length > 0 && (
            <div className="bg-blue-50/40 rounded-2xl border border-blue-100 p-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-neutral-900">
                  Eligibility & Safety Prerequisites
                </h2>
              </div>
              <ul className="space-y-2 text-xs text-neutral-700">
                {resource.eligibilityRequirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lab Owner & Supervisory Details */}
          {resource.owner && (
            <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 font-bold text-sm">
                  {resource.owner.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">{resource.owner.name}</h3>
                  <p className="text-xs text-neutral-500">{resource.owner.department}</p>
                  {resource.owner.labLocation && (
                    <p className="text-[11px] text-neutral-400">Office: {resource.owner.labLocation}</p>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
                Equipment Custodian
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Reservation Request Card */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-24 bg-white rounded-3xl border border-neutral-200/90 p-6 sm:p-7 shadow-xs">
            <div className="border-b border-neutral-100 pb-5 mb-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Equipment Booking
                </span>
                <span className="text-xs font-medium text-neutral-400">
                  {resource.availability.totalQuantity} Total Units
                </span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-neutral-900">
                Reserve This Hardware
              </h2>
            </div>

            <BookingForm
              resource={resource}
              onSubmit={handleBookingSubmit}
              isLoading={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Success Modal after Submission */}
      <Modal
        isOpen={Boolean(successBookingId)}
        onClose={() => navigate('/my-bookings')}
        title="Booking Request Submitted"
        description="Your equipment reservation has been recorded and submitted to the lab custodian for review."
      >
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Status: Pending Owner Review</span>
            </div>
            <p>
              Your reservation is awaiting owner sign-off. You will be notified once the lab manager confirms the time window.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => navigate('/my-bookings')}
            >
              Go to My Reservations
            </Button>
            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={() => {
                setSuccessBookingId(null);
                loadResource();
              }}
            >
              Browse More Equipment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
