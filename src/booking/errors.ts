
import type { BookingError, BookingErrorCode } from './types'

const errorMessages: Record<BookingErrorCode, string> = {
  UNAUTHENTICATED: 'Please sign in to continue.',
  NOT_AUTHORISED: 'You are not allowed to perform this action.',
  RESOURCE_UNAVAILABLE: 'This equipment is currently unavailable.',
  INELIGIBLE: 'You are not eligible to book this equipment.',
  INVALID_TIME_RANGE: 'Please select a valid booking time range.',
  BOOKING_CONFLICT: 'This time slot conflicts with another booking.',
  INVALID_STATUS_TRANSITION: 'This booking can no longer be updated in that way.',
  NETWORK_ERROR: 'Unable to connect. Please check your connection and try again.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
}

const knownCodes = new Set<BookingErrorCode>([
  'UNAUTHENTICATED',
  'NOT_AUTHORISED',
  'RESOURCE_UNAVAILABLE',
  'INELIGIBLE',
  'INVALID_TIME_RANGE',
  'BOOKING_CONFLICT',
  'INVALID_STATUS_TRANSITION',
  'NETWORK_ERROR',
  'UNKNOWN_ERROR',
])

export function normalizeBookingError(error: unknown): BookingError {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''

  const matchedCode = rawMessage.match(
    /\b(UNAUTHENTICATED|NOT_AUTHORISED|RESOURCE_UNAVAILABLE|INELIGIBLE|INVALID_TIME_RANGE|BOOKING_CONFLICT|INVALID_STATUS_TRANSITION|NETWORK_ERROR)\b/,
  )?.[1] as BookingErrorCode | undefined

  const code =
    matchedCode && knownCodes.has(matchedCode)
      ? matchedCode
      : 'UNKNOWN_ERROR'

  return {
    code,
    message: errorMessages[code],
  }
}
