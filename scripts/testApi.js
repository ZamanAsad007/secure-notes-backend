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
  let secondaryUserToken;
  let secondaryUserId;
  let adminToken;
  let adminId;
  let testNoteId;
  let testPostId;
  let managedUserId;

  const testUserEmail = `test_${Date.now()}@example.com`;
  const secondaryUserEmail = `secondary_${Date.now()}@example.com`;
  const managedUserEmail = `managed_${Date.now()}@example.com`;
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

    console.log('[1/9] Testing Health & Security Headers...');
    const rootRes = await fetch(`${baseUrl}/`);
    const rootJson = await rootRes.json();
    assertTest('Root endpoint returns 200 { status: ok }', rootRes.status === 200 && rootJson.status === 'ok');

    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    assertTest('Health check returns 200 { status: ok }', healthRes.status === 200 && healthJson.status === 'ok');
    assertTest('Helmet security headers present', !!healthRes.headers.get('x-content-type-options'));

    console.log('\n[2/9] Testing Unauthenticated Access Guards (401)...');
    const unauthRes = await fetch(`${baseUrl}/api/notes`);
    const unauthJson = await unauthRes.json();
    assertTest('Protected route rejects missing token with 401', unauthRes.status === 401);
    assertTest('Error response conforms to { error: string }', typeof unauthJson.error === 'string');

    const unauthMeRes = await fetch(`${baseUrl}/api/users/me`);
    assertTest('/api/users/me rejects missing token with 401', unauthMeRes.status === 401);

    console.log('\n[3/9] Testing Registration & Authentication...');
    // Invalid schema test
    const invalidRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad-email', password: 'short' })
    });
    assertTest('Registration validation rejects invalid payload with 400', invalidRegRes.status === 400);

    // Valid registration
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

    // Duplicate registration returns 409
    const dupRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate User',
        email: testUserEmail,
        password: testPassword
      })
    });
    assertTest('Duplicate registration returns 409 Conflict', dupRegRes.status === 409);

    // Register secondary user for isolation tests
    const regSecondaryRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Secondary Test User',
        email: secondaryUserEmail,
        password: testPassword,
        interests: ['algorithms', 'cryptography']
      })
    });
    const regSecondaryJson = await regSecondaryRes.json();
    secondaryUserToken = regSecondaryJson.token;
    secondaryUserId = regSecondaryJson.user._id;

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

    console.log('\n[4/9] Testing User Profile Endpoints (/api/users/me)...');
    const getMeRes = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const getMeJson = await getMeRes.json();
    assertTest('GET /api/users/me returns authenticated user', getMeRes.status === 200 && getMeJson.email === testUserEmail);
    assertTest('GET /api/users/me contains top-level and data wrapper', !!getMeJson.data && getMeJson.data.email === testUserEmail);

    const updateMeRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        name: 'Updated Test User',
        interests: ['testing', 'security', 'vitest']
      })
    });
    const updateMeJson = await updateMeRes.json();
    assertTest('PATCH /api/users/me updates name & normalized interests', updateMeRes.status === 200 && updateMeJson.name === 'Updated Test User' && updateMeJson.interests.includes('vitest'));
    assertTest('PATCH /api/users/me returns data wrapper for frontend compatibility', !!updateMeJson.data && updateMeJson.data.name === 'Updated Test User');

    console.log('\n[5/9] Testing Notes CRUD & Owner Scoping...');
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

    // Get Single Note
    const getNoteRes = await fetch(`${baseUrl}/api/notes/${testNoteId}`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const getNoteJson = await getNoteRes.json();
    assertTest('Get note by ID returns 200 with correct content', getNoteRes.status === 200 && getNoteJson.title === 'Confidential Test Note');

    // Cross-user isolation: secondary user cannot access test user's note (returns 404 to hide existence)
    const crossAccessRes = await fetch(`${baseUrl}/api/notes/${testNoteId}`, {
      headers: { Authorization: `Bearer ${secondaryUserToken}` }
    });
    assertTest('Cross-user isolation: Other user cannot access note (404 Not Found)', crossAccessRes.status === 404);

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

    // Create ephemeral note to verify HTTP DELETE endpoint
    const ephemeralNoteRes = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testUserToken}`
      },
      body: JSON.stringify({
        title: 'Ephemeral Note to Delete',
        content: 'This note will be deleted.'
      })
    });
    const ephemeralNote = await ephemeralNoteRes.json();
    const deleteNoteRes = await fetch(`${baseUrl}/api/notes/${ephemeralNote._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    assertTest('Delete note via HTTP DELETE returns 200', deleteNoteRes.status === 200);

    console.log('\n[6/9] Testing Posts & Community Authors...');
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

    // Authors aggregation endpoint
    const authorsRes = await fetch(`${baseUrl}/api/posts/authors`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const authorsJson = await authorsRes.json();
    assertTest('GET /api/posts/authors returns 200 with authors array', authorsRes.status === 200 && Array.isArray(authorsJson.data));
    assertTest('Authors list includes current poster', authorsJson.data.some((a) => a._id === testUserId));

    // Scenario 2 Query (posts by user ID)
    const userPostsRes = await fetch(`${baseUrl}/api/users/${testUserId}/posts?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const userPostsJson = await userPostsRes.json();
    assertTest('Scenario 2 posts aggregation returns 200', userPostsRes.status === 200 && !!userPostsJson.data?.posts);
    assertTest('Scenario 2 returns cursor hasMore pagination', typeof userPostsJson.pagination?.hasMore === 'boolean');
    assertTest('Author information populated in aggregation', userPostsJson.data?.name === 'Updated Test User');

    // Scenario 2 Query (lookup by author email)
    const emailPostsRes = await fetch(`${baseUrl}/api/users/${encodeURIComponent(testUserEmail)}/posts?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    const emailPostsJson = await emailPostsRes.json();
    assertTest('Scenario 2 lookup by email returns 200 with matching posts', emailPostsRes.status === 200 && emailPostsJson.posts.length > 0);

    console.log('\n[7/9] Testing Role-Based Access Control (RBAC Boundaries)...');
    // Regular user attempting admin endpoint
    const forbiddenRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    assertTest('Non-admin user accessing /api/users gets 403 Forbidden', forbiddenRes.status === 403);

    const forbiddenInterestsRes = await fetch(`${baseUrl}/api/users/by-interests`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    assertTest('Non-admin user accessing /api/users/by-interests gets 403 Forbidden', forbiddenInterestsRes.status === 403);

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
    adminId = adminLoginJson.user._id;

    // Admin listing users
    const adminUsersRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminUsersJson = await adminUsersRes.json();
    assertTest('Admin authorized to list all users (200 OK)', adminUsersRes.status === 200 && Array.isArray(adminUsersJson.data));

    // Admin listing users filtered by ?role=admin
    const adminRoleFilterRes = await fetch(`${baseUrl}/api/users?role=admin`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminRoleFilterJson = await adminRoleFilterRes.json();
    assertTest('Admin filter ?role=admin returns only admins', adminRoleFilterRes.status === 200 && adminRoleFilterJson.data.every((u) => u.role === 'admin'));

    // Admin inspecting notes filtered by owner ID
    const adminAllNotesRes = await fetch(`${baseUrl}/api/notes?owner=${testUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminAllNotesJson = await adminAllNotesRes.json();
    assertTest('Admin can inspect all notes filtered by owner ID', adminAllNotesRes.status === 200 && adminAllNotesJson.data.some((n) => n._id === testNoteId));

    // Admin inspecting notes filtered by owner email
    const adminNotesByEmailRes = await fetch(`${baseUrl}/api/notes?owner=${encodeURIComponent(testUserEmail)}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminNotesByEmailJson = await adminNotesByEmailRes.json();
    assertTest('Admin can inspect notes filtered by owner email', adminNotesByEmailRes.status === 200 && adminNotesByEmailJson.data.some((n) => n._id === testNoteId));

    // Admin self-deletion prevention
    const selfDeleteRes = await fetch(`${baseUrl}/api/users/${adminId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertTest('Admin cannot delete their own account (400 Bad Request)', selfDeleteRes.status === 400);

    console.log('\n[8/9] Testing Admin User Management CRUD...');
    // Create User via Admin API
    const createUserRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Managed User',
        email: managedUserEmail,
        password: 'ManagedPassword123!',
        role: 'user',
        interests: ['distributed-systems']
      })
    });
    const createUserJson = await createUserRes.json();
    assertTest('Admin creates user (201 Created)', createUserRes.status === 201 && createUserJson.email === managedUserEmail);
    managedUserId = createUserJson._id;

    // Get User By ID
    const getUserRes = await fetch(`${baseUrl}/api/users/${managedUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const getUserJson = await getUserRes.json();
    assertTest('Admin gets user by ID (200 OK)', getUserRes.status === 200 && getUserJson._id === managedUserId);

    // Update User By ID
    const updateUserRes = await fetch(`${baseUrl}/api/users/${managedUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: 'Updated Managed User',
        interests: ['distributed-systems', 'kubernetes']
      })
    });
    const updateUserJson = await updateUserRes.json();
    assertTest('Admin updates user name and interests (200 OK)', updateUserRes.status === 200 && updateUserJson.name === 'Updated Managed User');

    // Delete User By ID
    const deleteUserRes = await fetch(`${baseUrl}/api/users/${managedUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertTest('Admin deletes user (200 OK)', deleteUserRes.status === 200);

    console.log('\n[9/9] Testing Scenario 1 Aggregation Pipeline ($facet)...');
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
    await User.findByIdAndDelete(secondaryUserId);
    if (managedUserId) {
      await User.findByIdAndDelete(managedUserId);
    }
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
