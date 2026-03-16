/**
 * file name: messagecontrol.js
 * name: Berny Perez
 * description:
 * - Defines controller functions for message-related operations.
 * - Includes retrieving message history between two users.
 * - All routes require verifyToken middleware to populate req.userId.
 */

import messageModel from "../models/message.model.js";
import mongoose from "mongoose";

/**
 * POST /api/messages/get-messages
 * Returns all messages exchanged between the authenticated user and the specified contact,
 * sorted oldest to newest. Populates sender and recipient with user info.
 * @body { id: contactorId } - the other user's ID
 * @returns 200 with messages array | 400 missing IDs | 500 server error
 */
export const getMessages = async (req, res) => {
    try {
        const { id: contactorId } = req.body;
        const userId = req.userId;

        if (!contactorId || !userId) {
            return res.status(400).json({ message: "User ID and contactor ID are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(contactorId)) {
            return res.status(400).json({ message: "Invalid contactor ID" });
        }

        const messages = await messageModel.find({
            $or: [
                { sender: userId, recipient: contactorId },
                { sender: contactorId, recipient: userId },
            ],
        })
            .sort({ timestamp: 1 })
            .populate("sender", "_id firstName lastName email image color")
            .populate("recipient", "_id firstName lastName email image color");

        return res.status(200).json({ messages });
    } catch (error) {
        console.error("Error in getMessages:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
