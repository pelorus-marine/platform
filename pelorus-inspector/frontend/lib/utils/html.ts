/**
 * Safely escape HTML to prevent XSS attacks.
 * Uses DOM-based escaping which is more reliable than regex.
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
