const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Signs a JWT token with user id (sub) and role.
 *
 * @param {object} user - User document or object with _id and role
 * @returns {string} Signed JWT
 */
const signToken = (user) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: config.JWT_EXPIRES_IN
    }
  );
};

/**
 * Verifies a JWT token, strictly pinning HS256 algorithm.
 *
 * @param {string} token
 * @returns {object} Decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET, {
    algorithms: ['HS256']
  });
};

module.exports = {
  signToken,
  verifyToken
};
