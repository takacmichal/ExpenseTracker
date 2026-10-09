/**
 * True when a single-key shortcut should be ignored: the user is typing, holding a modifier,
 * or a dialog/overlay currently owns the keyboard.
 */
export function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
    return true;
  }

  const target = event.target;
  if (target instanceof HTMLElement) {
    if (target.isContentEditable || target.closest('input, textarea, select, [role="combobox"]')) {
      return true;
    }
  }

  return document.querySelector('.p-dialog-mask, .p-drawer-mask, .p-overlay-mask') !== null;
}
