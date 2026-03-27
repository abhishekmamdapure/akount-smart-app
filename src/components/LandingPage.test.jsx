import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LandingPage from './LandingPage'

const EARLY_ACCESS_PERK_MESSAGE = 'Early Access Perk: First month FREE for waitlist members'

describe('LandingPage', () => {
  it('renders the early access banner between the waitlist form and the features grid', () => {
    const markup = renderToStaticMarkup(<LandingPage />)

    expect(markup).toContain(EARLY_ACCESS_PERK_MESSAGE)
    expect(markup.indexOf('Join the waitlist')).toBeLessThan(markup.indexOf(EARLY_ACCESS_PERK_MESSAGE))
    expect(markup.indexOf(EARLY_ACCESS_PERK_MESSAGE)).toBeLessThan(markup.indexOf('Password Management'))
  })
})
