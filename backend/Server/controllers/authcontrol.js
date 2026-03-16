/**
 * file name: authcontrol.js
 * name: Berny perez
 * description:
 * - Handles all authentication routes: signup, login, logout, getUserInfo, updateProfile.
 * - JWT is stored in an HTTP-only cookie on signup/login and cleared on logout.
 * - Protected routes (getUserInfo, updateProfile) require verifyToken middleware to set req.userId.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userModel from "../models/user.model.js";

const email_verify_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper: create JWT and set it as an HTTP-only cookie
const setTokenCookie = (res, userId) => {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.cookie("jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 86400000, // 1 day in ms
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
};

/**
 * POST /api/auth/signup
 * Registers a new user. Validates email/password, hashes the password,
 * saves the user to the DB, and sets a JWT cookie.
 * @returns 201 with user object | 400 invalid input | 409 email taken | 500 server error
 */
export const signup = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        if (typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({ message: "Email and password must be strings" });
        }
        if (!email_verify_regex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters long" });
        }

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "User already exist with this email" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await userModel.create({ email, password: hashedPassword });

        setTokenCookie(res, newUser._id);

        return res.status(201).json({
            user: {
                id: newUser._id,
                email: newUser.email,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                image: newUser.image,
                profileSetup: newUser.profileSetup,
            },
        });
    } catch (error) {
        console.error("Error in signup:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * POST /api/auth/login
 * Authenticates an existing user. Verifies email exists and password matches,
 * then sets a JWT cookie on success.
 * @returns 200 with user object | 400 bad credentials | 404 user not found | 500 server error
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        if (typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({ message: "Email and password must be strings" });
        }
        if (!email_verify_regex.test(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "No user found with the given email" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid email or password" });
        }

        setTokenCookie(res, user._id);

        return res.status(200).json({
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                image: user.image,
                profileSetup: user.profileSetup,
            },
        });
    } catch (error) {
        console.error("Error in login:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * POST /api/auth/logout
 * Logs out the current user by clearing the JWT cookie.
 * @returns 200 success message | 500 server error
 */
export const logout = async (_req, res) => {
    try {
        res.clearCookie("jwt");
        return res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Error in logout:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * GET /api/auth/userinfo  [protected]
 * Returns the full profile of the currently authenticated user.
 * Requires verifyToken middleware to populate req.userId.
 * @returns 200 with user object | 404 user not found | 500 server error
 */
export const getUserInfo = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            image: user.image,
            profileSetup: user.profileSetup,
            color: user.color,
        });
    } catch (error) {
        console.error("Error in getUserInfo:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * POST /api/auth/update-profile  [protected]
 * Updates the authenticated user's firstName, lastName, and optional color.
 * Sets profileSetup to true once saved.
 * Requires verifyToken middleware to populate req.userId.
 * @returns 200 with updated user object | 400 missing fields | 500 server error
 */
export const updateProfile = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(400).json({ message: "User ID not found" });
        }

        const { firstName, lastName, color } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({ message: "First name and last name are required" });
        }

        const updatedUser = await userModel.findByIdAndUpdate(
            req.userId,
            { firstName, lastName, color, profileSetup: true },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            id: updatedUser._id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            image: updatedUser.image,
            profileSetup: updatedUser.profileSetup,
            color: updatedUser.color,
        });
    } catch (error) {
        console.error("Error in updateProfile:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
