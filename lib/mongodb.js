import mongoose from 'mongoose'

const globalMongoose = globalThis.__akountsmartMongoose ?? {
  connection: null,
  promise: null,
}

globalThis.__akountsmartMongoose = globalMongoose

mongoose.set('strictQuery', true)

export async function connectDB() {
  if (globalMongoose.connection) {
    return globalMongoose.connection
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  if (!globalMongoose.promise) {
    globalMongoose.promise = mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'akountsmart',
      maxIdleTimeMS: 30000,
      maxPoolSize: 20,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      waitQueueTimeoutMS: 10000,
    })
  }

  try {
    globalMongoose.connection = await globalMongoose.promise
  } catch (error) {
    globalMongoose.promise = null
    throw error
  }

  return globalMongoose.connection
}
