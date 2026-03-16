/**
 * file name: socketManager.js
 * name: Berny Perez
 * description:
 * - Sets up Socket.IO for real-time direct messaging.
 * - Maintains a map of userId → socketId so the server knows which socket
 *   belongs to which authenticated user.
 * - Listens for "sendMessage" from the client, saves the message to the database,
 *   and emits "receiveMessage" to both the sender and recipient.
 * - Cleans up the user map on disconnect.
 */

import { Server as SocketIOServer } from "socket.io";
import messageModel from "../models/message.model.js";

// Maps userId (string) → socketId so we can target specific users
const userSocketMap = {};

const getSocketId = (userId) => userSocketMap[userId];

export const setupSocket = (server) => {
    const io = new SocketIOServer(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        const userId = socket.handshake.query.userId;

        if (userId) {
            userSocketMap[userId] = socket.id;
            console.log(`User connected: userId=${userId} socketId=${socket.id}`);
        }

        /**
         * Event: "sendMessage"
         * Emitted by the client to send a direct message.
         * Payload: { sender, recipient, content, messageType }
         *
         * Saves the message to the DB, then emits "receiveMessage"
         * to both the sender and recipient sockets.
         */
        socket.on("sendMessage", async ({ sender, recipient, content, messageType }) => {
            if (!sender || !recipient || !content) {
                socket.emit("error", { message: "sender, recipient, and content are required" });
                return;
            }

            try {
                const newMessage = await messageModel.create({
                    sender,
                    recipient,
                    content,
                    messageType: messageType || "text",
                });

                // Populate sender and recipient with full user info for the response
                const populatedMessage = await messageModel
                    .findById(newMessage._id)
                    .populate("sender", "_id firstName lastName email image color")
                    .populate("recipient", "_id firstName lastName email image color");

                /**
                 * Event: "receiveMessage"
                 * Emitted by the server to both sender and recipient.
                 * Payload: { id, sender, recipient, content, messageType, timestamp }
                 */
                const senderSocketId = getSocketId(sender);
                const recipientSocketId = getSocketId(recipient);

                if (senderSocketId) {
                    io.to(senderSocketId).emit("receiveMessage", populatedMessage);
                }
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit("receiveMessage", populatedMessage);
                }
            } catch (error) {
                console.error("Error handling sendMessage:", error);
            }
        });

        // Remove user from map when they disconnect
        socket.on("disconnect", () => {
            console.log(`User disconnected: userId=${userId} socketId=${socket.id}`);
            if (userId) {
                delete userSocketMap[userId];
            }
        });
    });

    return io;
};
