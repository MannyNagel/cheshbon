export function isAccessHandleBusyError(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return (
    message.includes('NoModificationAllowedError') ||
    message.includes('createSyncAccessHandle') ||
    message.includes('Access Handles cannot be created')
  );
}

export function scheduleAccessHandleBusyReload(error: unknown, key = 'cheshbon_access_handle_retry') {
  if (!isAccessHandleBusyError(error) || typeof window === 'undefined') return false;
  if (window.sessionStorage.getItem(key) === '1') return false;
  window.sessionStorage.setItem(key, '1');
  window.setTimeout(() => {
    window.location.reload();
  }, 100);
  return true;
}

export function clearAccessHandleBusyRecovery(key = 'cheshbon_access_handle_retry') {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(key);
}
