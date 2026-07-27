/**
 * Two-step delete confirmation (browser dialogs).
 * Returns true only if the user accepts both prompts.
 */
export function confirmDelete(message) {
  const first =
    message ||
    'Bu qeyd silinsin?\n\nSilmək istədiyinizə əminsiniz?'
  if (!window.confirm(first)) return false
  if (
    !window.confirm(
      'Son təsdiq: əməliyyat geri qaytarıla bilməz.\n\nHəqiqətən silinsin?'
    )
  ) {
    return false
  }
  return true
}
