import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// Vitest 2.x declares `Assertion` in the `@vitest/expect` module rather than the
// `vitest` module. This augmentation ensures `@testing-library/jest-dom` custom
// matchers (e.g. `toBeInTheDocument`, `toHaveClass`) are type-visible in tests.
declare module '@vitest/expect' {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchersContaining
    extends TestingLibraryMatchers<unknown, unknown> {}
}
