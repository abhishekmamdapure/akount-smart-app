export const workspaceRoutes = Object.freeze({
  accounting: '/accounting',
  accountSettings: '/account-settings',
  clients: '/clients',
  gstReconciliation: '/gst-reconciliation',
  help: '/help',
  home: '/dashboard',
  invoiceProcessing: '/invoice-processing',
  passwordManager: '/password-manager',
  pdfTools: '/pdf-tools',
  reconciliation2b: '/reconciliation-2b',
  reconciliation4a: '/reconciliation-4a',
  settings: '/settings',
  tallyXmlConverter: '/tally-xml-converter',
})

/**
 * Builds the redirect target for legacy dashboard-prefixed workspace URLs.
 *
 * @param {string} pathname - The current location pathname.
 * @param {string} [search=''] - The current location search string.
 * @param {string} [hash=''] - The current location hash string.
 * @returns {string} The replacement path without the legacy `/dashboard` prefix.
 */
export function buildLegacyDashboardRedirectTarget(pathname, search = '', hash = '') {
  const currentPath = String(pathname || '')

  if (currentPath === workspaceRoutes.home || currentPath === `${workspaceRoutes.home}/`) {
    return `${workspaceRoutes.home}${search}${hash}`
  }

  if (!currentPath.startsWith(`${workspaceRoutes.home}/`)) {
    return `${currentPath || '/'}${search}${hash}`
  }

  const nextPath = currentPath.slice(workspaceRoutes.home.length) || '/'

  return `${nextPath === '/' ? workspaceRoutes.home : nextPath}${search}${hash}`
}
