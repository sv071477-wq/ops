/**
 * Registers the jest-dom matcher augmentations (`toBeInTheDocument`,
 * `toHaveClass`, …) for the whole project.
 *
 * `tsconfig.json` restricts `types` to `["vitest/globals"]`, which disables
 * automatic `@types` inclusion, so the augmentation has to be pulled in
 * explicitly. The `/vitest` subpath is the entry that augments Vitest's
 * `Assertion` interface; the bare package entry augments Jest's instead.
 */
import "@testing-library/jest-dom/vitest";
