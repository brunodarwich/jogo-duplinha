/**
 * Lightweight test definition framework.
 */

class TestRegistry {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
  }

  describe(name, fn) {
    const parentSuite = this.currentSuite;
    const suite = {
      name,
      parent: parentSuite,
      tests: [],
      beforeEach: [],
      afterEach: [],
      beforeAll: [],
      afterAll: [],
      children: []
    };

    if (parentSuite) {
      parentSuite.children.push(suite);
    } else {
      this.suites.push(suite);
    }

    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = parentSuite;
    }
  }

  test(name, fn) {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {
        this.test(name, fn);
      });
      return;
    }
    this.currentSuite.tests.push({ name, fn });
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEach.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEach.push(fn);
  }

  beforeAll(fn) {
    if (this.currentSuite) this.currentSuite.beforeAll.push(fn);
  }

  afterAll(fn) {
    if (this.currentSuite) this.currentSuite.afterAll.push(fn);
  }

  clear() {
    this.suites = [];
    this.currentSuite = null;
  }
}

export const registry = new TestRegistry();

export const describe = (name, fn) => registry.describe(name, fn);
export const test = (name, fn) => registry.test(name, fn);
export const it = test;
export const beforeEach = (fn) => registry.beforeEach(fn);
export const afterEach = (fn) => registry.afterEach(fn);
export const beforeAll = (fn) => registry.beforeAll(fn);
export const afterAll = (fn) => registry.afterAll(fn);
