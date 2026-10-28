
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBookingError } from './errors.ts'

test('normalizes a booking conflict error', () => {
  const result = normalizeBookingError(
    new Error('BOOKING_CONFLICT: slot already reserved'),
  )

  assert.equal(result.code, 'BOOKING_CONFLICT')
  assert.equal(
    result.message,
    'This time slot conflicts with another booking.',
  )
})

test('normalizes an authentication error', () => {
  const result = normalizeBookingError(
    new Error('UNAUTHENTICATED'),
  )

  assert.equal(result.code, 'UNAUTHENTICATED')
  assert.equal(result.message, 'Please sign in to continue.')
})

test('normalizes a direct booking error code from an object', () => {
  const result = normalizeBookingError({
    code: 'NOT_AUTHORISED',
    message: 'Permission denied',
  })

  assert.equal(result.code, 'NOT_AUTHORISED')
  assert.equal(
    result.message,
    'You are not allowed to perform this action.',
  )
})

test('normalizes a booking code embedded in a plain object message', () => {
  const result = normalizeBookingError({
    message: 'INVALID_STATUS_TRANSITION: cannot approve',
  })

  assert.equal(result.code, 'INVALID_STATUS_TRANSITION')
  assert.equal(
    result.message,
    'This booking can no longer be updated in that way.',
  )
})

test('normalizes an ineligible booking error', () => {
  const result = normalizeBookingError({
    code: 'INELIGIBLE',
    message: 'Eligibility check failed',
  })

  assert.equal(result.code, 'INELIGIBLE')
  assert.equal(
    result.message,
    'You are not eligible to book this equipment.',
  )
})

test('does not expose internal details in unknown errors', () => {
  const internalMessage =
    'internal database details: connection credentials unavailable'

  const result = normalizeBookingError(new Error(internalMessage))

  assert.equal(result.code, 'UNKNOWN_ERROR')
  assert.equal(
    result.message,
    'Something went wrong. Please try again.',
  )
  assert.equal(result.message.includes(internalMessage), false)
})

test('handles non-Error values safely', () => {
  const result = normalizeBookingError(null)

  assert.equal(result.code, 'UNKNOWN_ERROR')
  assert.equal(
    result.message,
    'Something went wrong. Please try again.',
  )
})

test('handles an unknown object safely', () => {
  const result = normalizeBookingError({
    detail: 'internal database information',
  })

  assert.equal(result.code, 'UNKNOWN_ERROR')
  assert.equal(
    result.message,
    'Something went wrong. Please try again.',
  )
})

test('handles a plain string error safely', () => {
  const result = normalizeBookingError(
    'unexpected internal database failure',
  )

  assert.equal(result.code, 'UNKNOWN_ERROR')
  assert.equal(
    result.message,
    'Something went wrong. Please try again.',
  )
})
