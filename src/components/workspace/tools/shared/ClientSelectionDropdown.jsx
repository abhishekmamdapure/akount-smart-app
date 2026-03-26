import { useEffect, useId, useRef, useState } from 'react'
import WorkspaceIcon from '../../WorkspaceIcon'
import styles from './Tools.module.css'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

const MENU_TRANSITION_MS = 180

function getInitialHighlightIndex(filteredClients, selectedClient) {
  if (filteredClients.length === 0) {
    return -1
  }

  const selectedIndex = filteredClients.findIndex((client) => selectedClient?.id === client.id)
  return selectedIndex >= 0 ? selectedIndex : 0
}

export default function ClientSelectionDropdown({
  compact = false,
  clients,
  errorMessage,
  filteredClients,
  menuAlign = 'start',
  onCreateClient,
  onQueryChange,
  onRetry,
  onSelectClient,
  query,
  selectedClient,
  status,
}) {
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const searchInputRef = useRef(null)
  const optionRefs = useRef([])
  const closeTimeoutRef = useRef(null)
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const isReady = status === 'ready'
  const triggerLabel = selectedClient ? selectedClient.name : 'Choose client'
  const showCreateAction = typeof onCreateClient === 'function'
  const hasResults = filteredClients.length > 0

  function clearCloseTimeout() {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  function openMenu() {
    if (!isReady) {
      return
    }

    clearCloseTimeout()
    setMenuVisible(true)
    setOpen(true)
  }

  function closeMenu({ returnFocus = false } = {}) {
    clearCloseTimeout()
    setOpen(false)

    if (menuVisible) {
      closeTimeoutRef.current = window.setTimeout(() => {
        setMenuVisible(false)
        closeTimeoutRef.current = null
      }, MENU_TRANSITION_MS)
    }

    if (returnFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus()
      })
    }
  }

  function handleSelect(clientId) {
    onSelectClient(clientId)
    closeMenu({ returnFocus: true })
  }

  function moveHighlightedIndex(direction, { focusOption = false } = {}) {
    if (!hasResults) {
      return
    }

    setHighlightedIndex((current) => {
      const baseIndex = current >= 0 ? current : getInitialHighlightIndex(filteredClients, selectedClient)
      const nextIndex = (baseIndex + direction + filteredClients.length) % filteredClients.length

      if (focusOption) {
        window.requestAnimationFrame(() => {
          optionRefs.current[nextIndex]?.focus()
        })
      }

      return nextIndex
    })
  }

  useEffect(() => {
    function handlePointerDown(event) {
      if (open && !containerRef.current?.contains(event.target)) {
        closeMenu()
      }
    }

    function handleFocusIn(event) {
      if (open && !containerRef.current?.contains(event.target)) {
        closeMenu()
      }
    }

    function handleDocumentKeyDown(event) {
      if (event.defaultPrevented) {
        return
      }

      if (event.key === 'Escape' && open && containerRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        closeMenu({ returnFocus: true })
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('keydown', handleDocumentKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [open, menuVisible])

  useEffect(() => {
    if (status !== 'ready') {
      closeMenu()
    }
  }, [status])

  useEffect(() => {
    return () => {
      clearCloseTimeout()
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    const nextIndex = getInitialHighlightIndex(filteredClients, selectedClient)
    setHighlightedIndex(nextIndex)

    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }, [open, filteredClients, selectedClient?.id, query])

  useEffect(() => {
    if (!open || highlightedIndex < 0) {
      return
    }

    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, highlightedIndex])

  function handleTriggerKeyDown(event) {
    if (!isReady) {
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu()
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      closeMenu({ returnFocus: true })
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveHighlightedIndex(1, { focusOption: true })
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveHighlightedIndex(-1, { focusOption: true })
    }

    if (event.key === 'Enter' && highlightedIndex >= 0 && filteredClients[highlightedIndex]) {
      event.preventDefault()
      handleSelect(filteredClients[highlightedIndex].id)
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu({ returnFocus: true })
    }
  }

  function handleOptionKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveHighlightedIndex(1, { focusOption: true })
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveHighlightedIndex(-1, { focusOption: true })
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu({ returnFocus: true })
    }
  }

  return (
    <div className={joinClasses(styles.dropdownWrap, compact && styles.dropdownWrapCompact)} ref={containerRef}>
      <button
        aria-controls={menuVisible ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={joinClasses(
          styles.clientDropdownSimpleTrigger,
          compact && styles.clientDropdownSimpleTriggerCompact,
          open && styles.clientDropdownSimpleTriggerActive,
        )}
        disabled={!isReady}
        onClick={() => {
          if (!isReady) {
            return
          }

          if (open) {
            closeMenu()
            return
          }

          openMenu()
        }}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        type="button"
      >
        <span className={styles.clientDropdownSimpleTriggerContent}>
          <span className={styles.clientDropdownSimpleValue}>{triggerLabel}</span>
        </span>
        <WorkspaceIcon
          className={joinClasses(
            styles.clientDropdownSimpleTriggerIcon,
            open && styles.clientDropdownSimpleTriggerIconOpen,
          )}
          name="chevronDown"
          size={18}
        />
      </button>

      {menuVisible ? (
        <div
          aria-hidden={!open}
          className={joinClasses(
            styles.clientDropdownSimpleMenu,
            compact && styles.clientDropdownSimpleMenuCompact,
            menuAlign === 'end' && styles.dropdownMenuAlignEnd,
            open ? styles.clientDropdownSimpleMenuOpen : styles.clientDropdownSimpleMenuClosed,
          )}
        >
          <label className={styles.clientDropdownSimpleSearch}>
            <span className={styles.clientDropdownSimpleSearchIcon}>
              <WorkspaceIcon name="search" size={14} />
            </span>
            <input
              aria-activedescendant={
                highlightedIndex >= 0 && filteredClients[highlightedIndex]
                  ? `${listboxId}-${filteredClients[highlightedIndex].id}`
                  : undefined
              }
              aria-controls={listboxId}
              aria-label="Search clients"
              autoComplete="off"
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search clients"
              ref={searchInputRef}
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="Clear search"
                className={styles.clientDropdownSimpleSearchClear}
                onClick={() => {
                  onQueryChange('')
                  window.requestAnimationFrame(() => {
                    searchInputRef.current?.focus()
                  })
                }}
                type="button"
              >
                <WorkspaceIcon name="close" size={14} />
              </button>
            ) : null}
          </label>

          <div className={styles.clientDropdownSimpleDivider} />

          {status === 'loading' ? (
            <div className={styles.clientDropdownSimpleState}>
              Loading clients...
            </div>
          ) : null}

          {status === 'error' ? (
            <div className={styles.clientDropdownSimpleState}>
              <p>{errorMessage || 'Could not load clients.'}</p>
              <button className={styles.clientDropdownSimpleSecondaryAction} onClick={onRetry} type="button">
                Retry
              </button>
            </div>
          ) : null}

          {status === 'ready' ? (
            <div aria-label="Client options" className={styles.clientDropdownSimpleList} id={listboxId} role="listbox">
              {hasResults ? (
                filteredClients.map((client, optionIndex) => {
                  const isSelected = selectedClient?.id === client.id
                  const isHighlighted = highlightedIndex === optionIndex
                  const optionId = `${listboxId}-${client.id}`

                  return (
                    <button
                      className={joinClasses(
                        styles.clientDropdownSimpleOption,
                        isHighlighted && styles.clientDropdownSimpleOptionHighlighted,
                        isSelected && styles.clientDropdownSimpleOptionActive,
                      )}
                      data-client-id={client.id}
                      id={optionId}
                      key={client.id}
                      onFocus={() => setHighlightedIndex(optionIndex)}
                      onKeyDown={handleOptionKeyDown}
                      onMouseEnter={() => setHighlightedIndex(optionIndex)}
                      onClick={() => handleSelect(client.id)}
                      ref={(element) => {
                        optionRefs.current[optionIndex] = element
                      }}
                      role="option"
                      tabIndex={highlightedIndex === optionIndex ? 0 : -1}
                      type="button"
                      aria-selected={isSelected}
                    >
                      <span className={styles.clientDropdownSimpleOptionText}>{client.name}</span>
                      {isSelected ? (
                        <span className={styles.clientDropdownSimpleOptionIcon}>
                          <WorkspaceIcon name="check" size={15} />
                        </span>
                      ) : null}
                    </button>
                  )
                })
              ) : (
                <div className={styles.clientDropdownSimpleEmpty}>
                  <p>{clients.length === 0 ? 'No clients available.' : 'No clients found.'}</p>
                  {showCreateAction && clients.length === 0 ? (
                    <button className={styles.clientDropdownSimplePrimaryAction} onClick={onCreateClient} type="button">
                      Add client
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
