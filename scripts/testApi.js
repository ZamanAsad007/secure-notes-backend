const http = require('http');
const mongoose = require('mongoose');
const config = require('../src/config/env');
const app = require('../src/app');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');

async function runApiTests() {
  console.log('='.repeat(78));
  console.log('🧪 SECURE NOTE-TAKING APPLICATION — END-TO-END API SUITE');
  console.log('='.repeat(78));

  let server;
  let baseUrl;
  let testUserToken;
  let testUserId;
  let adminToken;
  let testNoteId;
  let testPostId;
  const testUserEmail = `test_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  try {
    await mongoose.connect(config.MONGODB_URI);

    if (process.env.API_URL) {
      baseUrl = process.env.API_URL.replace(/\/+$/, '');
      console.log(`Test suite pointing to API base URL: ${baseUrl}\n`);
    } else {
      server = http.createServer(app);
      await new Promise((resolve) => {
        server.listen(0, () => {
          const port = server.address().port;
          baseUrl = `http://localhost:${port}`;
          console.log(`Test server running on ${baseUrl}\n`);
          resolve();
        });
      });
    }

    const results = [];
    const assertTest = (name, condition, details = '') => {
      if (condition) {
        console.log(`  ✅ PASS: ${name} ${details ? `(${details})` : ''}`);
        results.push({ name, pass: true });
      } else {
        console.error(`  ❌ FAIL: ${name} ${details ? `(${details})` : ''}`);
        results.push({ name, pass: false });
        throw new Error(`Test assertion failed: ${name}`);
      }
    };

    console.log('[1/7] Testing Health & Security Headers...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    assertTest('Health check returns 200 status: ok', healthRes.status === 200 && healthJson.status === 'ok');
    assertTest('Helmet security headers present', !!healthRes.headers.get('x-content-type-options'));

    console.log('\n[2/7] Testing Unauthenticated Access Guards (401)...');
    const unauthRes = await fetch(`${baseUrl}/api/notes`);
    const unauthJson = await unauthRes.json();
    assertTest('Protected route rejects missing token with 401', unauthRes.status === 401);
    assertTest('Error response conforms to { error: string }', typeof unauthJson.error === 'string');

    console.log('\n[3/7] Testing Registration & Authentication...');
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test User',
        email: testUserEmail,
        password: testPassword,
        interests: ['testing', 'security', 'node']
      })
    });
    const regJson = await regRes.json();
    assertTest('Registration returns 201 with JWT token', regRes.status === 201 && !!regJson.token);
    assertTest('User object has select:false (passwordHash omitted)', regJson.user && regJson.user.passwordHash === undefined);
    assertTest('User role is forced to user', regJson.user && regJson.user.role === 'user');

    testUserToken = regJson.token;
    testUserId = regJson.user._id;

    // Login test
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, password: testPassword })
    });
    const loginJson = await loginRes.json();
    assertTest('Login returns 200 with matching user profile', loginRes.status === 200 && loginJson.user._id === testUserId);

    // Wrong password test
    const wrongLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, password: 'WrongPassword999!' })
    });
    assertTest('Wrong password returns 401 Invalid credentials', wrongLoginRes.status === 401);

    console.log('\n[4/7] Testing Notes CRUD & Owner Scoping...');
    // Create Note
    const createNoteRes = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        title: 'Confidential Test Note',
        content: 'AES-256 end-to-end encrypted note payload.'
      })
    });
    const createNoteJson = await createNoteRes.json();
    assertTest('Note creation returns 201', createNoteRes.status === 201 && !!createNoteJson._id);
    assertTest('Note owner matches authenticated user', createNoteJson.owner === testUserId);
    testNoteId = createNoteJson._id;

    // List Notes
    const listNotesRes = await fetch(`${baseUrl}/api/notes?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const listNotesJson = await listNotesRes.json();
    assertTest('Notes list returns 200 with pagination structure', listNotesRes.status === 200 && Array.isArray(listNotesJson.data) && !!listNotesJson.pagination);
    assertTest('Notes list contains created note', listNotesJson.data.some((n) => n._id === testNoteId));

    // Update Note
    const updateNoteRes = await fetch(`${baseUrl}/api/notes/${testNoteId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        title: 'Updated Confidential Test Note'
      })
    });
    const updateNoteJson = await updateNoteRes.json();
    assertTest('Note update returns 200 with updated title', updateNoteRes.status === 200 && updateNoteJson.title === 'Updated Confidential Test Note');

    console.log('\n[5/7] Testing Posts & Scenario 2 Aggregation Pipeline...');
    // Create Post
    const createPostRes = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        title: 'Automated Test Feed Post',
        content: 'Publishing verification packet to encrypted timeline.'
      })
    });
    const createPostJson = await createPostRes.json();
    assertTest('Post creation returns 201 with author reference', createPostRes.status === 201 && createPostJson.author === testUserId);
    testPostId = createPostJson._id;

    // Scenario 2 Query (posts by user)
    const userPostsRes = await fetch(`${baseUrl}/api/users/${testUserId}/posts?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const userPostsJson = await userPostsRes.json();
    assertTest('Scenario 2 posts aggregation returns 200', userPostsRes.status === 200 && !!userPostsJson.data?.posts);
    assertTest('Scenario 2 returns cursor hasMore pagination', typeof userPostsJson.pagination?.hasMore === 'boolean');
    assertTest('Author information populated in aggregation', userPostsJson.data?.name === 'Automated Test User');

    console.log('\n[6/7] Testing Role-Based Access Control (RBAC 403 Boundary)...');
    // Regular user attempting admin endpoint
    const forbiddenRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    assertTest('Non-admin user accessing /api/users gets 403 Forbidden', forbiddenRes.status === 403);

    // Admin login
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.ADMIN_EMAIL,
        password: config.ADMIN_PASSWORD
      })
    });
    const adminLoginJson = await adminLoginRes.json();
    assertTest('Admin login succeeds with admin clearance', adminLoginRes.status === 200 && adminLoginJson.user.role === 'admin');
    adminToken = adminLoginJson.token;

    // Admin accessing /api/users
    const adminUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminUsersJson = await adminUsersRes.json();
    assertTest('Admin authorized to list all users (200 OK)', adminUsersRes.status === 200 && Array.isArray(adminUsersJson.data));

    // Admin inspecting all notes
    const adminAllNotesRes = await fetch(`${baseUrl}/api/notes?owner=${testUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminAllNotesJson = await adminAllNotesRes.json();
    assertTest('Admin can inspect all notes filtered by owner', adminAllNotesRes.status === 200 && adminAllNotesJson.data.some((n) => n._id === testNoteId));

    console.log('\n[7/7] Testing Scenario 1 Aggregation Pipeline ($facet)...');
    const interestsRes = await fetch(`${baseUrl}/api/users/by-interests?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const interestsJson = await interestsRes.json();
    assertTest('Scenario 1 returns 200 with grouped interest categories', interestsRes.status === 200 && Array.isArray(interestsJson.data));
    assertTest('Category items contain interest, userCount, and users array', interestsJson.data.length > 0 && typeof interestsJson.data[0].userCount === 'number');

    // Filtered Scenario 1
    const filteredInterestsRes = await fetch(`${baseUrl}/api/users/by-interests?interest=testing`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const filteredInterestsJson = await filteredInterestsRes.json();
    assertTest('Scenario 1 filtered by interest returns matching group', filteredInterestsRes.status === 200 && filteredInterestsJson.data.some((g) => g.interest === 'testing'));

    console.log('\n[Cleanup] Cleaning up test records...');
    await Note.findByIdAndDelete(testNoteId);
    await Post.findByIdAndDelete(testPostId);
    await User.findByIdAndDelete(testUserId);
    console.log('✔ Ephemeral test records removed cleanly.');

    console.log('\n' + '='.repeat(78));
    console.log(`🎉 ALL ${results.length} END-TO-END TESTS PASSED SUCCESSFULLY!`);
    console.log('='.repeat(78));

    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test suite failed:', err.message);
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

if (require.main === module) {
  runApiTests();
}

module.exports = { runApiTests };
