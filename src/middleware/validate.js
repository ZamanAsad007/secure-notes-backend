/**
 * Express middleware for validating request data against a Zod schema.
 *
 * @param {import('zod').ZodSchema} schema - Zod schema to validate req.body
 * @returns {Function} Express middleware
 */
const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err.name === 'ZodError') {
      const issues = err.issues || err.errors || [];
      const message = issues.length > 0 ? issues.map((e) => e.message).join(', ') : err.message;
      return res.status(400).json({ error: message });
    }
    next(err);
  }
};

module.exports = validate;
