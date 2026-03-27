import { describe, expect, it } from 'vitest'
import { buildSourceHistoryFileLink } from './historyFileLinks'

describe('historyFileLinks', () => {
  it('uses the uploaded source file link instead of the processed output link', () => {
    expect(
      buildSourceHistoryFileLink({
        downloadHref: 'https://storage.example.com/result.xlsx',
        fileName: 'invoice-source.pdf',
        sourceDownloadHref: 'https://storage.example.com/source.pdf',
      }),
    ).toEqual({
      fileName: 'invoice-source.pdf',
      href: 'https://storage.example.com/source.pdf',
    })
  })

  it('falls back to a safe file label when the source link is unavailable', () => {
    expect(buildSourceHistoryFileLink({}, 'invoice.pdf')).toEqual({
      fileName: 'invoice.pdf',
      href: '',
    })
  })
})
