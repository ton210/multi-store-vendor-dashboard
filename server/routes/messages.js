const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get messages (conversations)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, order_id } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['(m.sender_id = $1 OR m.recipient_id = $1)'];
    let queryParams = [req.user.id];
    let paramCount = 1;

    if (order_id) {
      whereConditions.push(`m.order_id = $${++paramCount}`);
      queryParams.push(order_id);
    }

    const whereClause = whereConditions.join(' AND ');

    const messagesQuery = `
      SELECT
        m.*,
        sender.first_name || ' ' || sender.last_name as sender_name,
        recipient.first_name || ' ' || recipient.last_name as recipient_name,
        CASE
          WHEN m.order_id IS NOT NULL THEN
            json_build_object(
              'id', o.id,
              'order_number', o.order_number,
              'store_name', s.name
            )
          ELSE NULL
        END as order_info
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users recipient ON m.recipient_id = recipient.id
      LEFT JOIN orders o ON m.order_id = o.id
      LEFT JOIN stores s ON o.store_id = s.id
      WHERE ${whereClause}
      ORDER BY m.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);

    const messages = await db.query(messagesQuery, queryParams);

    // Mark received messages as read
    await db.query(
      'UPDATE messages SET is_read = true WHERE recipient_id = $1 AND is_read = false',
      [req.user.id]
    );

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM messages m
      WHERE ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2);
    const countResult = await db.query(countQuery, countParams);

    res.json({
      messages: messages.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

// Send message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { recipient_id, order_id, subject, message } = req.body;

    if (!recipient_id || !message) {
      return res.status(400).json({ error: 'Recipient and message are required' });
    }

    // Check if recipient exists
    const recipientQuery = await db.query('SELECT id FROM users WHERE id = $1 AND is_active = true', [recipient_id]);
    if (recipientQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // If order_id provided, verify access
    if (order_id) {
      let hasAccess = false;

      if (req.user.role === 'admin' || req.user.role === 'manager') {
        hasAccess = true;
      } else if (req.user.role === 'vendor') {
        const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
        if (vendorQuery.rows.length > 0) {
          const accessQuery = await db.query(
            'SELECT 1 FROM vendor_assignments WHERE order_id = $1 AND vendor_id = $2',
            [order_id, vendorQuery.rows[0].id]
          );
          hasAccess = accessQuery.rows.length > 0;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ error: 'No access to this order' });
      }
    }

    // Insert message
    const messageQuery = await db.query(`
      INSERT INTO messages (sender_id, recipient_id, order_id, subject, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [req.user.id, recipient_id, order_id, subject, message]);

    // Create notification for recipient
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'new_message', 'New Message', $2, $3)
    `, [
      recipient_id,
      `You have a new message from ${req.user.first_name} ${req.user.last_name}`,
      JSON.stringify({ message_id: messageQuery.rows[0].id, order_id })
    ]);

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: messageQuery.rows[0]
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error sending message' });
  }
});

// Get conversation between two users
router.get('/conversation/:userId', authenticateToken, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const { order_id } = req.query;

    let whereConditions = [
      '((m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1))'
    ];
    let queryParams = [req.user.id, otherUserId];
    let paramCount = 2;

    if (order_id) {
      whereConditions.push(`m.order_id = $${++paramCount}`);
      queryParams.push(order_id);
    }

    const whereClause = whereConditions.join(' AND ');

    const conversationQuery = `
      SELECT
        m.*,
        sender.first_name || ' ' || sender.last_name as sender_name,
        recipient.first_name || ' ' || recipient.last_name as recipient_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users recipient ON m.recipient_id = recipient.id
      WHERE ${whereClause}
      ORDER BY m.created_at ASC
    `;

    const messages = await db.query(conversationQuery, queryParams);

    // Mark messages as read
    await db.query(
      'UPDATE messages SET is_read = true WHERE sender_id = $1 AND recipient_id = $2 AND is_read = false',
      [otherUserId, req.user.id]
    );

    res.json({
      conversation: messages.rows
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Server error fetching conversation' });
  }
});

// Get unread message count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const countQuery = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE recipient_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      unread_count: parseInt(countQuery.rows[0].count)
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Server error fetching unread count' });
  }
});

// Mark message as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const messageId = req.params.id;

    const updateQuery = await db.query(
      'UPDATE messages SET is_read = true WHERE id = $1 AND recipient_id = $2 RETURNING *',
      [messageId, req.user.id]
    );

    if (updateQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }

    res.json({ message: 'Message marked as read' });

  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Server error marking message as read' });
  }
});

module.exports = router;