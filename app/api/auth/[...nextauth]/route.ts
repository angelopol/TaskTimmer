import NextAuth from 'next-auth';
import { authOptions } from '../../../../lib/nextAuthOptions';

const handler = NextAuth(authOptions as any);

export { handler as GET, handler as POST };
