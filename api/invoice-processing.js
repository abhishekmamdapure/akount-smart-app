import { handleInvoiceProcessingRequest } from '../lib/handlers/invoiceProcessing.js'

export default async function handler(req, res) {
  return handleInvoiceProcessingRequest(req, res, { enableCors: true })
}
