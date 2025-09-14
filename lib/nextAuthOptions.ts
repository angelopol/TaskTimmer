import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyUser } from './auth';

const SHORT_SESSION_HOURS = parseInt(process.env.SHORT_SESSION_HOURS || '6', 10); // default 6h
const LONG_SESSION_DAYS = parseInt(process.env.LONG_SESSION_DAYS || '30', 10);    // default 30d

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 }, // base fallback
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await verifyUser(credentials.email, credentials.password);
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name };
      }
    })
  ],
  pages: {},
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      // On initial sign in attach userId and compute expiration based on remember flag.
      if (user) {
        token.userId = (user as any).id;
        // Expect a custom flag passed in signIn credentials via token.remember
        // Because credentials provider does not forward arbitrary fields automatically, we can
        // encode remember in the token on first call by reading from (account as any)?.remember if we populate it client-side.
        // Simpler: rely on token.remember already set in a preceding jwt callback run via trigger === 'signIn'.
        if (typeof (token as any).remember === 'undefined') {
          // default short if unknown
          (token as any).remember = false;
        }
        const now = Date.now();
        const expMs = (token as any).remember
          ? now + LONG_SESSION_DAYS * 24 * 60 * 60 * 1000
          : now + SHORT_SESSION_HOURS * 60 * 60 * 1000;
        (token as any).expTs = expMs; // custom epoch ms
      }

      // If trigger === 'update' (session update), allow toggling remember on the fly
      if (trigger === 'update' && session) {
        if (typeof (session as any).remember !== 'undefined') {
          (token as any).remember = !!(session as any).remember;
          const now = Date.now();
            const expMs = (token as any).remember
              ? now + LONG_SESSION_DAYS * 24 * 60 * 60 * 1000
              : now + SHORT_SESSION_HOURS * 60 * 60 * 1000;
          (token as any).expTs = expMs;
        }
      }

      // Enforce expiration manually (NextAuth still has its internal maxAge but we enforce our custom window)
      if ((token as any).expTs && Date.now() > (token as any).expTs) {
        // Invalidate token by removing userId
        delete (token as any).userId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        (session as any).userId = token.userId;
        (session as any).remember = (token as any).remember || false;
        (session as any).expiresAt = (token as any).expTs || null;
      } else {
        // Session considered invalid
        (session as any).userId = null;
      }
      return session;
    }
  }
};
