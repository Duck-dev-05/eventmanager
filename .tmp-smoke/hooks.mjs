export async function resolve(specifier, context, next) {
  if (specifier === "next/headers" || specifier.startsWith("next/cache")) {
    const stub =
      "data:text/javascript,export function cookies(){throw new Error('stub')};export function headers(){throw new Error('stub')};export function draftMode(){throw new Error('stub')};export function revalidatePath(){};export function redirect(){throw new Error('stub')};";
    return { shortCircuit: true, url: stub };
  }
  return next(specifier, context);
}
