import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'test-access-token',
          },
        },
      })),
    },
  },
}))

function createJsonResponse(payload, { ok = true, status = 200, url = 'https://api.example.com' } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(payload),
    url,
  }
}

describe('tallyXmlConverterService', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('downloads the sample template from the dedicated template endpoint', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')

    global.fetch.mockResolvedValueOnce(
      createJsonResponse(
        {
          download_url: '/downloads/tally-sample-template.xlsm',
          expires_in_seconds: 60,
        },
        {
          url: 'https://api.example.com/api/tally-xml/template',
        },
      ),
    )

    const { downloadTallyTemplate } = await import('./tallyXmlConverterService')
    const result = await downloadTallyTemplate()

    expect(global.fetch).toHaveBeenCalledWith('/tally-xml-proxy/api/tally-xml/template', {
      headers: {
        accept: 'application/json',
      },
    })
    expect(result).toEqual({
      downloadHref: 'https://api.example.com/downloads/tally-sample-template.xlsm',
      expiresInSeconds: 60,
      message: 'Template download started. Link expires in 60 seconds.',
    })
  })
})
