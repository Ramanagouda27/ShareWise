import { ApiError } from '../types/api';

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'NOT_AUTHORIZED'
  | 'RESOURCE_UNAVAILABLE'
  | 'BOOKING_CONFLICT'
  | 'INVALID_TIME_RANGE'
  | 'ELIGIBILITY_FAILED'
  | 'INVALID_STATUS_TRANSITION'
  | 'NETWORK_FAILURE'
  | 'MISSING_CONFIG'
  | 'UNKNOWN_ERROR';

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: 'You must be signed in to perform this action.',
  NOT_AUTHORIZED: 'You do not have permission to modify this booking or resource.',
  RESOURCE_UNAVAILABLE: 'This equipment is currently not available for new reservations.',
  BOOKING_CONFLICT: 'The selected reservation time window conflicts with an existing booking.',
  INVALID_TIME_RANGE: 'Invalid reservation time: End time must be later than start time (minimum 30 minutes).',
  ELIGIBILITY_FAILED: 'You do not meet the institutional eligibility requirements (e.g. required lab safety briefing).',
  INVALID_STATUS_TRANSITION: 'This booking status transition is not permitted in its current state.',
  NETWORK_FAILURE: 'Unable to reach the server. Please check your network connection and retry.',
  MISSING_CONFIG: 'Missing application configuration. Contact support or check environment variables.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again or contact the lab administrator.',
};

export class AppError extends Error {
  public code: ErrorCode;
  public details?: unknown;

  constructor(code: ErrorCode, customMessage?: string, details?: unknown) {
    super(customMessage || ERROR_MESSAGES[code] || 'Operation failed');
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  if (typeof error === 'string') {
    return error;
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR;
};
