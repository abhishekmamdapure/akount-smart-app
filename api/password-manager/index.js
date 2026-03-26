import { handlePasswordManagerRequest } from '../../lib/passwordManagerHandler.js'

export default async function handler(req, res) {
  return handlePasswordManagerRequest(req, res, { enableCors: true })
}
