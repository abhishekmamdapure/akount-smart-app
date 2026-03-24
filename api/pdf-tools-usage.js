import { handlePdfToolsUsageRequest } from '../lib/handlers/pdfToolsUsage.js'

export default function handler(req, res) {
  return handlePdfToolsUsageRequest(req, res, { enableCors: true })
}
