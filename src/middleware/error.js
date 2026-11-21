const notFound = (req, res, next) => {
  res.status(404).json({ error: `Not found: ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyPattern || {});
    if (fields.includes('email')) {
      message = 'Email is already registered';
    } else {
      message = 'Duplicate key error';
    }
  }

  // Handle Mongoose CastError (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Handle Zod validation error
  if (err.name === 'ZodError') {
    statusCode = 400;
    const issues = err.issues || err.errors || [];
    message = issues.length > 0 ? issues.map((e) => e.message).join(', ') : err.message;
  }

  // Ensure stack traces are never exposed in responses
  res.status(statusCode).json({ error: message });
};

module.exports = {
  notFound,
  errorHandler
};
