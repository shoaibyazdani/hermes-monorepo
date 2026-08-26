/**
 * Extensionless-import resolver for the Node test runner.
 *
 * The app is written for a bundler, so imports omit file extensions. Node's
 * ESM resolver requires them. This hook appends `.ts` when a bare relative
 * specifier does not resolve, letting tests import the real source files
 * rather than a duplicated copy — and without loosening tsconfig for the
 * whole project.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  new URL("./resolve-ts-hooks.mjs", import.meta.url),
  pathToFileURL("./"),
);
