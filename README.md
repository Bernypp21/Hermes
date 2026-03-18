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

## Testing

Tests are written with **Jest** and **Supertest**. All database and socket dependencies are mocked — no live MongoDB connection or running server is needed to run the tests.

### How to run

```bash
cd backend/Server
npm test
```

Expected output:
```
Test Suites: 5 passed, 5 total
Tests:       73 passed, 73 total
```

### How it works

- **Models are mocked** — `userModel` and `messageModel` are replaced with `jest.fn()` stubs so tests never touch MongoDB.
- **JWT is real** — tokens are signed and verified against a fixed test secret (`test-secret-key`) set in `__tests__/setup.js`.
- **Socket tests use a real in-process server** — an HTTP server is started on a random port; `socket.io-client` connects to it so event handling is tested end-to-end without a separately running process.
- **Supertest** mounts the actual Express app, so middleware chains (including `verifyToken`) run exactly as they do in production.

---

### `__tests__/setup.js`
Runs before every test suite. Sets `process.env.JWT_SECRET = 'test-secret-key'` and `NODE_ENV = 'test'` so token signing and verification work consistently without a `.env` file.

---

### `__tests__/auth.test.js` — 26 tests
Tests the full auth lifecycle via Supertest against a minimal Express app with `userModel` mocked.

**POST `/api/auth/signup`** (9 tests)
| Scenario | Expected |
|---|---|
| Valid email + password | 201, user in body, `set-cookie` header present |
| Missing email | 400 |
| Missing password | 400 |
| Invalid email format | 400 |
| Password shorter than 8 chars | 400 |
| Non-string email (integer) | 400 |
| NoSQL injection attempt in email field | 400 |
| Email already in use | 409 |
| DB throws during `create` | 500 |

**POST `/api/auth/login`** (8 tests)
| Scenario | Expected |
|---|---|
| Valid credentials | 200, user in body |
| Missing email | 400 |
| Missing password | 400 |
| Invalid email format | 400 |
| Wrong password | 400 |
| Injection attempt in email field | 400 |
| User not found in DB | 404 |
| DB disconnects during `findOne` | 500 |

**POST `/api/auth/logout`** (1 test)
| Scenario | Expected |
|---|---|
| Any request | 200, clears JWT cookie, `"Logged out successfully"` message |

**GET `/api/auth/userinfo`** (5 tests)
| Scenario | Expected |
|---|---|
| No token | 401 |
| Malformed token | 401 |
| Valid token, user exists | 200, full user object |
| Valid token, user deleted from DB | 404 |
| Valid token, DB timeout | 500 |

**POST `/api/auth/update-profile`** (8 tests — requires valid token for all non-401 cases)
| Scenario | Expected |
|---|---|
| No token | 401 |
| Valid `firstName`, `lastName`, `color` | 200, updated user in body |
| Valid `firstName` and `lastName` (color omitted) | 200 |
| Missing `firstName` | 400 |
| Missing `lastName` | 400 |
| Empty strings for both fields | 400 |
| XSS injection attempt in name fields | 400 |
| DB write error | 500 |

---

### `__tests__/contact.test.js` — 19 tests
Tests contact search and DM management via Supertest with `userModel` and `messageModel` mocked.

**POST `/api/contacts/search`** (7 tests)
| Scenario | Expected |
|---|---|
| Valid `searchTerm` with results | 200, matching contacts array |
| Valid `searchTerm`, no match | 200, empty array |
| Missing `searchTerm` | 400 |
| Empty string `searchTerm` | 400 |
| Regex injection in `searchTerm` (e.g. `.*`) | 200 — controller escapes the regex, returns empty safely |
| No token | 401 |
| DB error during search | 500 |

**GET `/api/contacts/all-contacts`** (5 tests)
| Scenario | Expected |
|---|---|
| Other users exist | 200, `{ label: "First Last", value: id }` format |
| No other users in DB | 200, empty array |
| User with no name → label `"No Name"` | 200 |
| No token | 401 |
| DB error | 500 |

**GET `/api/contacts/get-contacts-for-list`** (4 tests)
| Scenario | Expected |
|---|---|
| User has message history | 200, contacts sorted by latest message |
| No message history | 200, empty array |
| No token | 401 |
| DB aggregation failure | 500 |

**DELETE `/api/contacts/delete-dm/:dmId`** (5 tests)
| Scenario | Expected |
|---|---|
| Valid `dmId`, messages deleted | 200, `"DM deleted successfully"` |
| Valid `dmId`, nothing to delete | 200 |
| Malformed `dmId` | 400 |
| No token | 401 |
| DB write error | 500 |

---

### `__tests__/message.test.js` — 8 tests
Tests `getMessages` via Supertest with `messageModel` mocked. The `find()` mock must replicate the full `find().sort().populate().populate()` chain used in the controller.

| Scenario | Expected |
|---|---|
| Valid user + contact IDs, messages exist | 200, array with populated message objects |
| Valid IDs, no messages between users | 200, empty array |
| Missing contact ID in body | 400 |
| Invalid ObjectId format for contact ID | 400 |
| Integer ID (`mongoose.isValid` returns `true` for integers) | 200 — noted as a known edge case |
| No token | 401 |
| Malformed token | 401 |
| DB query timeout | 500 |

---

### `__tests__/verifyToken.test.js` — 5 tests
Unit tests the middleware directly — no HTTP layer. Calls `verifyToken(req, res, next)` with hand-crafted mock objects.

| Scenario | Expected |
|---|---|
| Cookie absent (undefined) | 401, `"No token"` message, `next` not called |
| Malformed token string | 401, `next` not called |
| Expired token (`expiresIn: '-1s'`) | 401, `next` not called |
| Token signed with wrong secret | 401, `next` not called |
| Valid token | `next()` called, `req.userId` set to the decoded ID |

---

### `__tests__/socket.test.js` — 9 tests
Integration tests for `socketManager.js`. A real HTTP server is started on a random port (`httpServer.listen(0)`); `socket.io-client` connects to it so the full Socket.IO event pipeline runs. `messageModel.create` and `messageModel.findById` are mocked.

| Scenario | Expected |
|---|---|
| Client connects with a `userId` | `client.connected === true`, userId registered in socket map |
| Client connects without a `userId` (anonymous) | `client.connected === true` |
| `sendMessage` with missing `recipient` and `content` | Server emits `error` event with `/required/i` message |
| `sendMessage` with missing `content` | Server emits `error` event with `/required/i` message |
| Valid `sendMessage`, recipient offline | `receiveMessage` emitted to sender; message saved to DB |
| Valid `sendMessage`, both clients connected | `receiveMessage` emitted to both sender and recipient |
| Valid `sendMessage`, recipient offline (DB persistence check) | `messageModel.create` called with correct payload |
| Client disconnects | `client.connected === false`, userId removed from socket map |

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
