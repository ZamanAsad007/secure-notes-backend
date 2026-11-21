const mongoose = require('mongoose');

const normalizeInterests = (val) => {
  if (!Array.isArray(val)) return [];
  return [...new Set(val.map((i) => (typeof i === 'string' ? i.trim().toLowerCase() : '')).filter(Boolean))];
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    interests: {
      type: [String],
      default: [],
      set: normalizeInterests
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

userSchema.pre('save', function () {
  if (this.isModified('interests') && Array.isArray(this.interests)) {
    this.interests = normalizeInterests(this.interests);
  }
});

// Supports login lookup by email and email uniqueness
userSchema.index({ email: 1 }, { unique: true });

// Multikey index supporting Scenario 1: optional $match on an interest
userSchema.index({ interests: 1 });

module.exports = mongoose.model('User', userSchema);
