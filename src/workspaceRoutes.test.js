import { describe, expect, it } from 'vitest'
import { buildLegacyDashboardRedirectTarget, workspaceRoutes } from './workspaceRoutes'

describe('workspaceRoutes', () => {
  it('keeps dashboard home as the only dashboard-prefixed primary route', () => {
    expect(workspaceRoutes.home).toBe('/dashboard')
    expect(workspaceRoutes.invoiceProcessing).toBe('/invoice-processing')
    expect(workspaceRoutes.clients).toBe('/clients')
  })

  it('strips the legacy dashboard prefix from workspace tool URLs', () => {
    expect(
      buildLegacyDashboardRedirectTarget('/dashboard/invoice-processing', '?source=legacy', '#top'),
    ).toBe('/invoice-processing?source=legacy#top')
  })

  it('preserves the dashboard home URL when the legacy path points to the workspace root', () => {
    expect(buildLegacyDashboardRedirectTarget('/dashboard/', '', '')).toBe('/dashboard')
  })
})
