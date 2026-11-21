const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');
const config = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { getPagination, formatPaginatedResponse } = require('../utils/pagination');

/**
 * Get current user profile.
 */
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json(req.user);
});

/**
 * Update current user profile.
 * Only accepts name and interests (role is never updatable here).
 */
const updateMe = asyncHandler(async (req, res) => {
  const { name, interests } = req.body;

  if (name !== undefined) {
    req.user.name = name;
  }

  if (interests !== undefined) {
    req.user.interests = interests;
  }

  await req.user.save();

  res.status(200).json(req.user);
});

/**
 * List all users (admin only).
 * Sorted by { _id: -1 }, paginated.
 */
const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [users, total] = await Promise.all([
    User.find({}).sort({ _id: -1 }).skip(skip).limit(limit),
    User.countDocuments({})
  ]);

  res.status(200).json(formatPaginatedResponse({
    data: users,
    page,
    limit,
    total
  }));
});

/**
 * Create a new user (admin only).
 * May specify role.
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, interests } = req.body;

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ error: 'Email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: role || 'user',
    interests: interests || []
  });

  res.status(201).json(user);
});

/**
 * Get user profile by ID.
 * Accessible by self or admin.
 */
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  // Self or admin check
  if (req.user._id.toString() !== id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json(user);
});

/**
 * Update user by ID (admin only).
 * Can update name, email, role, interests, and optional password.
 */
const updateUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { name, email, role, interests, password } = req.body;

  if (email !== undefined) {
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== user.email) {
      const emailExists = await User.findOne({ email: normalizedEmail });
      if (emailExists) {
        return res.status(409).json({ error: 'Email is already registered' });
      }
      user.email = normalizedEmail;
    }
  }

  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (interests !== undefined) user.interests = interests;
  if (password) {
    user.passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);
  }

  await user.save();

  res.status(200).json(user);
});

/**
 * Delete user by ID (admin only).
 * Refuses if admin tries to delete themselves.
 * Cascades deletion to that user's notes and posts.
 */
const deleteUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  // Refuse if admin attempts to delete themselves
  if (id === req.user._id.toString()) {
    return res.status(400).json({ error: 'Admin cannot delete themselves' });
  }

  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Cascade delete notes and posts
  await Promise.all([
    Note.deleteMany({ owner: id }),
    Post.deleteMany({ author: id }),
    User.findByIdAndDelete(id)
  ]);

  res.status(200).json({ message: 'User and associated data deleted successfully' });
});

/**
 * Scenario 1: Group users by interests (admin only).
 * Uses exactly ONE User.aggregate() call.
 */
const getUsersByInterests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const interest = req.query.interest ? req.query.interest.trim().toLowerCase() : null;

  const pipeline = [];
  if (interest) pipeline.push({ $match: { interests: interest } }); // uses index #2
  pipeline.push({ $unwind: '$interests' });
  if (interest) pipeline.push({ $match: { interests: interest } }); // keep only the requested group
  pipeline.push(
    {
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
        users: { $push: { _id: '$_id', name: '$name', email: '$email' } }
      }
    },
    { $sort: { _id: 1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }]
      }
    }
  );

  const [result] = await User.aggregate(pipeline);

  const rawData = result?.data ?? [];
  const data = rawData.map((item) => ({
    ...item,
    interest: item._id,
    userCount: item.count
  }));
  const total = result?.total?.[0]?.count ?? 0;

  res.status(200).json(formatPaginatedResponse({
    data,
    page,
    limit,
    total
  }));
});

/**
 * Scenario 2: Posts of a user (any authenticated user).
 * Uses a single aggregation pipeline with $lookup.
 * Fetches limit + 1 posts to compute hasMore without a second query.
 */
const getUserPosts = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let targetId;
  if (id === 'me') {
    targetId = req.user._id;
  } else if (mongoose.Types.ObjectId.isValid(id)) {
    targetId = new mongoose.Types.ObjectId(id);
  } else {
    // User-friendly author lookup by email or exact name
    const foundUser = await User.findOne({
      $or: [
        { email: id.toLowerCase().trim() },
        { name: new RegExp(`^${id.trim()}$`, 'i') }
      ]
    });
    if (!foundUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    targetId = foundUser._id;
  }

  const { page, limit, skip } = getPagination(req.query);

  const [doc] = await User.aggregate([
    { $match: { _id: targetId } }, // default _id index
    {
      $lookup: {
        from: Post.collection.name,
        localField: '_id',
        foreignField: 'author', // uses index #4
        pipeline: [
          { $sort: { _id: -1 } },
          { $skip: skip },
          { $limit: limit + 1 },
          { $project: { title: 1, content: 1, createdAt: 1 } }
        ],
        as: 'posts'
      }
    },
    { $project: { name: 1, posts: 1 } }
  ]);

  if (!doc) {
    return res.status(404).json({ error: 'User not found' });
  }

  const rawPosts = doc.posts || [];
  const hasMore = rawPosts.length > limit;
  const posts = rawPosts.slice(0, limit);

  res.status(200).json({
    _id: id,
    name: doc.name,
    posts,
    hasMore,
    data: {
      _id: id,
      name: doc.name,
      posts
    },
    pagination: {
      page,
      limit,
      hasMore
    }
  });
});

module.exports = {
  getMe,
  updateMe,
  listUsers,
  createUser,
  getUserById,
  updateUserById,
  deleteUserById,
  getUsersByInterests,
  getUserPosts
};
