import mongoose from 'mongoose'

const globalMongoose = globalThis.__akountsmartMongoose ?? {
  connection: null,
  promise: null,
}

globalThis.__akountsmartMongoose = globalMongoose

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
      serverSelectionTimeoutMS: 10000,
    })
  }

  globalMongoose.connection = await globalMongoose.promise
  return globalMongoose.connection
}
