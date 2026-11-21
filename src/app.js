const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration with environment allow-list
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
allowedOrigins.push('http://localhost:5173');

app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser tools (curl, Postman) which send no origin
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

// Body parser with 100kb payload limit
app.use(express.json({ limit: '100kb' }));

// Health check endpoints
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes
const authRoutes = require('./routes/auth.routes');
const notesRoutes = require('./routes/notes.routes');
const usersRoutes = require('./routes/users.routes');
const postsRoutes = require('./routes/posts.routes');

app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);

// 404 handler
app.use(notFound);

// Central error handler
app.use(errorHandler);

module.exports = app;
