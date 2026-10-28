
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

test('uses a safe message for unknown errors', () => {
  const result = normalizeBookingError(
    new Error('internal database details'),
  )

  assert.equal(result.code, 'UNKNOWN_ERROR')
  assert.equal(
    result.message,
    'Something went wrong. Please try again.',
  )
})

test('handles non-Error values safely', () => {
  const result = normalizeBookingError(null)

  assert.equal(result.code, 'UNKNOWN_ERROR')
})
