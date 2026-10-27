/**
 * auth.ts (middleware)
 * JWT verification and role-based access control middleware.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sweetharvest-secret-key-change-in-production';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Extend Express Request to carry the decoded user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the Bearer JWT in the Authorization header.
 * Attaches the decoded user to req.user.
 */
export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'No authentication token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;

    // Confirm the user still exists and is active in DB
    const db = getDb();
    const user = db
      .prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?')
      .get(decoded.id) as { id: string; name: string; email: string; role: string; is_active: number } | undefined;

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'User account not found or deactivated.' });
      return;
    }

    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

/**
 * Role-based access control middleware factory.
 * Usage: requireRole('owner', 'accountant')
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: `Access denied. Required role: ${allowedRoles.join(' or ')}.` });
      return;
    }
    next();
  };
}

export { JWT_SECRET };
