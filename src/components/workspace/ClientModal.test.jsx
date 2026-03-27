import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ClientModal from './ClientModal'

describe('ClientModal', () => {
  it('suppresses browser autofill hints for the client onboarding form', () => {
    const html = renderToStaticMarkup(
      <ClientModal
        client={null}
        currentUser={{ email: 'owner@example.com', id: 'user-1' }}
        mode="create"
        onClose={() => {}}
        onSaved={() => {}}
        open
      />,
    )

    expect(html).toContain('<form autoComplete="off"')
    expect((html.match(/autoComplete="new-password"/g) || [])).toHaveLength(10)
  })

  it('renders the shared state dropdown options for the client address form', () => {
    const html = renderToStaticMarkup(
      <ClientModal
        client={null}
        currentUser={{ email: 'owner@example.com', id: 'user-1' }}
        mode="create"
        onClose={() => {}}
        onSaved={() => {}}
        open
      />,
    )

    expect(html).toContain('name="state"')
    expect(html).toContain('Select state')
    expect(html).toContain('Maharashtra')
    expect(html).toContain('West Bengal')
  })
})
