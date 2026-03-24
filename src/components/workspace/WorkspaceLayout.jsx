import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { TEST_CRM_USER, USE_TEST_CRM_USER } from '../../../shared/clientCrmFixtures.js'
import ClientModal from './ClientModal'
import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'
import {
  mobileNavigation,
  navigationSections,
  utilityNavigation,
  workspaceUser,
} from './workspaceData'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function buildUserHeaders(currentUser) {
  return {
    'x-user-id': currentUser?.id ?? '',
    'x-user-email': currentUser?.email ?? '',
  }
}

function buildInitials(firstName, lastName, fallbackValue = '') {
  const source = `${firstName || ''} ${lastName || ''}`.trim() || fallbackValue

  return source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'AS'
}

function SidebarLink({ item, onClick }) {
  return (
    <NavLink
      className={({ isActive }) =>
        joinClasses(
          styles.navLink,
          item.compact && styles.navLinkCompact,
          isActive && styles.navLinkActive,
        )
      }
      end={item.exact}
      onClick={onClick}
      to={item.to}
    >
      <WorkspaceIcon className={styles.navIcon} name={item.icon} size={18} />
      <span>{item.label}</span>
    </NavLink>
  )
}

export default function WorkspaceLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const profileMenuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [clientModalMode, setClientModalMode] = useState('create')
  const [clientModalTarget, setClientModalTarget] = useState(null)
  const [clientRefreshKey, setClientRefreshKey] = useState(0)
  const [activeToolClientId, setActiveToolClientId] = useState('')
  const [currentUser, setCurrentUser] = useState(USE_TEST_CRM_USER ? TEST_CRM_USER : null)
  const [authReady, setAuthReady] = useState(USE_TEST_CRM_USER)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [userProfile, setUserProfile] = useState(null)

  useEffect(() => {
    setMenuOpen(false)
    setProfileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!profileMenuOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [profileMenuOpen])

  useEffect(() => {
    if (USE_TEST_CRM_USER) {
      setCurrentUser(TEST_CRM_USER)
      setAuthReady(true)
      return undefined
    }

    let isMounted = true

    async function loadSession() {
      const { data } = await supabase.auth.getSession()

      if (isMounted) {
        setCurrentUser(data.session?.user ?? null)
        setAuthReady(true)
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null)
      setAuthReady(true)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function loadUserProfile(targetUser = currentUser) {
    if (!targetUser?.id || !targetUser?.email) {
      setUserProfile(null)
      return
    }

    try {
      const response = await fetch('/api/user-settings', {
        headers: buildUserHeaders(targetUser),
      })
      const data = await response.json()

      if (!response.ok) {
        console.error('Unable to fetch user settings:', data.error)
        return
      }

      setUserProfile(data.user ? { ...data.user, usage: data.usage || { clientsUsed: 0 } } : null)
    } catch (error) {
      console.error('Unable to fetch user settings:', error)
    }
  }

  useEffect(() => {
    if (!authReady) {
      return
    }

    loadUserProfile(currentUser)
  }, [authReady, currentUser?.email, currentUser?.id, clientRefreshKey])

  const profileName = `${userProfile?.profile?.firstName || ''} ${userProfile?.profile?.lastName || ''}`.trim()
  const displayName = profileName || currentUser?.user_metadata?.full_name || currentUser?.email || workspaceUser.name

  const avatarText = buildInitials(
    userProfile?.profile?.firstName,
    userProfile?.profile?.lastName,
    displayName,
  )

  function openClientModal() {
    setClientModalMode('create')
    setClientModalTarget(null)
    setClientModalOpen(true)
  }

  function openEditClientModal(client) {
    setClientModalMode('edit')
    setClientModalTarget(client)
    setClientModalOpen(true)
  }

  function closeClientModal() {
    setClientModalOpen(false)
    setClientModalTarget(null)
    setClientModalMode('create')
  }

  function handleClientSaved() {
    setClientModalOpen(false)
    setClientModalTarget(null)
    setClientModalMode('create')
    setClientRefreshKey((current) => current + 1)
  }

  async function handleLogout() {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)

    try {
      if (!USE_TEST_CRM_USER) {
        const { error } = await supabase.auth.signOut()

        if (error) {
          throw error
        }
      }

      setActiveToolClientId('')
      setCurrentUser(null)
      setUserProfile(null)
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Unable to sign out:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  function handleAccountClick() {
    setProfileMenuOpen(false)
    navigate('/dashboard/settings')
  }

  async function handleProfileLogoutClick() {
    setProfileMenuOpen(false)
    await handleLogout()
  }

  return (
    <div className={styles.shell}>
      {menuOpen && (
        <button
          aria-label="Close navigation"
          className={styles.mobileBackdrop}
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      )}

      <aside className={joinClasses(styles.sidebar, menuOpen && styles.sidebarOpen)}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandMark}>
            <img alt="Logo" className={styles.brandLogo} src="/images/logo.png" />
          </div>
        </div>

        <div className={styles.sidebarBody}>
          <nav className={styles.sidebarNav}>
            {navigationSections.map((section, index) => (
              <div className={styles.navSection} key={`${section.title || 'section'}-${index}`}>
                {section.title ? <div className={styles.navSectionLabel}>{section.title}</div> : null}
                <div className={styles.navSectionItems}>
                  {section.items.map((item) => (
                    <SidebarLink
                      item={item}
                      key={`${section.title}-${item.label}-${item.to}`}
                      onClick={() => setMenuOpen(false)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <div className={styles.utilityLinks}>
              {utilityNavigation.map((item) => (
                <SidebarLink item={item} key={`utility-${item.label}-${item.to}`} onClick={() => setMenuOpen(false)} />
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              aria-label="Open navigation"
              className={styles.menuButton}
              onClick={() => setMenuOpen(true)}
              type="button"
            >
              <WorkspaceIcon name="menu" size={18} />
            </button>
          </div>

          <div className={styles.topbarRight}>
            <button aria-label="Notifications" className={styles.utilityButton} type="button">
              <WorkspaceIcon name="bell" size={18} />
            </button>
            <span aria-hidden="true" className={styles.topbarDivider} />
            <div className={styles.profileMenu} ref={profileMenuRef}>
              <button
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                aria-label="Open account menu"
                className={styles.profileTrigger}
                onClick={() => setProfileMenuOpen((open) => !open)}
                type="button"
              >
                {userProfile?.profile?.photoUrl ? (
                  <img alt={`${displayName} profile`} className={styles.profileTriggerImage} src={userProfile.profile.photoUrl} />
                ) : (
                  <span aria-hidden="true" className={styles.profileTriggerAvatar}>{avatarText}</span>
                )}
                <WorkspaceIcon
                  className={joinClasses(styles.profileChevron, profileMenuOpen && styles.profileChevronOpen)}
                  name="chevronDown"
                  size={14}
                />
              </button>

              {profileMenuOpen ? (
                <div className={styles.profileDropdown} role="menu">
                  <button className={styles.profileMenuItem} onClick={handleAccountClick} role="menuitem" type="button">
                    <WorkspaceIcon name="account" size={16} />
                    <span>Account</span>
                  </button>
                  <button
                    className={styles.profileMenuItem}
                    disabled={isSigningOut}
                    onClick={handleProfileLogoutClick}
                    role="menuitem"
                    type="button"
                  >
                    <WorkspaceIcon name="logout" size={16} />
                    <span>{isSigningOut ? 'Logging out...' : 'Logout'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className={styles.main}>
          <Outlet
            context={{
              activeToolClientId,
              authReady,
              clientRefreshKey,
              currentUser,
              openClientModal,
              openEditClientModal,
              refreshUserProfile: loadUserProfile,
              setActiveToolClientId,
              userProfile,
            }}
          />
        </main>
      </div>

      <nav className={styles.bottomNav}>
        {mobileNavigation.map((item) => (
          <NavLink
            className={({ isActive }) =>
              joinClasses(styles.bottomNavLink, isActive && styles.bottomNavLinkActive)
            }
            end={item.exact}
            key={item.to}
            to={item.to}
          >
            <WorkspaceIcon name={item.icon} size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <ClientModal
        client={clientModalTarget}
        currentUser={currentUser}
        mode={clientModalMode}
        onClose={closeClientModal}
        onSaved={handleClientSaved}
        open={clientModalOpen}
      />
    </div>
  )
}
