import { handlePasswordManagerRevealRequest } from '../../lib/passwordManagerHandler.js'

export default async function handler(req, res) {
  return handlePasswordManagerRevealRequest(req, res, { enableCors: true })
}
