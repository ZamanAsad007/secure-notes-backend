const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { register, login } = require('../controllers/auth.controller');

const router = express.Router();

const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' }).min(8, 'Password must be at least 8 characters').max(72, 'Password cannot exceed 72 characters'),
  interests: z.array(z.string()).optional()
});

const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required')
});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

module.exports = router;
