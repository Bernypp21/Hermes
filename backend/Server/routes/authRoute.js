/**
 * file name: authRoute.js
 * name: Berny Perez
 * description:
 * - Defines all authentication routes for /api/auth.
 * - Public routes: signup, login, logout.
 * - Protected routes: userinfo, update-profile (require verifyToken middleware).
 */

import { Router } from "express";
import { signup, login, logout, getUserInfo, updateProfile } from "../controllers/authcontrol.js";
import { verifyToken } from "../middleware/verifyToken.js";

const authRouter = Router();

authRouter.post("/signup", signup);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/userinfo", verifyToken, getUserInfo);
authRouter.post("/update-profile", verifyToken, updateProfile);

export default authRouter;
