/**
 * Replace {{key}} patterns in a template string with values from a data object.
 *
 * Unmatched placeholders are left in place so downstream processes
 * (e.g. unsubscribe link injection) can still resolve them.
 */
export function mergeFields(
  template: string,
  data: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(data, key)
      ? data[key]
      : match
  })
}
