/**
 * Lightweight assertion library for test runner.
 */

export class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new AssertionError(
      message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`,
      actual,
      expected
    );
  }
}

export function assertNotEqual(actual, expected, message) {
  if (actual === expected) {
    throw new AssertionError(
      message || `Expected value to NOT equal ${JSON.stringify(expected)}`,
      actual,
      expected
    );
  }
}

export function assertTrue(value, message) {
  if (value !== true) {
    throw new AssertionError(message || `Expected true, but got ${JSON.stringify(value)}`, value, true);
  }
}

export function assertFalse(value, message) {
  if (value !== false) {
    throw new AssertionError(message || `Expected false, but got ${JSON.stringify(value)}`, value, false);
  }
}

export function assertCloseTo(actual, expected, delta = 0.001, message) {
  const diff = Math.abs(actual - expected);
  if (diff > delta) {
    throw new AssertionError(
      message || `Expected ${actual} to be close to ${expected} (delta <= ${delta}), difference was ${diff}`,
      actual,
      expected
    );
  }
}

export function assertDeepEqual(actual, expected, message) {
  const actStr = JSON.stringify(actual);
  const expStr = JSON.stringify(expected);
  if (actStr !== expStr) {
    throw new AssertionError(
      message || `Deep equality mismatch.\nExpected: ${expStr}\nActual:   ${actStr}`,
      actual,
      expected
    );
  }
}

export function assertGreater(actual, min, message) {
  if (actual <= min) {
    throw new AssertionError(message || `Expected ${actual} > ${min}`, actual, min);
  }
}

export function assertGreaterOrEqual(actual, min, message) {
  if (actual < min) {
    throw new AssertionError(message || `Expected ${actual} >= ${min}`, actual, min);
  }
}

export function assertLess(actual, max, message) {
  if (actual >= max) {
    throw new AssertionError(message || `Expected ${actual} < ${max}`, actual, max);
  }
}

export function assertLessOrEqual(actual, max, message) {
  if (actual > max) {
    throw new AssertionError(message || `Expected ${actual} <= ${max}`, actual, max);
  }
}

export function assertInRange(actual, min, max, message) {
  if (actual < min || actual > max) {
    throw new AssertionError(message || `Expected ${actual} to be within [${min}, ${max}]`, actual, { min, max });
  }
}

export function assertThrows(fn, expectedRegexOrType, message) {
  let threw = false;
  let thrownError = null;
  try {
    fn();
  } catch (err) {
    threw = true;
    thrownError = err;
  }
  if (!threw) {
    throw new AssertionError(message || 'Expected function to throw an error, but it succeeded', null, 'Error');
  }
  if (expectedRegexOrType instanceof RegExp) {
    if (!expectedRegexOrType.test(thrownError.message)) {
      throw new AssertionError(
        message || `Error message "${thrownError.message}" did not match pattern ${expectedRegexOrType}`,
        thrownError.message,
        expectedRegexOrType
      );
    }
  }
}
