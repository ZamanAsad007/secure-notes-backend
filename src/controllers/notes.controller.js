const mongoose = require('mongoose');
const Note = require('../models/Note');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, formatPaginatedResponse } = require('../utils/pagination');

/**
 * Create a new note.
 * Owner is always forced to req.user._id.
 */
const createNote = asyncHandler(async (req, res) => {
  const { title, content } = req.body;

  const note = await Note.create({
    title,
    content,
    owner: req.user._id
  });

  res.status(201).json(note);
});

/**
 * List notes (paginated).
 * Users: own notes only.
 * Admins: all notes, with optional ?owner=<userId> filter.
 * Sorted by { _id: -1 } using index #3 or default _id index.
 */
const listNotes = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const filter = {};
  if (req.user.role === 'admin') {
    if (req.query.owner) {
      if (req.query.owner === 'me' || req.query.owner === req.user._id.toString()) {
        filter.owner = req.user._id;
      } else {
        if (!mongoose.Types.ObjectId.isValid(req.query.owner)) {
          return res.status(400).json({ error: 'Invalid owner ID format' });
        }
        filter.owner = req.query.owner;
      }
    } else if (req.query.mine === 'true') {
      filter.owner = req.user._id;
    }
  } else {
    filter.owner = req.user._id;
  }

  const [notes, total] = await Promise.all([
    Note.find(filter).sort({ _id: -1 }).skip(skip).limit(limit),
    Note.countDocuments(filter)
  ]);

  res.status(200).json(formatPaginatedResponse({
    data: notes,
    page,
    limit,
    total
  }));
});

/**
 * Get single note by ID.
 * Users: can only access their own notes (returns 404 for other notes to not leak existence).
 * Admins: can access any note.
 */
const getNoteById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid note ID format' });
  }

  const filter = { _id: id };
  if (req.user.role !== 'admin') {
    filter.owner = req.user._id;
  }

  const note = await Note.findOne(filter);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  res.status(200).json(note);
});

/**
 * Update a note.
 * Owner only (even admins cannot edit notes owned by others).
 */
const updateNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid note ID format' });
  }

  const note = await Note.findOne({ _id: id, owner: req.user._id });
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  const { title, content } = req.body;
  if (title !== undefined) note.title = title;
  if (content !== undefined) note.content = content;

  await note.save();

  res.status(200).json(note);
});

/**
 * Delete a note.
 * Owner only (even admins cannot delete notes owned by others).
 */
const deleteNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid note ID format' });
  }

  const note = await Note.findOneAndDelete({ _id: id, owner: req.user._id });
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  res.status(200).json({ message: 'Note deleted successfully' });
});

module.exports = {
  createNote,
  listNotes,
  getNoteById,
  updateNote,
  deleteNote
};
