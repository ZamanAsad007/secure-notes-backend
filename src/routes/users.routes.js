const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getMe,
  updateMe,
  listUsers,
  createUser,
  getUserById,
  updateUserById,
  deleteUserById,
  getUsersByInterests,
  getUserPosts
} = require('../controllers/users.controller');

const router = express.Router();

const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name cannot exceed 100 characters').optional(),
    interests: z.array(z.string()).optional()
  })
  .refine((data) => data.name !== undefined || data.interests !== undefined, {
    message: 'At least one field (name or interests) must be provided'
  });

const createUserSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters'),
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' }).min(8, 'Password must be at least 8 characters').max(72, 'Password cannot exceed 72 characters'),
  role: z.enum(['user', 'admin']).optional(),
  interests: z.array(z.string()).optional()
});

const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name cannot exceed 100 characters').optional(),
    email: z.string().trim().email('Invalid email address').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password cannot exceed 72 characters').optional(),
    role: z.enum(['user', 'admin']).optional(),
    interests: z.array(z.string()).optional()
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.password !== undefined ||
      data.role !== undefined ||
      data.interests !== undefined,
    {
      message: 'At least one field must be provided for update'
    }
  );

// All user routes require authentication
router.use(authenticate);

// Profile routes (declared before /:id)
router.get('/me', getMe);
router.patch('/me', validate(updateMeSchema), updateMe);

// Scenario 1: Users grouped by interests (admin only, declared before /:id)
router.get('/by-interests', authorize('admin'), getUsersByInterests);

// Admin-only list and create
router.get('/', authorize('admin'), listUsers);
router.post('/', authorize('admin'), validate(createUserSchema), createUser);

// Scenario 2: Posts of a user (any authenticated user, declared before /:id)
router.get('/:id/posts', getUserPosts);

// Parameterized routes
router.get('/:id', getUserById);
router.patch('/:id', authorize('admin'), validate(updateUserSchema), updateUserById);
router.delete('/:id', authorize('admin'), deleteUserById);

module.exports = router;
