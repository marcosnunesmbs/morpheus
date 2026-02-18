import { Request, Response, NextFunction } from 'express';
import { AUTH_HEADER } from '../../types/auth.js';
import { DisplayManager } from '../../runtime/display.js';

/**
 * Middleware to protect API routes with a password from THE_ARCHITECT_PASS env var.
 * If the env var is not set, uses default password 'iamthearchitect'.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Use environment variable if set, otherwise use default password
  const architectPass = process.env.THE_ARCHITECT_PASS || 'iamthearchitect';

  // If password is not configured (using default), log a warning
  if (!process.env.THE_ARCHITECT_PASS) {
    const display = DisplayManager.getInstance();
    // display.log('Using default password for dashboard access. For security, set THE_ARCHITECT_PASS environment variable.', { source: 'http', level: 'warning' });
  }

  const providedPass = req.headers[AUTH_HEADER];

  if (providedPass === architectPass) {
    return next();
  }

  const display = DisplayManager.getInstance();
  display.log(`Unauthorized access attempt to ${req.path}`, { source: 'http', level: 'warning' });

  return res.status(401).json({
    error: 'Unauthorized',
    code: 'UNAUTHORIZED'
  });
};
