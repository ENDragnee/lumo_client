// app/api/send-otp/route.ts

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { generateOTP, storeOTP } from '@/lib/otp'; // adjust the path as needed

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate a 6-digit OTP
    const otp = generateOTP(6);

    // Set expiration (e.g., 10 minutes from now)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storeOTP(email, otp, expiresAt);

    // Create a transporter for sending the email using SMTP
    // Ensure these environment variables are set: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: true, // Set to true if using port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Prepare email options
    const mailOptions = {
      from: process.env.EMAIL_FROM, // e.g., '"Your App" <no-reply@yourdomain.com>'
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}. It expires in 10 minutes.`,
      // Optionally, add HTML content:
      html: `<p>Your OTP code is: <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error('Error in send-otp API:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
