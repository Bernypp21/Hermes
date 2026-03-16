/**
 * file name: messageRoute.js
 * name: Berny Perez
 * description:
 * - Defines all message routes for /api/messages.
 * - All routes are protected and require verifyToken middleware.
 */

import { Router } from "express";
import { getMessages } from "../controllers/messagecontrol.js";
import { verifyToken } from "../middleware/verifyToken.js";

const messageRouter = Router();

messageRouter.post("/get-messages", verifyToken, getMessages);

export default messageRouter;
