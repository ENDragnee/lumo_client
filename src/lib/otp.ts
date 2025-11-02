// otp.ts
import connectDB from '@/lib/mongodb';
import Otp from '@/models/Otp';

export const generateOTP = (length = 6) => {
  return Math.floor(
    10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1),
  ).toString();
};

export const storeOTP = async (email: string, otp: string, expiresAt: Date) => {
  try {
    await connectDB();
    const result = await Otp.findOneAndUpdate(
      { email },
      { otp, expiresAt },
      { upsert: true, new: true },
    );
    return result;
  } catch (error) {
    console.error('Error storing OTP:', error);
    throw new Error(
      'Error storing OTP in MongoDB: ' + (error as Error).message,
    );
  }
};

export const verifyOTP = async (email: string, otp: string) => {
  try {
    await connectDB();
    const record = await Otp.findOne({ email });
    if (!record || record.otp !== otp || record.expiresAt < new Date())
      return false;
    return true;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw new Error(
      'Error verifying OTP in MongoDB: ' + (error as Error).message,
    );
  }
};

