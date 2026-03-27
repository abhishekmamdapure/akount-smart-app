import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CustomSectionTitleEditor from './CustomSectionTitleEditor'

describe('CustomSectionTitleEditor', () => {
  it('renders the section header with an inline edit trigger', () => {
    const html = renderToStaticMarkup(
      <CustomSectionTitleEditor
        editing={false}
        onChange={() => {}}
        onEditEnd={() => {}}
        onEditStart={() => {}}
        title="SBI"
      />,
    )

    expect(html).toContain('SBI')
    expect(html).toContain('aria-label="Edit section title"')
  })

  it('renders an inline input when the title is being edited', () => {
    const html = renderToStaticMarkup(
      <CustomSectionTitleEditor
        editing
        onChange={() => {}}
        onEditEnd={() => {}}
        onEditStart={() => {}}
        title=""
      />,
    )

    expect(html).toContain('placeholder="Custom Section"')
    expect(html).toContain('value=""')
  })
})
