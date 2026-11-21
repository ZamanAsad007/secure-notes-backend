const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const {
  createNote,
  listNotes,
  getNoteById,
  updateNote,
  deleteNote
} = require('../controllers/notes.controller');

const router = express.Router();

const createNoteSchema = z.object({
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

const updateNoteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title cannot exceed 200 characters')
      .optional(),
    content: z
      .string()
      .min(1, 'Content cannot be empty')
      .max(10000, 'Content cannot exceed 10000 characters')
      .optional()
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'At least one field (title or content) must be provided to update'
  });

// All notes endpoints require authentication
router.use(authenticate);

router.post('/', validate(createNoteSchema), createNote);
router.get('/', listNotes);
router.get('/:id', getNoteById);
router.patch('/:id', validate(updateNoteSchema), updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
