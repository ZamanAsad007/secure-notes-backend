const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Supports Scenario 2: $lookup join on author + newest-first order; and cascade delete of a user's posts
postSchema.index({ author: 1, _id: -1 });

module.exports = mongoose.model('Post', postSchema);
