const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'vendor' } = req.body;

    // Check if user exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userQuery = await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, first_name, last_name, role, created_at
    `, [email, hashedPassword, firstName, lastName, role]);

    const user = userQuery.rows[0];

    // If vendor, create vendor profile
    if (role === 'vendor') {
      await db.query(`
        INSERT INTO vendors (user_id, company_name, is_approved)
        VALUES ($1, $2, $3)
      `, [user.id, '', false]);
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const userQuery = await db.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userQuery.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if vendor is approved
    if (user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT is_approved FROM vendors WHERE user_id = $1', [user.id]);
      if (vendorQuery.rows.length > 0 && !vendorQuery.rows[0].is_approved) {
        return res.status(401).json({ error: 'Vendor account pending approval' });
      }
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    let userInfo = {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.first_name,
      lastName: req.user.last_name,
      role: req.user.role
    };

    // If vendor, get additional vendor info
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT * FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length > 0) {
        userInfo.vendorInfo = vendorQuery.rows[0];
      }
    }

    res.json(userInfo);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, address, companyName } = req.body;

    // Update user info
    await db.query(`
      UPDATE users
      SET first_name = $1, last_name = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [firstName, lastName, req.user.id]);

    // If vendor, update vendor info
    if (req.user.role === 'vendor') {
      await db.query(`
        UPDATE vendors
        SET company_name = $1, phone = $2, address = $3, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $4
      `, [companyName, phone, address, req.user.id]);
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error updating profile' });
  }
});

module.exports = router;