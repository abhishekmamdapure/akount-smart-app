import { useEffect, useMemo, useState } from 'react'

export function buildWorkspaceUserHeaders(currentUser, includeJsonContentType = false) {
  const headers = {
    'x-user-id': currentUser?.id ?? '',
    'x-user-email': currentUser?.email ?? '',
  }

  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json'
  }

  return headers
}

export function useToolClients({ authReady, currentUser, refreshKey = 0 }) {
  const [clients, setClients] = useState([])
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function loadClients() {
    if (!authReady) {
      return
    }

    if (!currentUser?.id || !currentUser?.email) {
      setClients([])
      setStatus('error')
      setErrorMessage('No signed-in user was found. Please sign in again.')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/clients', {
        headers: buildWorkspaceUserHeaders(currentUser),
      })
      const data = await response.json()

      if (!response.ok) {
        setClients([])
        setStatus('error')
        setErrorMessage(data.error || 'Unable to load clients.')
        return
      }

      setClients(Array.isArray(data.clients) ? data.clients : [])
      setStatus('ready')
    } catch (error) {
      setClients([])
      setStatus('error')
      setErrorMessage('Unable to load clients. Please check the API connection.')
    }
  }

  useEffect(() => {
    loadClients()
  }, [authReady, currentUser?.email, currentUser?.id, refreshKey])

  const clientLookup = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client])),
    [clients],
  )

  return {
    clientLookup,
    clients,
    errorMessage,
    reloadClients: loadClients,
    status,
  }
}

function formatSearchableText(client) {
  return String(client?.name || '').toLowerCase()
}

export function useWorkspaceToolClient(outletContext = {}) {
  const authReady = outletContext.authReady ?? false
  const currentUser = outletContext.currentUser ?? null
  const refreshKey = outletContext.clientRefreshKey ?? 0
  const activeToolClientId = outletContext.activeToolClientId ?? ''
  const setActiveToolClientId = outletContext.setActiveToolClientId ?? (() => {})

  const { clientLookup, clients, errorMessage, reloadClients, status } = useToolClients({
    authReady,
    currentUser,
    refreshKey,
  })

  const [query, setQuery] = useState('')

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return clients
    }

    return clients.filter((client) => formatSearchableText(client).includes(normalizedQuery))
  }, [clients, query])

  const selectedClient = activeToolClientId ? clientLookup.get(String(activeToolClientId)) || null : null

  useEffect(() => {
    if (!activeToolClientId || status !== 'ready') {
      return
    }

    if (!clientLookup.has(String(activeToolClientId))) {
      setActiveToolClientId('')
    }
  }, [activeToolClientId, clientLookup, setActiveToolClientId, status])

  function handleSelectClient(clientId) {
    setActiveToolClientId(String(clientId))
    setQuery('')
  }

  return {
    clients,
    errorMessage,
    filteredClients,
    handleSelectClient,
    query,
    reloadClients,
    selectedClient,
    setQuery,
    status,
  }
}
