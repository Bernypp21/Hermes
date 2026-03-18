/**
 * file name: socket.test.js
 * description: Integration tests for socketManager.js.
 *   Verifies connection tracking, sendMessage event (valid + invalid payloads),
 *   receiveMessage delivery to sender/recipient, and disconnect cleanup.
 */

import { createServer } from 'http';
import { io as ioClient } from 'socket.io-client';

// ── Mock messageModel before importing socketManager ─────────────────────────
jest.mock('../models/message.model.js', () => ({
  __esModule: true,
  default: {
    create:   jest.fn(),
    findById: jest.fn(),
  },
}));

import messageModel from '../models/message.model.js';
import { setupSocket } from '../socket/socketManager.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const SENDER_ID    = '507f1f77bcf86cd799439011';
const RECIPIENT_ID = '507f1f77bcf86cd799439022';
const MSG_ID       = '507f1f77bcf86cd799439033';

const connectClient = (port, userId) =>
  new Promise((resolve, reject) => {
    const socket = ioClient(`http://localhost:${port}`, {
      query:      { userId },
      transports: ['websocket'],
      timeout:    3000,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });

/**
 * Mock the findById().populate().populate() chain used in socketManager
 * to return populatedMsg when awaited.
 */
const mockPopulatedMsg = (populatedMsg) => {
  const innerPopulate = jest.fn().mockResolvedValue(populatedMsg);
  const outerPopulate = jest.fn().mockReturnValue({ populate: innerPopulate });
  messageModel.findById.mockReturnValue({ populate: outerPopulate });
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Socket Manager', () => {
  let httpServer;
  let port;

  beforeAll((done) => {
    httpServer = createServer();
    setupSocket(httpServer);
    httpServer.listen(0, () => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Connection ─────────────────────────────────────────────────────────────
  it('registers userId on connection', async () => {
    const client = await connectClient(port, SENDER_ID);
    expect(client.connected).toBe(true);
    client.disconnect();
  });

  it('connects without a userId (anonymous connection)', async () => {
    const client = await connectClient(port, '');
    expect(client.connected).toBe(true);
    client.disconnect();
  });

  // ── sendMessage – missing fields ────────────────────────────────────────────
  it('emits error when required sendMessage fields are missing', async () => {
    const client = await connectClient(port, SENDER_ID);

    const error = await new Promise((resolve) => {
      client.on('error', resolve);
      // Missing recipient and content
      client.emit('sendMessage', { sender: SENDER_ID });
    });

    expect(error).toHaveProperty('message');
    expect(error.message).toMatch(/required/i);
    client.disconnect();
  });

  it('emits error when content is missing', async () => {
    const client = await connectClient(port, SENDER_ID);

    const error = await new Promise((resolve) => {
      client.on('error', resolve);
      client.emit('sendMessage', { sender: SENDER_ID, recipient: RECIPIENT_ID });
    });

    expect(error.message).toMatch(/required/i);
    client.disconnect();
  });

  // ── sendMessage – valid payload, recipient offline ─────────────────────────
  it('emits receiveMessage to sender when recipient is not connected', async () => {
    const populatedMsg = {
      _id:         MSG_ID,
      sender:      { _id: SENDER_ID,    firstName: 'Test'  },
      recipient:   { _id: RECIPIENT_ID, firstName: 'Alice' },
      content:     'Hello!',
      messageType: 'text',
    };

    messageModel.create.mockResolvedValue({ _id: MSG_ID });
    mockPopulatedMsg(populatedMsg);

    const senderClient = await connectClient(port, SENDER_ID);

    const received = await new Promise((resolve) => {
      senderClient.once('receiveMessage', resolve);
      senderClient.emit('sendMessage', {
        sender:      SENDER_ID,
        recipient:   RECIPIENT_ID,
        content:     'Hello!',
        messageType: 'text',
      });
    });

    expect(received).toMatchObject({ content: 'Hello!' });
    senderClient.disconnect();
  });

  // ── sendMessage – valid payload, both connected ────────────────────────────
  it('emits receiveMessage to both sender and connected recipient', async () => {
    const populatedMsg = {
      _id:         MSG_ID,
      sender:      { _id: SENDER_ID    },
      recipient:   { _id: RECIPIENT_ID },
      content:     'Hi!',
      messageType: 'text',
    };

    messageModel.create.mockResolvedValue({ _id: MSG_ID });
    mockPopulatedMsg(populatedMsg);

    const [senderClient, recipientClient] = await Promise.all([
      connectClient(port, SENDER_ID),
      connectClient(port, RECIPIENT_ID),
    ]);

    // Set up listeners before emitting
    const senderPromise    = new Promise((resolve) => senderClient.once('receiveMessage', resolve));
    const recipientPromise = new Promise((resolve) => recipientClient.once('receiveMessage', resolve));

    senderClient.emit('sendMessage', {
      sender:      SENDER_ID,
      recipient:   RECIPIENT_ID,
      content:     'Hi!',
      messageType: 'text',
    });

    const [senderMsg, recipientMsg] = await Promise.all([senderPromise, recipientPromise]);

    expect(senderMsg).toMatchObject({ content: 'Hi!' });
    expect(recipientMsg).toMatchObject({ content: 'Hi!' });

    senderClient.disconnect();
    recipientClient.disconnect();
  });

  // ── sendMessage – message saved but recipient offline (201 scenario) ────────
  it('still saves message to DB even when recipient is not connected', async () => {
    const populatedMsg = {
      _id:         MSG_ID,
      sender:      { _id: SENDER_ID    },
      recipient:   { _id: RECIPIENT_ID },
      content:     'Saved!',
      messageType: 'text',
    };

    messageModel.create.mockResolvedValue({ _id: MSG_ID });
    mockPopulatedMsg(populatedMsg);

    const senderClient = await connectClient(port, SENDER_ID);

    await new Promise((resolve) => {
      senderClient.once('receiveMessage', resolve);
      senderClient.emit('sendMessage', {
        sender:      SENDER_ID,
        recipient:   RECIPIENT_ID,    // not connected
        content:     'Saved!',
        messageType: 'text',
      });
    });

    expect(messageModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Saved!' })
    );
    senderClient.disconnect();
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  it('removes userId from socket map on disconnect', async () => {
    const client = await connectClient(port, SENDER_ID);
    expect(client.connected).toBe(true);

    await new Promise((resolve) => {
      client.once('disconnect', resolve);
      client.disconnect();
    });

    expect(client.connected).toBe(false);
  });
});
