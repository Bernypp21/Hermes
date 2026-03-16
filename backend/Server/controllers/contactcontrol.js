/**
 * file name: contactcontrol.js
 * name: Berny Perez
 * description:
 * - Defines controller functions for contact-related operations.
 * - Includes searching users, retrieving all users, getting a sorted contact list,
 *   and deleting direct messages with a specific user.
 * - All routes require verifyToken middleware to populate req.userId.
 */

import mongoose from "mongoose";
import userModel from "../models/user.model.js";
import messageModel from "../models/message.model.js";

/**
 * POST /api/contacts/search
 * Searches all users (excluding self) whose firstName, lastName, or email
 * matches the given searchTerm (case-insensitive).
 * @returns 200 with contacts array | 400 missing searchTerm | 500 server error
 */
export const searchContact = async (req, res) => {
    try {
        const { searchTerm } = req.body;

        if (!searchTerm) {
            return res.status(400).json({ message: "searchTerm is required" });
        }

        const escaped = searchTerm.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        const regex = new RegExp(escaped, "i");

        const contacts = await userModel.find({
            _id: { $ne: req.userId },
            $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
        }).select("_id firstName lastName email");

        return res.status(200).json({ contacts });
    } catch (error) {
        console.error("Error in searchContact:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * GET /api/contacts/all-contacts
 * Returns all users except the authenticated user, formatted as
 * { label: "firstName lastName", value: "_id" } for use in dropdowns.
 * @returns 200 with contacts array | 500 server error
 */
export const getAllContacts = async (req, res) => {
    try {
        const users = await userModel.find({ _id: { $ne: req.userId } })
            .select("firstName lastName _id");

        const contacts = users.map((user) => ({
            label: `${user.firstName} ${user.lastName}`.trim() || "No Name",
            value: user._id.toString(),
        }));

        return res.status(200).json({ contacts });
    } catch (error) {
        console.error("Error in getAllContacts:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * GET /api/contacts/get-contacts-for-list
 * Returns all users the authenticated user has exchanged messages with,
 * sorted by the most recent message timestamp (newest first).
 * @returns 200 with contacts array | 400 missing userId | 500 server error
 */
export const getContactsForList = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(400).json({ message: "User ID not found" });
        }

        const userId = new mongoose.Types.ObjectId(req.userId);

        // Find all messages involving this user and get the latest per contact
        const messages = await messageModel.aggregate([
            {
                $match: {
                    $or: [{ sender: userId }, { recipient: userId }],
                },
            },
            {
                $sort: { timestamp: -1 },
            },
            {
                // Determine the other user in the conversation
                $project: {
                    contactId: {
                        $cond: {
                            if: { $eq: ["$sender", userId] },
                            then: "$recipient",
                            else: "$sender",
                        },
                    },
                    timestamp: 1,
                },
            },
            {
                // Keep only the latest message per contact
                $group: {
                    _id: "$contactId",
                    lastMessageTime: { $first: "$timestamp" },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "contactInfo",
                },
            },
            { $unwind: "$contactInfo" },
            {
                $project: {
                    _id: "$contactInfo._id",
                    firstName: "$contactInfo.firstName",
                    lastName: "$contactInfo.lastName",
                    email: "$contactInfo.email",
                    image: "$contactInfo.image",
                    color: "$contactInfo.color",
                    lastMessageTime: 1,
                },
            },
            { $sort: { lastMessageTime: -1 } },
        ]);

        return res.status(200).json({ contacts: messages });
    } catch (error) {
        console.error("Error in getContactsForList:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * DELETE /api/contacts/delete-dm/:dmId
 * Deletes all messages exchanged between the authenticated user and the specified user.
 * @param dmId - URL param: the other user's ID
 * @returns 200 success message | 400 invalid dmId | 500 server error
 */
export const deleteDm = async (req, res) => {
    try {
        const { dmId } = req.params;

        if (!dmId || !mongoose.Types.ObjectId.isValid(dmId)) {
            return res.status(400).json({ message: "Valid dmId is required" });
        }

        const userId = new mongoose.Types.ObjectId(req.userId);
        const contactId = new mongoose.Types.ObjectId(dmId);

        await messageModel.deleteMany({
            $or: [
                { sender: userId, recipient: contactId },
                { sender: contactId, recipient: userId },
            ],
        });

        return res.status(200).json({ message: "DM deleted successfully" });
    } catch (error) {
        console.error("Error in deleteDm:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
