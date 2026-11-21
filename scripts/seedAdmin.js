const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const User = require('../src/models/User');

async function seedAdmin() {
  try {
    await mongoose.connect(config.MONGODB_URI);

    const adminEmail = config.ADMIN_EMAIL.toLowerCase().trim();
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`Admin user (${adminEmail}) already exists.`);
    } else {
      const passwordHash = await bcrypt.hash(config.ADMIN_PASSWORD, config.BCRYPT_ROUNDS);
      await User.create({
        name: config.ADMIN_NAME,
        email: adminEmail,
        passwordHash,
        role: 'admin',
        interests: ['admin', 'management']
      });
      console.log(`Admin user (${adminEmail}) seeded successfully.`);
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

seedAdmin();
