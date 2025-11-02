// models/Otp.ts
import mongoose, { Document, Types } from 'mongoose';

export interface IOtp extends Document {
  _id: Types.ObjectId;
  email: string;
  otp: string;
  createdAt: Date;
  expiresAt: Date;
}

const optSchema = new mongoose.Schema<IOtp>({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

const Otp: mongoose.Model<IOtp> =
  mongoose.models.Otp || mongoose.model<IOtp>('Otp', optSchema);

export default Otp;
