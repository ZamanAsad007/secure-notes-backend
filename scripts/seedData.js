const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');

async function seedData() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('Connected to MongoDB at', config.MONGODB_URI);

    // Ensure Admin
    const adminEmail = config.ADMIN_EMAIL.toLowerCase().trim();
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const adminPasswordHash = await bcrypt.hash(config.ADMIN_PASSWORD, config.BCRYPT_ROUNDS);
      admin = await User.create({
        name: config.ADMIN_NAME,
        email: adminEmail,
        passwordHash: adminPasswordHash,
        role: 'admin',
        interests: ['management', 'security', 'systems']
      });
      console.log('Seeded Admin user:', adminEmail);
    } else {
      console.log('Admin user exists:', adminEmail);
    }

    // Seed Users
    const sampleUsers = [
      {
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'user',
        interests: ['chess', 'coding', 'algorithms']
      },
      {
        name: 'Bob Smith',
        email: 'bob@example.com',
        role: 'user',
        interests: ['chess', 'gaming', 'security']
      },
      {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        role: 'user',
        interests: ['coding', 'webdev', 'ai']
      },
      {
        name: 'Diana Prince',
        email: 'diana@example.com',
        role: 'user',
        interests: ['design', 'photography', 'art']
      }
    ];

    const defaultPasswordHash = await bcrypt.hash('Password123!', config.BCRYPT_ROUNDS);
    const createdUsers = [];

    for (const u of sampleUsers) {
      let existing = await User.findOne({ email: u.email });
      if (!existing) {
        existing = await User.create({
          name: u.name,
          email: u.email,
          passwordHash: defaultPasswordHash,
          role: u.role,
          interests: u.interests
        });
        console.log(`Created sample user: ${u.email}`);
      }
      createdUsers.push(existing);
    }

    // Seed Notes for each user
    for (const user of createdUsers) {
      const existingNotes = await Note.countDocuments({ owner: user._id });
      if (existingNotes === 0) {
        await Note.create([
          {
            owner: user._id,
            title: `${user.name}'s First Secure Note`,
            content: `This is a private, confidential note belonging exclusively to ${user.name}.`
          },
          {
            owner: user._id,
            title: `${user.name}'s Project Ideas`,
            content: '1. Build end-to-end encrypted notes\n2. Explore vector search\n3. MongoDB index tuning'
          },
          {
            owner: user._id,
            title: `${user.name}'s Reading List`,
            content: 'Clean Code, Designing Data-Intensive Applications, The Pragmatic Programmer.'
          }
        ]);
        console.log(`Seeded 3 sample notes for ${user.name}`);
      }
    }

    // Seed Posts for users
    for (const user of createdUsers) {
      const existingPosts = await Post.countDocuments({ author: user._id });
      if (existingPosts === 0) {
        await Post.create([
          {
            author: user._id,
            title: `Hello World by ${user.name}`,
            content: `Welcome to my public note and blog feed! Authored by ${user.name}.`
          },
          {
            author: user._id,
            title: `Why I love ${user.interests[0] || 'programming'}`,
            content: `A deep dive into why ${user.interests[0] || 'technology'} is fascinating.`
          }
        ]);
        console.log(`Seeded 2 sample posts for ${user.name}`);
      }
    }

    console.log('Seed data insertion completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed data error:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

seedData();
