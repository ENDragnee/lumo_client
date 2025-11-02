// models/User
import mongoose, { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId; // Explicit _id
  name: string;
  email: string;
  phone_number?: string;
  password_hash?: string; // Make password optional for OAuth users
  user_type: string;
  userTag: string;
  createdAt: Date;
  gender?: string; // Make gender optional as it might not come from OAuth
  bio?: string;
  profileImage?: Types.ObjectId; // Can be populated from Google
  tags: string[];
  credentials: string[];
  subscribersCount: number;
  totalViews: number;
  provider?: 'credentials' | 'google'; // Track the login provider
  providerAccountId?: string; // Store Google's unique user ID
}

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/\S+@\S+\.\S+/, 'is invalid']
  },
  phone_number: {
    type: String,
    required: false
  },
  password_hash: {
    type: String,
    required: false // Changed from true
  },
  user_type: {
    type: String,
    default: 'student'
  },
  userTag: {
    type: String,
    required: true,
    unique: true
    // Consider adding logic to auto-generate this on creation if missing
  },
  createdAt: {
     type: Date,
     default: Date.now
  },
  // Make gender optional or handle default value
  gender: {
    type: String,
    required: false // Changed from true
  },
  bio: String,
  profileImage: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  }, // Google might provide this
  bannerImage: String,
  tags: [String],
  credentials: [String],
  subscribersCount: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },
  provider: {
    type: String,
    enum: ['credentials', 'google'], // Limit possible values
  },
  providerAccountId: { // Unique ID from the OAuth provider (e.g., Google sub)
    type: String,
  }
},{
  timestamps: true // Optional: Adds createdAt and updatedAt automatically if you remove the default
});

// Optional: Add a compound index for faster OAuth lookup
userSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true, sparse: true });

// Use existing model if available, otherwise create it
const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
