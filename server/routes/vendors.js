const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// Get all vendors
router.get('/', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    if (status) {
      if (status === 'approved') {
        whereConditions.push(`v.is_approved = true`);
      } else if (status === 'pending') {
        whereConditions.push(`v.is_approved = false`);
      }
    }

    if (search) {
      whereConditions.push(`(u.first_name ILIKE $${++paramCount} OR u.last_name ILIKE $${++paramCount} OR v.company_name ILIKE $${++paramCount} OR u.email ILIKE $${++paramCount})`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.join(' AND ');

    const vendorsQuery = `
      SELECT
        v.*,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.created_at as user_created_at,
        (
          SELECT COUNT(*)
          FROM vendor_assignments va
          WHERE va.vendor_id = v.id
        ) as total_orders,
        (
          SELECT COUNT(*)
          FROM vendor_assignments va
          WHERE va.vendor_id = v.id AND va.status = 'completed'
        ) as completed_orders,
        (
          SELECT COALESCE(SUM(commission_amount), 0)
          FROM vendor_assignments va
          WHERE va.vendor_id = v.id AND va.status = 'completed'
        ) as total_earnings
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);

    const vendors = await db.query(vendorsQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2);
    const countResult = await db.query(countQuery, countParams);

    res.json({
      vendors: vendors.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({ error: 'Server error fetching vendors' });
  }
});

// Get vendor details
router.get('/:id', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const vendorId = req.params.id;

    const vendorQuery = `
      SELECT
        v.*,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.created_at as user_created_at
      FROM vendors v
      JOIN users u ON v.user_id = u.id
      WHERE v.id = $1
    `;

    const vendor = await db.query(vendorQuery, [vendorId]);

    if (vendor.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Get vendor's recent orders
    const ordersQuery = `
      SELECT
        o.id,
        o.order_number,
        o.customer_name,
        o.total_amount,
        o.order_date,
        o.order_status,
        va.status as assignment_status,
        va.commission_amount,
        s.name as store_name
      FROM vendor_assignments va
      JOIN orders o ON va.order_id = o.id
      JOIN stores s ON o.store_id = s.id
      WHERE va.vendor_id = $1
      ORDER BY va.assigned_at DESC
      LIMIT 10
    `;

    const orders = await db.query(ordersQuery, [vendorId]);

    // Get vendor statistics
    const statsQuery = `
      SELECT
        COUNT(*) as total_assignments,
        COUNT(*) FILTER (WHERE va.status = 'completed') as completed_assignments,
        COUNT(*) FILTER (WHERE va.status = 'in_progress') as in_progress_assignments,
        COALESCE(SUM(va.commission_amount), 0) as total_earnings,
        COALESCE(SUM(va.commission_amount) FILTER (WHERE va.status = 'completed'), 0) as earned_amount,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value
      FROM vendor_assignments va
      JOIN orders o ON va.order_id = o.id
      WHERE va.vendor_id = $1
    `;

    const stats = await db.query(statsQuery, [vendorId]);

    res.json({
      vendor: vendor.rows[0],
      recent_orders: orders.rows,
      statistics: stats.rows[0]
    });

  } catch (error) {
    console.error('Get vendor details error:', error);
    res.status(500).json({ error: 'Server error fetching vendor details' });
  }
});

// Approve/reject vendor
router.put('/:id/approval', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const vendorId = req.params.id;
    const { is_approved, notes } = req.body;

    const updateQuery = await db.query(`
      UPDATE vendors
      SET is_approved = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [is_approved, vendorId]);

    if (updateQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Get user ID for notification
    const vendor = updateQuery.rows[0];

    // Create notification
    const notificationTitle = is_approved ? 'Vendor Approval' : 'Vendor Rejection';
    const notificationMessage = is_approved
      ? 'Your vendor account has been approved. You can now receive order assignments.'
      : 'Your vendor account has been rejected. Please contact support for more information.';

    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'vendor_approval', $2, $3, $4)
    `, [
      vendor.user_id,
      notificationTitle,
      notificationMessage,
      JSON.stringify({ is_approved, notes })
    ]);

    res.json({
      message: `Vendor ${is_approved ? 'approved' : 'rejected'} successfully`,
      vendor: vendor
    });

  } catch (error) {
    console.error('Update vendor approval error:', error);
    res.status(500).json({ error: 'Server error updating vendor approval' });
  }
});

// Update vendor commission rate
router.put('/:id/commission', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const vendorId = req.params.id;
    const { commission_rate } = req.body;

    if (commission_rate < 0 || commission_rate > 100) {
      return res.status(400).json({ error: 'Commission rate must be between 0 and 100' });
    }

    const updateQuery = await db.query(`
      UPDATE vendors
      SET commission_rate = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [commission_rate, vendorId]);

    if (updateQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json({
      message: 'Commission rate updated successfully',
      vendor: updateQuery.rows[0]
    });

  } catch (error) {
    console.error('Update commission rate error:', error);
    res.status(500).json({ error: 'Server error updating commission rate' });
  }
});

// Get vendor performance metrics
router.get('/:id/metrics', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const vendorId = req.params.id;
    const { period = '30' } = req.query; // days

    const metricsQuery = `
      SELECT
        DATE_TRUNC('day', va.assigned_at) as date,
        COUNT(*) as assignments,
        COUNT(*) FILTER (WHERE va.status = 'completed') as completed,
        COALESCE(SUM(va.commission_amount), 0) as commission,
        COALESCE(AVG(o.total_amount), 0) as avg_order_value
      FROM vendor_assignments va
      JOIN orders o ON va.order_id = o.id
      WHERE va.vendor_id = $1
        AND va.assigned_at >= CURRENT_DATE - INTERVAL '$2 days'
      GROUP BY DATE_TRUNC('day', va.assigned_at)
      ORDER BY date DESC
    `;

    const metrics = await db.query(metricsQuery, [vendorId, period]);

    res.json({
      period: parseInt(period),
      metrics: metrics.rows
    });

  } catch (error) {
    console.error('Get vendor metrics error:', error);
    res.status(500).json({ error: 'Server error fetching vendor metrics' });
  }
});

module.exports = router;