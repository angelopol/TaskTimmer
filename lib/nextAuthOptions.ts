import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyUser } from './auth';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
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
    async jwt({ token, user }) {
      if (user) token.userId = (user as any).id;
      return token;
    },
    async session({ session, token }) {
      (session as any).userId = token.userId;
      return session;
    }
  }
};
