/**
 * API Loading Tracking System
 * Separate file to avoid circular dependencies and webpack issues
 */

let activeRequests = 0;
let loadingCallbacks: {
  onStart?: () => void;
  onEnd?: () => void;
} = {};

export function setLoadingCallbacks(callbacks: {
  onStart?: () => void;
  onEnd?: () => void;
}) {
  loadingCallbacks = callbacks;
}

export function getLoadingCallbacks() {
  return loadingCallbacks;
}

export function startApiLoading() {
  activeRequests++;
  if (loadingCallbacks.onStart) {
    loadingCallbacks.onStart();
  }
}

export function endApiLoading() {
  const hadActiveRequest = activeRequests > 0;
  activeRequests = Math.max(0, activeRequests - 1);

  if (hadActiveRequest && loadingCallbacks.onEnd) {
    loadingCallbacks.onEnd();
  }
}

export function getActiveRequestCount() {
  return activeRequests;
}

export function resetLoadingTracking() {
  activeRequests = 0;
  loadingCallbacks = {};
}
