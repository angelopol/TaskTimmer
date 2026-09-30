import { getServerSession } from 'next-auth';
import { authOptions } from './nextAuthOptions';

/** The signed-in TaskTimmer user id, or null. */
export async function sessionUserId() {
  const session = await getServerSession(authOptions as any);
  return ((session as any)?.userId as string | undefined) || null;
}
