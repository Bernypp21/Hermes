/**
 * file name: message.model.js
 * name: Berny Perez
 * description:
 * - Defines the Mongoose schema and model for chat messages.
 * - Each message stores the sender and recipient as references to User documents,
 *   the message content, an optional message type (default "text"), and a timestamp.
 */

import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    messageType: { type: String, default: "text" },
    timestamp: { type: Date, default: Date.now },
});

const messageModel = mongoose.model("Message", messageSchema);

export default messageModel;
