//@/lib/mongodb.ts
import mongoose, { Mongoose } from 'mongoose';

const MONGODB_URI = process.env.DATABASE_URL;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the DATABASE_URL environment variable in your .env file',
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Extend the NodeJS Global type with our Mongoose cache property
declare global {
  var mongooseCache: MongooseCache | undefined;
}

// This is the line we're fixing.
// We let TypeScript infer the type, which will be `MongooseCache | undefined`.
let cached = global.mongooseCache;

// If the cache is empty, we initialize it.
if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

const connectDB = async (): Promise<Mongoose> => {
  // If a connection is already cached, use it.
  // The 'if' check above ensures `cached` is not null here.
  if (cached.conn) {
    // console.log("🚀 Using cached MongoDB connection."); // Uncomment for debugging
    return cached.conn;
  }

  // If a connection promise doesn't exist, create a new one.
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    // console.log("🔥 Creating new MongoDB connection."); // Uncomment for debugging
    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log('✅ MongoDB connected successfully!');
        return mongooseInstance;
      });
  }

  try {
    // Await the connection promise and cache the connection instance.
    // The `if` check above ensures `cached` is not null here.
    cached.conn = await cached.promise;
  } catch (e) {
    // If the connection fails, nullify the promise so the next request can try again.
    cached.promise = null;
    console.error('❌ MongoDB connection error:', e);
    throw e;
  }

  // Return the established connection.
  return cached.conn;
};

export default connectDB;
