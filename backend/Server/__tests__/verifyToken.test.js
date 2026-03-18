/**
 * file name: verifyToken.test.js
 * description: Unit tests for the verifyToken middleware.
 *   Tests all token validation paths: missing, malformed, expired,
 *   wrong secret, and valid token with userId extraction.
 */

import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/verifyToken.js';

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_USER_ID = '507f1f77bcf86cd799439011';

const buildMocks = (cookieJwt) => {
  const req  = { cookies: { jwt: cookieJwt } };
  const res  = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('verifyToken Middleware', () => {
  it('401 – no token provided (cookie absent)', () => {
    const { req, res, next } = buildMocks(undefined);
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('No token') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('401 – malformed token string', () => {
    const { req, res, next } = buildMocks('this.is.not.valid');
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 – expired token', () => {
    const expired = jwt.sign(
      { id: VALID_USER_ID },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }    // already expired
    );
    const { req, res, next } = buildMocks(expired);
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('401 – token signed with wrong secret', () => {
    const wrongToken = jwt.sign(
      { id: VALID_USER_ID },
      'wrong-secret',
      { expiresIn: '1d' }
    );
    const { req, res, next } = buildMocks(wrongToken);
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through and attaches userId to req with valid token', () => {
    const valid = jwt.sign(
      { id: VALID_USER_ID },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    const { req, res, next } = buildMocks(valid);
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe(VALID_USER_ID);
    expect(res.status).not.toHaveBeenCalled();
  });
});
