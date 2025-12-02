// create_admin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function createAdmin() {
  try {
    // Admin credentials - Change these as needed
    const adminEmail = 'admin@sengunthar.com';
    const adminPassword = 'Admin@123'; // CHANGE THIS TO A SECURE PASSWORD
    const adminName = 'System Administrator';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Check if admin already exists
    const existingAdmin = await pool.query('SELECT id FROM admins WHERE email = $1', [adminEmail]);
    
    if (existingAdmin.rowCount > 0) {
      console.log('❌ Admin user already exists!');
      
      // Update existing admin password
      await pool.query(
        'UPDATE admins SET password = $1, name = $2 WHERE email = $3',
        [hashedPassword, adminName, adminEmail]
      );
      console.log('✅ Admin password updated successfully!');
    } else {
      // Create new admin user in admins table
      const result = await pool.query(
        `INSERT INTO admins (name, email, password, created_at) 
         VALUES ($1, $2, $3, NOW()) 
         RETURNING id`,
        [adminName, adminEmail, hashedPassword]
      );
      
      console.log('✅ Admin user created successfully!');
      console.log('Admin ID:', result.rows[0].id);
    }
    
    console.log('\n🔐 ADMIN LOGIN CREDENTIALS');
    console.log('============================');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Login URL: admin_login.html');
    console.log('============================\n');
    
    console.log('⚠️  IMPORTANT: Change the default password for security!');
    
  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await pool.end();
  }
}

createAdmin();