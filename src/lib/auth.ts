// lib/auth.ts

import {
  NextAuthOptions,
  User as NextAuthUser,
  Account,
  Profile,
} from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { verifyPassword } from './password-utils';
import connectDB from '@/lib/mongodb';
import User from '@ascii/models/schemas/User';
import { IUser } from '@ascii/models/interfaces/UserInterface';
import Media, { IMedia } from '@/models/Media';
import mongoose, { Types } from 'mongoose';
import { JWT } from 'next-auth/jwt';

// --- Helper Function: generateUniqueUserTag ---
async function generateUniqueUserTag(name: string): Promise<string> {
  await connectDB();
  let baseTag =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15) || 'user';
  let userTag = baseTag;
  let counter = 1;
  while (await User.findOne({ userTag }).lean()) {
    const tagSuffix = String(counter);
    const maxBaseLength = 20 - tagSuffix.length;
    if (baseTag.length > maxBaseLength) {
      baseTag = baseTag.substring(0, maxBaseLength);
    }
    userTag = `${baseTag}${tagSuffix}`;
    counter++;
    if (counter > 1000) {
      console.error(
        'Could not generate unique userTag after 1000 attempts for base:',
        baseTag,
      );
      userTag = `${baseTag}${Date.now()}${Math.floor(Math.random() * 100)}`;
      if (await User.findOne({ userTag }).lean()) {
        throw new Error(
          'Could not generate unique userTag even with fallback.',
        );
      }
      break;
    }
  }
  return userTag;
}
// --- End Helper Function ---

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'jsmith@example.com',
        },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          throw new Error('Missing credentials');
        }
        try {
          await connectDB();
          const existingUser = await User.findOne<IUser>({
            email: credentials.email,
          }).lean();
          if (!existingUser) {
            throw new Error('Invalid credentials');
          }
          if (!existingUser.password_hash) {
            throw new Error('This account must sign in with Google.');
          }
          const isValid = await verifyPassword(
            credentials.password,
            existingUser.password_hash,
          );
          if (!isValid) {
            throw new Error('Invalid credentials');
          }

          if (!existingUser._id) {
            console.error(
              'Credentials Auth: User found but missing _id:',
              existingUser.email,
            );
            throw new Error('Authentication failed: User data incomplete.');
          }

          return {
            id: (existingUser._id as Types.ObjectId).toString(),
            name: existingUser.name,
            email: existingUser.email,
          };
        } catch (error: any) {
          console.error('Credentials Authorize Error:', error.message);
          return null;
        }
      },
    }),
  ],

  session: { strategy: 'jwt' },

  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/',
  },

  callbacks: {
    async signIn({
      user,
      account,
      profile,
    }: {
      user: NextAuthUser;
      account: Account | null;
      profile?: Profile;
    }) {
      if (!account || !account.provider) {
        return false;
      }
      await connectDB();

      if (account.provider === 'google') {
        try {
          const email = profile?.email;
          if (!email) {
            console.error('Google profile missing email');
            return false;
          }

          const existingUser = await User.findOne<IUser>({ email }).lean();

          if (existingUser) {
            if (!existingUser._id) {
              return false;
            }
            const existingUserIdString = (
              existingUser._id as Types.ObjectId
            ).toString();
            const updateData: Partial<IUser> = {
              provider: 'google',
              providerAccountId: account.providerAccountId,
            };

            if (!existingUser.profileImage && profile?.image) {
              const newMedia = await Media.create({
                // FIX: Add explicit type assertion to resolve TS ambiguity
                uploadedBy: existingUser._id as Types.ObjectId,
                mediaType: 'image',
                filename: 'google-profile.jpg',
                path: profile.image,
              });
              updateData.profileImage = newMedia._id;
            }

            await User.updateOne(
              { _id: existingUser._id },
              { $set: updateData },
            );
            user.id = existingUserIdString;
            return true;
          } else {
            if (!profile?.name) {
              console.error('Google profile missing name');
              return false;
            }
            const newUserId = new mongoose.Types.ObjectId();
            let profileMediaId: Types.ObjectId | undefined = undefined;

            if (profile.image) {
              const newMedia = await Media.create({
                // FIX: Add explicit type assertion here as well for consistency
                uploadedBy: newUserId as Types.ObjectId,
                mediaType: 'image',
                filename: 'google-profile.jpg',
                path: profile.image,
              });
              profileMediaId = newMedia._id;
            }

            const uniqueUserTag = await generateUniqueUserTag(profile.name);
            const newUser = await User.create({
              _id: newUserId,
              email: email,
              name: profile.name,
              profileImage: profileMediaId,
              provider: 'google',
              providerAccountId: account.providerAccountId,
              userTag: uniqueUserTag,
              user_type: 'student',
            });
            user.id = newUser._id.toString();
            return true;
          }
        } catch (error) {
          console.error(`Error during Google signIn callback:`, error);
          return false;
        }
      } else if (account.provider === 'credentials') {
        return !!user?.id;
      }
      return false;
    },

    async jwt({
      token,
      user,
      account,
    }: {
      token: JWT;
      user?: NextAuthUser;
      account?: Account | null;
    }) {
      if (user?.id) {
        token.id = user.id;
      }

      if (account) {
        await connectDB();
        if (!token.id) return token;

        // FIX: Cast the result of populate().lean() to a known type. This resolves all
        // subsequent property access errors.
        const dbUser = (await User.findById(token.id)
          .populate('profileImage')
          .lean()) as (IUser & { profileImage?: IMedia }) | null;

        if (dbUser) {
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.picture = dbUser.profileImage?.path;
          token.userTag = dbUser.userTag;
          token.user_type = dbUser.userType;
        }
      }
      return token;
    },

    async session({ session, token }: { session: any; token: JWT }) {
      if (session?.user) {
        session.user.id = token.id;
        if (token.name) session.user.name = token.name;
        if (token.email) session.user.email = token.email;
        if (token.picture) session.user.image = token.picture;
        if (token.userTag) session.user.userTag = token.userTag;
        if (token.user_type) session.user.user_type = token.user_type;
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
};
