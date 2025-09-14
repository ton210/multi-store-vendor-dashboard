const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = '30' } = req.query; // days

    let stats = {};

    if (req.user.role === 'admin' || req.user.role === 'manager') {
      // Admin/Manager dashboard stats
      const overviewQuery = `
        SELECT
          (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '${period} days') as total_orders,
          (SELECT COUNT(*) FROM orders WHERE order_status = 'pending' AND created_at >= CURRENT_DATE - INTERVAL '${period} days') as pending_orders,
          (SELECT COUNT(*) FROM orders WHERE order_status = 'processing' AND created_at >= CURRENT_DATE - INTERVAL '${period} days') as processing_orders,
          (SELECT COUNT(*) FROM orders WHERE order_status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '${period} days') as completed_orders,
          (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '${period} days') as total_revenue,
          (SELECT COUNT(*) FROM vendors WHERE is_approved = true) as active_vendors,
          (SELECT COUNT(*) FROM vendors WHERE is_approved = false) as pending_vendors,
          (SELECT COUNT(*) FROM stores WHERE is_active = true) as active_stores
      `;

      const overview = await db.query(overviewQuery);

      // Recent orders
      const recentOrdersQuery = `
        SELECT
          o.id,
          o.order_number,
          o.customer_name,
          o.total_amount,
          o.order_status,
          o.order_date,
          s.name as store_name,
          s.type as store_type
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        ORDER BY o.order_date DESC
        LIMIT 10
      `;

      const recentOrders = await db.query(recentOrdersQuery);

      // Top vendors
      const topVendorsQuery = `
        SELECT
          v.id,
          v.company_name,
          u.first_name || ' ' || u.last_name as vendor_name,
          COUNT(va.id) as total_assignments,
          COUNT(va.id) FILTER (WHERE va.status = 'completed') as completed_assignments,
          COALESCE(SUM(va.commission_amount), 0) as total_earnings
        FROM vendors v
        JOIN users u ON v.user_id = u.id
        LEFT JOIN vendor_assignments va ON v.id = va.vendor_id
          AND va.assigned_at >= CURRENT_DATE - INTERVAL '${period} days'
        WHERE v.is_approved = true
        GROUP BY v.id, v.company_name, u.first_name, u.last_name
        ORDER BY total_assignments DESC
        LIMIT 5
      `;

      const topVendors = await db.query(topVendorsQuery);

      // Daily revenue chart data
      const revenueChartQuery = `
        SELECT
          DATE_TRUNC('day', order_date) as date,
          COUNT(*) as orders,
          COALESCE(SUM(total_amount), 0) as revenue
        FROM orders
        WHERE order_date >= CURRENT_DATE - INTERVAL '${period} days'
        GROUP BY DATE_TRUNC('day', order_date)
        ORDER BY date ASC
      `;

      const revenueChart = await db.query(revenueChartQuery);

      stats = {
        overview: overview.rows[0],
        recent_orders: recentOrders.rows,
        top_vendors: topVendors.rows,
        revenue_chart: revenueChart.rows
      };

    } else if (req.user.role === 'vendor') {
      // Vendor dashboard stats
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }

      const vendorId = vendorQuery.rows[0].id;

      const vendorStatsQuery = `
        SELECT
          (SELECT COUNT(*) FROM vendor_assignments WHERE vendor_id = $1 AND assigned_at >= CURRENT_DATE - INTERVAL '${period} days') as total_assignments,
          (SELECT COUNT(*) FROM vendor_assignments WHERE vendor_id = $1 AND status = 'assigned') as pending_assignments,
          (SELECT COUNT(*) FROM vendor_assignments WHERE vendor_id = $1 AND status = 'in_progress') as in_progress_assignments,
          (SELECT COUNT(*) FROM vendor_assignments WHERE vendor_id = $1 AND status = 'completed' AND assigned_at >= CURRENT_DATE - INTERVAL '${period} days') as completed_assignments,
          (SELECT COALESCE(SUM(commission_amount), 0) FROM vendor_assignments WHERE vendor_id = $1 AND assigned_at >= CURRENT_DATE - INTERVAL '${period} days') as total_earnings,
          (SELECT COALESCE(SUM(commission_amount), 0) FROM vendor_assignments WHERE vendor_id = $1 AND status = 'completed') as paid_earnings
      `;

      const vendorStats = await db.query(vendorStatsQuery, [vendorId]);

      // Recent assignments
      const recentAssignmentsQuery = `
        SELECT
          va.id,
          va.status,
          va.assigned_at,
          va.commission_amount,
          o.id as order_id,
          o.order_number,
          o.customer_name,
          o.total_amount,
          o.order_status,
          s.name as store_name
        FROM vendor_assignments va
        JOIN orders o ON va.order_id = o.id
        JOIN stores s ON o.store_id = s.id
        WHERE va.vendor_id = $1
        ORDER BY va.assigned_at DESC
        LIMIT 10
      `;

      const recentAssignments = await db.query(recentAssignmentsQuery, [vendorId]);

      // Earnings chart
      const earningsChartQuery = `
        SELECT
          DATE_TRUNC('day', va.assigned_at) as date,
          COUNT(*) as assignments,
          COALESCE(SUM(va.commission_amount), 0) as earnings
        FROM vendor_assignments va
        WHERE va.vendor_id = $1
          AND va.assigned_at >= CURRENT_DATE - INTERVAL '${period} days'
        GROUP BY DATE_TRUNC('day', va.assigned_at)
        ORDER BY date ASC
      `;

      const earningsChart = await db.query(earningsChartQuery, [vendorId]);

      stats = {
        overview: vendorStats.rows[0],
        recent_assignments: recentAssignments.rows,
        earnings_chart: earningsChart.rows
      };
    }

    res.json(stats);

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Server error fetching dashboard statistics' });
  }
});

