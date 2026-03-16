/**
 * file name: chatapp.js
 * name: Berny Perez
 * description:
 * - Configures the Express app and HTTP server.
 * - Registers middleware, mounts all API routes, and sets up Socket.IO.
 * - Exports the server instance for use in index.js.
 */

import dotenv from "dotenv";
dotenv.config(); // Must run before any process.env usage below

import { createServer } from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRouter from "./routes/authRoute.js";
import contactRouter from "./routes/contactRoute.js";
import messageRouter from "./routes/messageRoute.js";
import { setupSocket } from "./socket/socketManager.js";

const app = express();
export const server = createServer(app);

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/contacts", contactRouter);
app.use("/api/messages", messageRouter);

// Socket.IO
setupSocket(server);
