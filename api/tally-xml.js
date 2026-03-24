import { handleTallyXmlConversionRequest } from '../lib/handlers/tallyXmlConversion.js'

export default async function handler(req, res) {
  return handleTallyXmlConversionRequest(req, res, { enableCors: true })
}