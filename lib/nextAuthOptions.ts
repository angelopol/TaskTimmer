import type { NextAuthOptions, Session, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyUser } from './auth';

const SHORT_SESSION_HOURS = parseInt(process.env.SHORT_SESSION_HOURS || '6', 10); // default 6h
const LONG_SESSION_DAYS = parseInt(process.env.LONG_SESSION_DAYS || '30', 10);    // default 30d

type RememberCredentials = {
  email?: string;
  password?: string;
  remember?: string;
};

type RememberUser = User & { remember?: boolean };

type RememberToken = JWT & {
  userId?: string;
  remember?: boolean;
  expTs?: number;
};

type RememberSession = Session & {
  userId?: string | null;
  remember?: boolean;
  expiresAt?: number | null;
};

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 }, // base fallback
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
        // include remember so NextAuth forwards it to authorize()
        remember: { label: 'Remember', type: 'text' }
      },
      async authorize(credentials) {
        const { email, password, remember } = (credentials ?? {}) as RememberCredentials;
        if (!email || !password) return null;
        const user = await verifyUser(email, password);
        if (!user) return null;
        // Attach remember to the user payload so jwt callback can read it
        const rememberFlag = remember === '1' || remember === 'true';
        const rememberUser: RememberUser = {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          remember: rememberFlag
        };
        return rememberUser;
      }
    })
  ],
  pages: {},
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const rememberToken = token as RememberToken;
      // On initial sign in attach userId and compute expiration based on remember flag.
      if (user) {
        const rememberUser = user as RememberUser;
        rememberToken.userId = rememberUser.id;
        // Set remember based on user.remember if present, else keep existing or default false
        if (typeof rememberUser.remember !== 'undefined') {
          rememberToken.remember = !!rememberUser.remember;
        } else if (typeof rememberToken.remember === 'undefined') {
          rememberToken.remember = false;
        }
        const now = Date.now();
        const expMs = rememberToken.remember
          ? now + LONG_SESSION_DAYS * 24 * 60 * 60 * 1000
          : now + SHORT_SESSION_HOURS * 60 * 60 * 1000;
        rememberToken.expTs = expMs; // custom epoch ms
      }

      // If trigger === 'update' (session update), allow toggling remember on the fly
      if (trigger === 'update' && session) {
        const rememberSession = session as RememberSession;
        if (typeof rememberSession.remember !== 'undefined') {
          rememberToken.remember = !!rememberSession.remember;
          const now = Date.now();
          const expMs = rememberToken.remember
            ? now + LONG_SESSION_DAYS * 24 * 60 * 60 * 1000
            : now + SHORT_SESSION_HOURS * 60 * 60 * 1000;
          rememberToken.expTs = expMs;
        }
      }

      // Enforce expiration manually (NextAuth still has its internal maxAge but we enforce our custom window)
      if (rememberToken.expTs && Date.now() > rememberToken.expTs) {
        // Invalidate token by removing userId
        rememberToken.userId = undefined;
      }
      return rememberToken;
    },
    async session({ session, token }) {
      const rememberSession = session as RememberSession;
      const rememberToken = token as RememberToken;
      if (rememberToken.userId) {
        rememberSession.userId = rememberToken.userId;
        rememberSession.remember = rememberToken.remember ?? false;
        rememberSession.expiresAt = rememberToken.expTs ?? null;
      } else {
        // Session considered invalid
        rememberSession.userId = null;
        rememberSession.remember = false;
        rememberSession.expiresAt = null;
      }
      return rememberSession;
    }
  }
};
