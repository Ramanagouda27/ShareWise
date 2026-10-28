
import type {
  BookingError,
  BookingErrorCode,
  BookingRpcErrorCode,
  BookingRpcResponse,
  BookingResult,
} from './types'

const errorMessages: Record<BookingErrorCode, string> = {
  UNAUTHENTICATED: 'Please sign in to continue.',
  NOT_AUTHORISED: 'You are not allowed to perform this action.',
  RESOURCE_UNAVAILABLE: 'This equipment is currently unavailable.',
  INELIGIBLE: 'You are not eligible to book this equipment.',
  INVALID_TIME_RANGE: 'Please select a valid booking time range.',
  BOOKING_CONFLICT: 'This time slot conflicts with another booking.',
  INVALID_STATUS_TRANSITION:
    'This booking can no longer be updated in that way.',
  NETWORK_ERROR:
    'Unable to connect. Please check your connection and try again.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
}

const rpcErrorCodes = new Set<string>([
  'UNAUTHENTICATED',
  'NOT_AUTHORISED',
  'RESOURCE_UNAVAILABLE',
  'INELIGIBLE',
  'INVALID_TIME_RANGE',
  'BOOKING_CONFLICT',
  'INVALID_STATUS_TRANSITION',
])

function isBookingRpcErrorCode(
  code: unknown,
): code is BookingRpcErrorCode {
  return typeof code === 'string' && rpcErrorCodes.has(code)
}

export function normalizeBookingError(error: unknown): BookingError {
  let rawCode: unknown
  let rawMessage = ''

  if (error instanceof Error) {
    rawMessage = error.message
  } else if (typeof error === 'string') {
    rawMessage = error
  } else if (typeof error === 'object' && error !== null) {
    const value = error as Record<string, unknown>

    rawCode = value.code

    if (typeof value.message === 'string') {
      rawMessage = value.message
    }
  }

  const matchedCode = rawMessage.match(
    /\b(UNAUTHENTICATED|NOT_AUTHORISED|RESOURCE_UNAVAILABLE|INELIGIBLE|INVALID_TIME_RANGE|BOOKING_CONFLICT|INVALID_STATUS_TRANSITION)\b/,
  )?.[1]

  const code: BookingErrorCode = isBookingRpcErrorCode(rawCode)
    ? rawCode
    : isBookingRpcErrorCode(matchedCode)
      ? matchedCode
      : 'UNKNOWN_ERROR'

  return {
    code,
    message: errorMessages[code],
  }
}

export function normalizeBookingRpcResponse<T>(
  response: BookingRpcResponse<T>,
): BookingResult<T> {
  if (response.success === true) {
    return {
      success: true,
      data: response.data,
    }
  }

  return {
    success: false,
    error: {
      code: response.code,
      message: errorMessages[response.code],
    },
  }
}
