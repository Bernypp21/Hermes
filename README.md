# Hermes

Chat application built for CS 314 Elements of Software Engineering at PSU. The backend server and all its components were fully developed by Berny Perez. The frontend was provided by the TA.

---

## Tech Stack (MERN)

| Technology | Role |
|---|---|
| **MongoDB** | Database — stores users and messages |
| **Express** | Web framework — handles HTTP routing and middleware |
| **React** | Frontend UI (provided by TA) |
| **Node.js** | Runtime environment for the server |
| **Socket.IO** | Real-time bidirectional messaging |

---

## Project Structure

```
backend/Server/
├── index.js                  # Entry point — connects to DB and starts server
├── chatapp.js                # App config — registers middleware, routes, and Socket.IO
├── .env                      # Environment variables (not committed)
├── models/
│   ├── user.model.js         # Mongoose schema for users
│   └── message.model.js      # Mongoose schema for messages
├── controllers/
│   ├── authcontrol.js        # Signup, login, logout, userinfo, update-profile logic
│   ├── contactcontrol.js     # Search, list, and delete contact/DM logic
│   └── messagecontrol.js     # Get message history logic
├── routes/
│   ├── authRoute.js          # /api/auth routes
│   ├── contactRoute.js       # /api/contacts routes
│   └── messageRoute.js       # /api/messages routes
├── middleware/
│   └── verifyToken.js        # JWT cookie validation middleware
└── socket/
    └── socketManager.js      # Socket.IO setup and real-time message handling
```

---

## Backend Components

### `index.js` — Server Entry Point
Connects to MongoDB using Mongoose. If the connection succeeds, starts the HTTP server on the configured port. Registers global error handlers for unhandled promise rejections and uncaught exceptions so the process exits cleanly instead of hanging silently.

### `chatapp.js` — App Configuration
Creates the Express app and HTTP server. Registers CORS, JSON body parsing, and cookie parsing middleware. Mounts the three API routers and initializes Socket.IO. Exports the `server` instance for `index.js` to start.

### `models/user.model.js` — User Schema
Defines the MongoDB schema for a user:
- `email` — unique, required
- `password` — bcrypt-hashed, required
- `firstName`, `lastName` — default empty string
- `image` — profile picture URL, default empty string
- `profileSetup` — boolean, set to `true` after first profile update
- `color` — user-chosen accent color

### `models/message.model.js` — Message Schema
Defines the MongoDB schema for a message:
- `sender` — ObjectId reference to User, required
- `recipient` — ObjectId reference to User, required
- `content` — message text, required
- `messageType` — defaults to `"text"`
- `timestamp` — defaults to current time

### `controllers/authcontrol.js` — Authentication Logic
Handles all auth operations. On signup/login, a JWT is signed and stored as an HTTP-only cookie (1 day expiry). Protected routes require the `verifyToken` middleware.

| Function | Route | Auth |
|---|---|---|
| `signup` | POST `/api/auth/signup` | Public |
| `login` | POST `/api/auth/login` | Public |
| `logout` | POST `/api/auth/logout` | Public |
| `getUserInfo` | GET `/api/auth/userinfo` | Protected |
| `updateProfile` | POST `/api/auth/update-profile` | Protected |

### `controllers/contactcontrol.js` — Contact Logic
Handles searching users and managing direct message lists.

| Function | Route | Description |
|---|---|---|
| `searchContact` | POST `/api/contacts/search` | Search users by name or email |
| `getAllContacts` | GET `/api/contacts/all-contacts` | Get all users except self |
| `getContactsForList` | GET `/api/contacts/get-contacts-for-list` | Get past conversations sorted by latest message |
| `deleteDm` | DELETE `/api/contacts/delete-dm/:dmId` | Delete all messages with a user |

### `controllers/messagecontrol.js` — Message Logic
Retrieves the full message history between two users, sorted oldest to newest. Both sender and recipient are populated with user info.

| Function | Route | Description |
|---|---|---|
| `getMessages` | POST `/api/messages/get-messages` | Get all messages between current user and a contact |

### `middleware/verifyToken.js` — JWT Middleware
Reads the `jwt` cookie from the request, verifies it with `JWT_SECRET`, and attaches the decoded `userId` to `req.userId`. Returns `401` if the token is missing or invalid. Applied to all protected routes.

### `socket/socketManager.js` — Real-Time Messaging
Initializes a Socket.IO server attached to the HTTP server. Maintains a `userId → socketId` map so the server can target specific connected users.

| Event | Direction | Description |
|---|---|---|
| `sendMessage` | Client → Server | Client sends `{ sender, recipient, content, messageType }` |
| `receiveMessage` | Server → Client | Server emits the saved message to both sender and recipient |

---

## API Endpoints

### Auth — `/api/auth`
| Method | Endpoint | Body | Auth |
|---|---|---|---|
| POST | `/signup` | `{ email, password }` | No |
| POST | `/login` | `{ email, password }` | No |
| POST | `/logout` | — | No |
| GET | `/userinfo` | — | Cookie |
| POST | `/update-profile` | `{ firstName, lastName, color? }` | Cookie |

### Contacts — `/api/contacts`
| Method | Endpoint | Body / Param | Auth |
|---|---|---|---|
| POST | `/search` | `{ searchTerm }` | Cookie |
| GET | `/all-contacts` | — | Cookie |
| GET | `/get-contacts-for-list` | — | Cookie |
| DELETE | `/delete-dm/:dmId` | `:dmId` in URL | Cookie |

### Messages — `/api/messages`
| Method | Endpoint | Body | Auth |
|---|---|---|---|
| POST | `/get-messages` | `{ id: contactorId }` | Cookie |

---

## Setup — Starting the Backend

### 1. Prerequisites
- Node.js v18 or higher
- A MongoDB Atlas account (or local MongoDB)

### 2. Install dependencies
```bash
cd backend/Server
npm install
```

### 3. Configure environment variables
Create a `.env` file inside `backend/Server/` with the following:
```
MONGO_URL=your_mongodb_connection_string
JWT_SECRET=your_secret_key
FRONTEND_URL=http://localhost:5173
PORT=3000
```

### 4. Start the server
```bash
npm start
```
The server will connect to MongoDB and begin listening on port `3000` (or the value of `PORT`).

---

## Connecting the Frontend

The frontend (provided by TA) must be configured to point to the backend server. Below are the required settings.

### Axios configuration
```js
import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true,
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});
```

### Socket.IO configuration
```js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  withCredentials: true,
  query: { userId: "<current-user-id>" },
  extraHeaders: {
    "ngrok-skip-browser-warning": "true",
  },
});
```

> **Note:** Replace `http://localhost:3000` with your Ngrok URL when testing remotely. The `ngrok-skip-browser-warning` header is required to bypass the Ngrok browser warning page.

### Running both together (local development)
1. Start the backend: `npm start` inside `backend/Server/`
2. Start the frontend: `npm run dev` inside the frontend directory (runs on `http://localhost:5173`)
3. The backend CORS is pre-configured to accept requests from `http://localhost:5173`
