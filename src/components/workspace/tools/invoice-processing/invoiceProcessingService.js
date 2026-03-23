import { supabase } from '../../../../supabase'

const apiBaseUrl = import.meta.env.VITE_INVOICE_PROCESS_API_BASE_URL

function buildDownloadHref(downloadUrl) {
  if (!downloadUrl || !apiBaseUrl) {
    return ''
  }

  if (/^https?:\/\//.test(downloadUrl)) {
    return downloadUrl
  }

  return `${apiBaseUrl}${downloadUrl}`
}

export async function processInvoiceFile({ file, mode, selectedClient }) {
  if (!apiBaseUrl) {
    return {
      mode: 'preview-only',
      clientName: selectedClient.name,
      fileName: file.name,
      message:
        'The UI flow is ready, but `VITE_INVOICE_PROCESS_API_BASE_URL` is not configured yet. Connect the processing API to run OCR and generate Excel output.',
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token
  if (!token) {
    throw new Error('Session expired. Please sign in again.')
  }

  const form = new FormData()
  form.append('pdf_file', file, file.name)
  form.append('client_id', selectedClient.id)
  form.append('client_name', selectedClient.name)

  const endpoint = `${apiBaseUrl}/api/invoice-processing?mode=${encodeURIComponent(mode)}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(
      `Upload failed (${response.status}). ${responseText ? responseText.slice(0, 180) : 'Check the invoice-processing API connection.'}`,
    )
  }

  const data = await response.json()

  return {
    mode: 'connected',
    clientName: selectedClient.name,
    downloadHref: buildDownloadHref(data?.download_url),
    downloadUrl: data?.download_url || '',
    fileId: data?.file_id || '',
    fileName: file.name,
    message: 'Invoice processed successfully. Review the generated output and download the Excel file if available.',
    pages: data?.pages ?? null,
  }
}
