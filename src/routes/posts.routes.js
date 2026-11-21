const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { createPost, getAuthors } = require('../controllers/posts.controller');

const router = express.Router();

const createPostSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title cannot exceed 200 characters'),
  content: z
    .string({ required_error: 'Content is required' })
    .min(1, 'Content cannot be empty')
    .max(10000, 'Content cannot exceed 10000 characters')
});

router.use(authenticate);

router.get('/authors', getAuthors);
router.post('/', validate(createPostSchema), createPost);

module.exports = router;
