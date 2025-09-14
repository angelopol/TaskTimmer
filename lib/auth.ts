import bcrypt from 'bcrypt';
import { prisma } from './prisma'; // tsconfig adjusted; extension optional under NodeNext in Next.js runtime

export async function createUser(email: string, password: string, name?: string) {
  const hash = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { email, passwordHash: hash, name } });
}

export async function verifyUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}
