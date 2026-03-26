import { handleDashboardSummaryRequest } from '../lib/handlers/dashboardSummary.js'

export default function handler(req, res) {
  return handleDashboardSummaryRequest(req, res, { enableCors: true })
}