// Get notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'user_id = $1';
    let queryParams = [req.user.id];

    if (unread_only === 'true') {
      whereClause += ' AND is_read = false';
    }

    const notificationsQuery = `
      SELECT *
      FROM notifications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    queryParams.push(limit, offset);

    const notifications = await db.query(notificationsQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications
      WHERE ${whereClause}
    `;

    const countParams = [req.user.id];
    const countResult = await db.query(countQuery, countParams);

    res.json({
      notifications: notifications.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error fetching notifications' });
  }
});

// Mark notification as read
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.id;

    const updateQuery = await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, req.user.id]
    );

    if (updateQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Server error marking notification as read' });
  }
});

// Mark all notifications as read
router.put('/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ message: 'All notifications marked as read' });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Server error marking notifications as read' });
  }
});

// Get system health status
router.get('/health', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check database connection
    const dbHealthQuery = await db.query('SELECT COUNT(*) as count FROM users');
    const dbHealth = dbHealthQuery.rows[0].count > 0;

    // Check store sync status
    const storesSyncQuery = await db.query(`
      SELECT
        s.name,
        s.last_sync_at,
        CASE
          WHEN s.last_sync_at IS NULL THEN 'never_synced'
          WHEN s.last_sync_at < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 'outdated'
          ELSE 'up_to_date'
        END as sync_status
      FROM stores s
      WHERE s.is_active = true AND s.sync_enabled = true
    `);

    // Check for system errors in the last 24 hours
    const recentErrorsQuery = await db.query(`
      SELECT COUNT(*) as error_count
      FROM order_status_history
      WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND notes ILIKE '%error%'
    `);

    const health = {
      database: dbHealth ? 'healthy' : 'error',
      stores: storesSyncQuery.rows,
      recent_errors: parseInt(recentErrorsQuery.rows[0].error_count),
      timestamp: new Date().toISOString()
    };

    res.json(health);

  } catch (error) {
    console.error('Get health status error:', error);
    res.status(500).json({ error: 'Server error checking system health' });
  }
});

module.exports = router;