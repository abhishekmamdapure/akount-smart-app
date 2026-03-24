const AUTH_TELEMETRY_ENDPOINT = import.meta.env.VITE_AUTH_TELEMETRY_ENDPOINT

function sendToEndpoint(payload) {
  if (!AUTH_TELEMETRY_ENDPOINT) {
    return
  }

  const body = JSON.stringify(payload)
  const blob = new Blob([body], { type: 'application/json' })

  if (navigator.sendBeacon) {
    navigator.sendBeacon(AUTH_TELEMETRY_ENDPOINT, blob)
    return
  }

  fetch(AUTH_TELEMETRY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Avoid interrupting auth flow on telemetry errors.
  })
}

export function trackAuthEvent(eventName, payload = {}) {
  const eventPayload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(eventPayload)
  }

  window.dispatchEvent(new CustomEvent('akountsmart:auth-event', { detail: eventPayload }))
  sendToEndpoint(eventPayload)
}
