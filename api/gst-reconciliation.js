import { handleGstReconciliationRequest } from '../lib/handlers/gstReconciliation.js'

export default async function handler(req, res) {
  return handleGstReconciliationRequest(req, res, { enableCors: true })
}
