/**
 * file name: verifyToken.js
 * name: Berny Perez
 * description:
 * - Middleware that protects routes by validating the JWT stored in the HTTP-only cookie.
 * - Reads the "jwt" cookie set by signup/login, verifies it using JWT_SECRET,
 *   and attaches the decoded userId to req.userId for use in downstream controllers.
 * - Returns 401 if the token is missing or invalid.
 */

import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    const token = req.cookies.jwt;

    if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
};
