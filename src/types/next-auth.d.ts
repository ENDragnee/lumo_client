// types/next-auth.d.ts

import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's unique identifier from your database (_id.toString()) */
      id: string;
      /** The user's unique @ handle */
      userTag: string;
      /** The user's role or type */
      user_type: string;
    } & DefaultSession["user"]; // Keep the default properties (name, email, image)
  }

  /**
   * The shape of the user object returned in the OAuth profile or database,
   * or the object returned by the `authorize` callback.
   */
  interface User extends DefaultUser {
    // This should match the structure returned by `authorize` or used in `signIn`
    id: string;
  }
}

// Extend the JWT type to include the properties you add in the `jwt` callback
declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT extends DefaultJWT {
    /** User's unique identifier (_id.toString()) */
    id: string;
    /** The user's unique @ handle */
    userTag?: string;
    /** The user's role or type */
    user_type?: string;
    // Note: `picture` is already part of DefaultJWT
  }
}
