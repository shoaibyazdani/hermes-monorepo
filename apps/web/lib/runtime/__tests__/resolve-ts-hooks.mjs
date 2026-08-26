/** Resolver hook: retry a failed relative import with a `.ts` extension. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    const bare = !/\.[a-z]+$/i.test(specifier);
    if (relative && bare) {
      return nextResolve(`${specifier}.ts`, context);
    }
    throw err;
  }
}
