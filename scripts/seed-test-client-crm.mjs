import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { connectDB } from '../lib/mongodb.js'
import {
  CLIENT_CRM_COLLECTION,
  ClientWorkspace,
  normalizeClientPayload,
} from '../lib/models/client.js'
import { SAMPLE_CLIENTS, TEST_CRM_USER } from '../shared/clientCrmFixtures.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

try {
  const envFile = readFileSync(join(projectRoot, '.env.local'), 'utf-8')
  envFile.split('\n').forEach((line) => {
    const [key, ...val] = line.split('=')
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = val.join('=').trim()
    }
  })
} catch {
  // .env.local not found
}

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required in .env.local or process env.')
  process.exit(1)
}

await connectDB()

let workspace = await ClientWorkspace.findOne({ 'owner.userId': TEST_CRM_USER.id })

if (!workspace) {
  workspace = new ClientWorkspace({
    owner: {
      userId: TEST_CRM_USER.id,
      email: TEST_CRM_USER.email,
      lastSeenAt: new Date(),
    },
    clients: [],
  })
} else {
  workspace.owner.email = TEST_CRM_USER.email
  workspace.owner.lastSeenAt = new Date()
}

for (const sample of SAMPLE_CLIENTS) {
  const normalizedClient = normalizeClientPayload(sample)
  const existingClient = workspace.clients.find((client) => {
    if (normalizedClient.gst && client.gst) {
      return client.gst === normalizedClient.gst
    }

    return client.email === normalizedClient.email
  })

  if (!existingClient) {
    workspace.clients.push(normalizedClient)
  }
}

await workspace.save()

console.log('Seed completed successfully.')
console.log(`Collection: ${CLIENT_CRM_COLLECTION}`)
console.log(`Owner User Id: ${TEST_CRM_USER.id}`)
console.log(`Owner Email: ${TEST_CRM_USER.email}`)
console.log(`Attached Clients: ${workspace.clients.length}`)
