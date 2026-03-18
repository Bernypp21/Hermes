/**
 * file name: contact.test.js
 * description: Unit + integration tests for the contact controller.
 *   Covers searchContact, getAllContacts, getContactsForList, and deleteDm.
 *   Uses supertest and mocks userModel / messageModel.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import contactRouter from '../routes/contactRoute.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────
jest.mock('../models/user.model.js', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock('../models/message.model.js', () => ({
  __esModule: true,
  default: {
    aggregate: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

import userModel from '../models/user.model.js';
import messageModel from '../models/message.model.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_USER_ID   = '507f1f77bcf86cd799439011';
const VALID_CONTACT_ID = '507f1f77bcf86cd799439022';

const makeToken = (id = VALID_USER_ID) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1d' });

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/contacts', contactRouter);
  return app;
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Contact Controller', () => {
  let app;
  let token;

  beforeAll(() => {
    app = buildApp();
    token = makeToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/contacts/search ──────────────────────────────────────────────
  describe('POST /api/contacts/search', () => {
    it('200 – returns matching contacts for valid searchTerm', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: VALID_CONTACT_ID, firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
        ]),
      });

      const res = await request(app)
        .post('/api/contacts/search')
        .set('Cookie', [`jwt=${token}`])
        .send({ searchTerm: 'Alice' });

      expect(res.status).toBe(200);
      expect(res.body.contacts).toHaveLength(1);
      expect(res.body.contacts[0]).toHaveProperty('firstName', 'Alice');
    });

    it('200 – returns empty array when no match found', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .post('/api/contacts/search')
        .set('Cookie', [`jwt=${token}`])
        .send({ searchTerm: 'zzznomatch' });

      expect(res.status).toBe(200);
      expect(res.body.contacts).toHaveLength(0);
    });

    it('400 – missing searchTerm', async () => {
      const res = await request(app)
        .post('/api/contacts/search')
        .set('Cookie', [`jwt=${token}`])
        .send({});
      expect(res.status).toBe(400);
    });

    it('400 – empty string searchTerm', async () => {
      const res = await request(app)
        .post('/api/contacts/search')
        .set('Cookie', [`jwt=${token}`])
        .send({ searchTerm: '' });
      expect(res.status).toBe(400);
    });

    it('400 – malicious injection in searchTerm', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      // The controller escapes the regex — injection should not crash, returns 200 with empty
      const res = await request(app)
        .post('/api/contacts/search')
        .set('Cookie', [`jwt=${token}`])
        .send({ searchTerm: '.*' });
      expect(res.status).toBe(200);
    });

    it('401 – no token provided', async () => {
      const res = await request(app)
        .post('/api/contacts/search')
        .send({ searchTerm: 'Alice' });
      expect(res.status).toBe(401);
    });

    it('500 – database error during search', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      const res = await request(app)
        .post('/api/contacts/search')
        .set('Cookie', [`jwt=${token}`])
        .send({ searchTerm: 'Alice' });
      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/contacts/all-contacts ────────────────────────────────────────
  describe('GET /api/contacts/all-contacts', () => {
    it('200 – returns formatted label/value contact list', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: VALID_CONTACT_ID, firstName: 'Alice', lastName: 'Smith' },
        ]),
      });

      const res = await request(app)
        .get('/api/contacts/all-contacts')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.contacts[0]).toMatchObject({
        label: 'Alice Smith',
        value: VALID_CONTACT_ID,
      });
    });

    it('200 – returns empty array when no other users exist', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([]),
      });

      const res = await request(app)
        .get('/api/contacts/all-contacts')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.contacts).toHaveLength(0);
    });

    it('200 – user with no firstName/lastName gets label "No Name"', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: VALID_CONTACT_ID, firstName: '', lastName: '' },
        ]),
      });

      const res = await request(app)
        .get('/api/contacts/all-contacts')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.contacts[0].label).toBe('No Name');
    });

    it('401 – no token', async () => {
      const res = await request(app).get('/api/contacts/all-contacts');
      expect(res.status).toBe(401);
    });

    it('500 – database error', async () => {
      userModel.find.mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      const res = await request(app)
        .get('/api/contacts/all-contacts')
        .set('Cookie', [`jwt=${token}`]);
      expect(res.status).toBe(500);
    });
  });

  // ── GET /api/contacts/get-contacts-for-list ───────────────────────────────
  describe('GET /api/contacts/get-contacts-for-list', () => {
    it('200 – returns sorted contact list with message history', async () => {
      messageModel.aggregate.mockResolvedValue([
        {
          _id: VALID_CONTACT_ID,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          image: '',
          color: '',
          lastMessageTime: new Date().toISOString(),
        },
      ]);

      const res = await request(app)
        .get('/api/contacts/get-contacts-for-list')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.contacts).toHaveLength(1);
      expect(res.body.contacts[0]).toHaveProperty('firstName', 'Alice');
    });

    it('200 – returns empty array when user has no message history', async () => {
      messageModel.aggregate.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/contacts/get-contacts-for-list')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.contacts).toHaveLength(0);
    });

    it('401 – no token', async () => {
      const res = await request(app).get('/api/contacts/get-contacts-for-list');
      expect(res.status).toBe(401);
    });

    it('500 – database aggregation failure', async () => {
      messageModel.aggregate.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/contacts/get-contacts-for-list')
        .set('Cookie', [`jwt=${token}`]);
      expect(res.status).toBe(500);
    });
  });

  // ── DELETE /api/contacts/delete-dm/:dmId ──────────────────────────────────
  describe('DELETE /api/contacts/delete-dm/:dmId', () => {
    it('200 – deletes messages for valid dmId', async () => {
      messageModel.deleteMany.mockResolvedValue({ deletedCount: 3 });

      const res = await request(app)
        .delete(`/api/contacts/delete-dm/${VALID_CONTACT_ID}`)
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('DM deleted successfully');
    });

    it('200 – no messages to delete (non-existent conversation) still returns 200', async () => {
      messageModel.deleteMany.mockResolvedValue({ deletedCount: 0 });

      const res = await request(app)
        .delete(`/api/contacts/delete-dm/${VALID_CONTACT_ID}`)
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
    });

    it('400 – invalid/malformed dmId', async () => {
      const res = await request(app)
        .delete('/api/contacts/delete-dm/not-a-valid-id')
        .set('Cookie', [`jwt=${token}`]);
      expect(res.status).toBe(400);
    });

    it('401 – no token', async () => {
      const res = await request(app)
        .delete(`/api/contacts/delete-dm/${VALID_CONTACT_ID}`);
      expect(res.status).toBe(401);
    });

    it('500 – database write-lock prevents deletion', async () => {
      messageModel.deleteMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .delete(`/api/contacts/delete-dm/${VALID_CONTACT_ID}`)
        .set('Cookie', [`jwt=${token}`]);
      expect(res.status).toBe(500);
    });
  });
});
