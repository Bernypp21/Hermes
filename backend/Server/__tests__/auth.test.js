/**
 * file name: auth.test.js
 * description: Unit + integration tests for the auth controller.
 *   Covers signup, login, logout, getUserInfo, and updateProfile.
 *   Uses supertest against a minimal Express app and mocks userModel.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import authRouter from '../routes/authRoute.js';

// ── Mock userModel ────────────────────────────────────────────────────────────
jest.mock('../models/user.model.js', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

import userModel from '../models/user.model.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_USER_ID = '507f1f77bcf86cd799439011';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  return app;
};

const makeToken = (id = VALID_USER_ID) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1d' });

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Auth Controller', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── POST /api/auth/signup ──────────────────────────────────────────────────
  describe('POST /api/auth/signup', () => {
    it('201 – creates user with valid email and password', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockResolvedValue({
        _id: VALID_USER_ID,
        email: 'test@example.com',
        firstName: '',
        lastName: '',
        image: '',
        profileSetup: false,
      });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('email', 'test@example.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('400 – missing email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('400 – missing password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('400 – invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('400 – password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'short' });
      expect(res.status).toBe(400);
    });

    it('400 – non-string email (wrong data type)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 12345, password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('400 – malicious injection attempt in email field', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: '{ $gt: "" }', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('409 – email already in use', async () => {
      userModel.findOne.mockResolvedValue({ email: 'test@example.com' });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(409);
    });

    it('500 – database throws during create', async () => {
      userModel.findOne.mockResolvedValue(null);
      userModel.create.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/auth/login ───────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    let hashedPassword;

    beforeAll(async () => {
      const bcrypt = await import('bcrypt');
      hashedPassword = await bcrypt.hash('password123', 10);
    });

    const mockUser = () =>
      userModel.findOne.mockResolvedValue({
        _id: VALID_USER_ID,
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        image: '',
        profileSetup: true,
      });

    it('200 – valid email and password', async () => {
      mockUser();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('email', 'test@example.com');
    });

    it('400 – missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('400 – missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('400 – invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'bad-email', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('400 – wrong password', async () => {
      mockUser();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });
      expect(res.status).toBe(400);
    });

    it('400 – malicious injection attempt in email field', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '{ $gt: "" }', password: 'password123' });
      expect(res.status).toBe(400);
    });

    it('404 – user not found in database', async () => {
      userModel.findOne.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'noone@example.com', password: 'password123' });
      expect(res.status).toBe(404);
    });

    it('500 – database disconnects', async () => {
      userModel.findOne.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/auth/logout ──────────────────────────────────────────────────
  describe('POST /api/auth/logout', () => {
    it('200 – clears jwt cookie and returns success message', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
    });
  });

  // ── GET /api/auth/userinfo ─────────────────────────────────────────────────
  describe('GET /api/auth/userinfo', () => {
    it('401 – no token provided', async () => {
      const res = await request(app).get('/api/auth/userinfo');
      expect(res.status).toBe(401);
    });

    it('401 – invalid/malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/userinfo')
        .set('Cookie', ['jwt=invalidtoken']);
      expect(res.status).toBe(401);
    });

    it('200 – returns user data with valid token', async () => {
      userModel.findById.mockResolvedValue({
        _id: VALID_USER_ID,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        image: '',
        profileSetup: true,
        color: 'blue',
      });

      const res = await request(app)
        .get('/api/auth/userinfo')
        .set('Cookie', [`jwt=${makeToken()}`]);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'test@example.com');
    });

    it('404 – valid token but user deleted from DB', async () => {
      userModel.findById.mockResolvedValue(null);
      const res = await request(app)
        .get('/api/auth/userinfo')
        .set('Cookie', [`jwt=${makeToken()}`]);
      expect(res.status).toBe(404);
    });

    it('500 – database connection timeout', async () => {
      userModel.findById.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .get('/api/auth/userinfo')
        .set('Cookie', [`jwt=${makeToken()}`]);
      expect(res.status).toBe(500);
    });
  });

  // ── POST /api/auth/update-profile ─────────────────────────────────────────
  describe('POST /api/auth/update-profile', () => {
    it('401 – no token', async () => {
      const res = await request(app)
        .post('/api/auth/update-profile')
        .send({ firstName: 'John', lastName: 'Doe' });
      expect(res.status).toBe(401);
    });

    it('200 – valid firstName, lastName, and color', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue({
        _id: VALID_USER_ID,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        image: '',
        profileSetup: true,
        color: 'red',
      });

      const res = await request(app)
        .post('/api/auth/update-profile')
        .set('Cookie', [`jwt=${makeToken()}`])
        .send({ firstName: 'John', lastName: 'Doe', color: 'red' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('firstName', 'John');
      expect(res.body).toHaveProperty('profileSetup', true);
    });

    it('200 – valid firstName and lastName (color omitted)', async () => {
      userModel.findByIdAndUpdate.mockResolvedValue({
        _id: VALID_USER_ID,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        image: '',
        profileSetup: true,
        color: '',
      });

      const res = await request(app)
        .post('/api/auth/update-profile')
        .set('Cookie', [`jwt=${makeToken()}`])
        .send({ firstName: 'John', lastName: 'Doe' });
      expect(res.status).toBe(200);
    });

    it('400 – missing firstName', async () => {
      const res = await request(app)
        .post('/api/auth/update-profile')
        .set('Cookie', [`jwt=${makeToken()}`])
        .send({ lastName: 'Doe' });
      expect(res.status).toBe(400);
    });

    it('400 – missing lastName', async () => {
      const res = await request(app)
        .post('/api/auth/update-profile')
        .set('Cookie', [`jwt=${makeToken()}`])
        .send({ firstName: 'John' });
      expect(res.status).toBe(400);
    });

    it('400 – empty strings for required fields', async () => {
      const res = await request(app)
        .post('/api/auth/update-profile')
        .set('Cookie', [`jwt=${makeToken()}`])
        .send({ firstName: '', lastName: '' });
      expect(res.status).toBe(400);
    });

    it('400 – malicious XSS injection attempt in name fields', async () => {
      const res = await request(app)
        .post('/api/auth/update-profile')
        .set('Cookie', [`jwt=${makeToken()}`])
        .send({ firstName: '<script>alert(1)</script>', lastName: '' });
      expect(res.status).toBe(400);
    });

    it('500 – database write error', async () => {
      userModel.findByIdAndUpdate.mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .post('/api/auth/update-profile')
        .set('Cookie', [`jwt=${makeToken()}`])
        .send({ firstName: 'John', lastName: 'Doe' });
      expect(res.status).toBe(500);
    });
  });
});
