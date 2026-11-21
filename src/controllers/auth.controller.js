const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const config = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Register a new user.
 * Role is always forced to 'user'.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, interests } = req.body;

  // Check if email already registered to provide clean 409 before hashing
  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'user', // Forced to 'user'
    interests: interests || []
  });

  const token = signToken(user);

  res.status(201).json({
    token,
    user
  });
});

/**
 * Login user.
 * Returns identical 401 error message for unknown email or wrong password.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);

  res.status(200).json({
    token,
    user
  });
});

module.exports = {
  register,
  login
};
