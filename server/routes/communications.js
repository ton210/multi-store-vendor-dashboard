const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const SlackService = require('../services/slackService');

const router = express.Router();
const slackService = new SlackService();

// Send internal communication to vendor
router.post('/vendor', authenticateToken, async (req, res) => {
  try {
    const {
      vendor_id,
      order_id,
      subject,
      message,
      priority = 'normal'
    } = req.body;

    if (!vendor_id || !message) {
      return res.status(400).json({ error: 'Vendor ID and message are required' });
    }

    // Verify vendor exists
    const vendorQuery = await db.query('SELECT * FROM vendors WHERE id = $1', [vendor_id]);
    if (vendorQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Insert communication
    const commQuery = await db.query(`
      INSERT INTO vendor_communications (
        vendor_id, order_id, subject, message, priority, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [vendor_id, order_id, subject, message, priority, req.user.id]);

    // Create notification for vendor
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'internal_communication', $2, $3, $4)
    `, [
      vendorQuery.rows[0].user_id,
      subject || 'Internal Communication',
      message.substring(0, 200) + (message.length > 200 ? '...' : ''),
      JSON.stringify({
        communication_id: commQuery.rows[0].id,
        order_id,
        priority
      })
    ]);

    // Send Slack notification if high priority
    if (priority === 'high' || priority === 'urgent') {
      try {
        await slackService.notifyVendorMessage({
          sender_name: `${req.user.first_name} ${req.user.last_name}`,
          vendor_name: vendorQuery.rows[0].company_name || 'Vendor',
          subject: subject || 'Internal Communication',
          message,
          priority,
          order_number: order_id ? `Order #${order_id}` : null
        });
      } catch (slackError) {
        console.error('Slack notification failed:', slackError);
      }
    }

    res.json({
      message: 'Communication sent successfully',
      communication: commQuery.rows[0]
    });

  } catch (error) {
    console.error('Send communication error:', error);
    res.status(500).json({ error: 'Server error sending communication' });
  }
});

// Get vendor communications
router.get('/vendor/:vendorId', authenticateToken, async (req, res) => {
  try {
    const vendorId = req.params.vendorId;
    const { status, priority, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Check permissions
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0 || vendorQuery.rows[0].id != vendorId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    let whereConditions = ['vendor_id = $1'];
    let queryParams = [vendorId];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`status = $${++paramCount}`);
      queryParams.push(status);
    }

    if (priority) {
      whereConditions.push(`priority = $${++paramCount}`);
      queryParams.push(priority);
    }

    const whereClause = whereConditions.join(' AND ');

    const commQuery = `
      SELECT
        vc.*,
        creator.first_name || ' ' || creator.last_name as created_by_name,
        replier.first_name || ' ' || replier.last_name as replied_by_name,
        o.order_number
      FROM vendor_communications vc
      LEFT JOIN users creator ON vc.created_by = creator.id
      LEFT JOIN users replier ON vc.replied_by = replier.id
      LEFT JOIN orders o ON vc.order_id = o.id
      WHERE ${whereClause}
      ORDER BY
        CASE vc.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        vc.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);

    const communications = await db.query(commQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM vendor_communications vc
      WHERE ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2);
    const countResult = await db.query(countQuery, countParams);

    res.json({
      communications: communications.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get communications error:', error);
    res.status(500).json({ error: 'Server error fetching communications' });
  }
});

// Reply to communication
router.post('/:commId/reply', authenticateToken, async (req, res) => {
  try {
    const commId = req.params.commId;
    const { reply_message } = req.body;

    if (!reply_message) {
      return res.status(400).json({ error: 'Reply message is required' });
    }

    // Get communication
    const commQuery = await db.query('SELECT * FROM vendor_communications WHERE id = $1', [commId]);
    if (commQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Communication not found' });
    }

    const communication = commQuery.rows[0];

    // Check permissions
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0 || vendorQuery.rows[0].id != communication.vendor_id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Update communication with reply
    await db.query(`
      UPDATE vendor_communications
      SET reply_message = $1, replied_by = $2, replied_at = CURRENT_TIMESTAMP, status = 'replied'
      WHERE id = $3
    `, [reply_message, req.user.id, commId]);

    // Create notification for sender
    if (communication.created_by !== req.user.id) {
      await db.query(`
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES ($1, 'communication_reply', 'Communication Reply', $2, $3)
      `, [
        communication.created_by,
        `Reply received for: ${communication.subject || 'Communication'}`,
        JSON.stringify({
          communication_id: commId,
          order_id: communication.order_id
        })
      ]);
    }

    res.json({ message: 'Reply sent successfully' });

  } catch (error) {
    console.error('Reply communication error:', error);
    res.status(500).json({ error: 'Server error sending reply' });
  }
});

// Mark communication as resolved
router.put('/:commId/resolve', authenticateToken, async (req, res) => {
  try {
    const commId = req.params.commId;

    await db.query(
      'UPDATE vendor_communications SET status = $1 WHERE id = $2',
      ['resolved', commId]
    );

    res.json({ message: 'Communication marked as resolved' });

  } catch (error) {
    console.error('Resolve communication error:', error);
    res.status(500).json({ error: 'Server error resolving communication' });
  }
});

// Get communication statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    let whereClause = '1=1';
    let queryParams = [];

    // If vendor, filter to their communications
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      whereClause = 'vendor_id = $1';
      queryParams = [vendorQuery.rows[0].id];
    }

    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'unread') as unread,
        COUNT(*) FILTER (WHERE status = 'read') as read,
        COUNT(*) FILTER (WHERE status = 'replied') as replied,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
        COUNT(*) FILTER (WHERE priority = 'high') as high,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent
      FROM vendor_communications
      WHERE ${whereClause}
    `;

    const stats = await db.query(statsQuery, queryParams);

    res.json({
      statistics: stats.rows[0]
    });

  } catch (error) {
    console.error('Get communication stats error:', error);
    res.status(500).json({ error: 'Server error fetching statistics' });
  }
});

module.exports = router;