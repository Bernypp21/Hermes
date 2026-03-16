/**
 * file name: index.js
 * name: Berny Perez
 * description:
 * - Entry point for the Hermes server.
 * - Connects to MongoDB, starts the HTTP server, and handles startup errors.
 * - Imports the configured Express app and Socket.IO setup from chatapp.js.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { server } from "./chatapp.js";

dotenv.config();

const port = process.env.PORT || 3000;

mongoose
    .connect(process.env.MONGO_URL)
    .then(() => {
        console.log("Connected to MongoDB");
        server.listen(port, () => {
            console.log(`Hermes is listening on port ${port}`);
        });
    })
    .catch((error) => {
        console.error("Failed to connect to MongoDB:", error.message);
        process.exit(1);
    });

// Handle unexpected errors so the process doesn't silently crash
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
    process.exit(1);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error.message);
    process.exit(1);
});
