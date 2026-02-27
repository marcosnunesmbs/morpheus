import { createHmac } from 'crypto';
import { promisify } from 'util';
import { Request, Response, NextFunction } from 'express';

const verifyToken = promisify(createHmac('sha256', process.env.SECRET_KEY));

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = await verifyToken(token);
        req.user = decoded; // Attach user info to request
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Failed to authenticate token' });
    }
};