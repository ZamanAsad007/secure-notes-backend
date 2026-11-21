const Post = require('../models/Post');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Create a new post.
 * Author is forced to req.user._id.
 */
const createPost = asyncHandler(async (req, res) => {
  const { title, content } = req.body;

  const post = await Post.create({
    author: req.user._id,
    title,
    content
  });

  res.status(201).json(post);
});

/**
 * Get active community authors for quick selection and discovery.
 * Available to all authenticated users.
 */
const getAuthors = asyncHandler(async (req, res) => {
  const authorsAggregate = await Post.aggregate([
    {
      $group: {
        _id: '$author',
        postCount: { $sum: 1 },
        latestPostAt: { $max: '$createdAt' }
      }
    },
    { $sort: { latestPostAt: -1 } },
    {
      $lookup: {
        from: User.collection.name,
        localField: '_id',
        foreignField: '_id',
        pipeline: [{ $project: { name: 1, email: 1, role: 1 } }],
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: 1,
        name: '$user.name',
        email: '$user.email',
        role: '$user.role',
        postCount: 1,
        latestPostAt: 1
      }
    }
  ]);

  res.status(200).json({ data: authorsAggregate });
});

module.exports = {
  createPost,
  getAuthors
};
