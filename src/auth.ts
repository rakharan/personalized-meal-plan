// Saji auth layer — bcrypt password hashing + JWT tokens
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
  ? (() => { throw new Error('JWT_SECRET env var required in production'); })()
  : 'dev-only-secret-not-for-prod');
const JWT_EXPIRES = '30d';

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    return payload;
  } catch {
    return null;
  }
}

// Express middleware — checks JWT in Authorization header
export function userAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) {
    res.status(401).json({ error: 'Login dulu ya' });
    return;
  }
  const payload = verifyToken(auth);
  if (!payload) {
    res.status(401).json({ error: 'Token kedaluwarsa. Login lagi ya.' });
    return;
  }
  (req as any).userId = payload.userId;
  next();
}

// Dummy hash for timing-attack-safe login — used when email not found
export const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad683oKkLq1kSqu';
