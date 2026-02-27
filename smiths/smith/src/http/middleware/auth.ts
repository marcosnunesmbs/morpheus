import { Request, Response, NextFunction } from 'express';

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    // Here you would typically verify the token
    // For example, using a JWT library to decode and verify the token
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // if (!decoded) {
    //     return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    // }

    // Attach user information to the request object if needed
    // req.user = decoded;

    next();
};

export default authMiddleware;