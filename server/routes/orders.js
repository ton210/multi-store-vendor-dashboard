const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdminOrManager, requireVendor } = require('../middleware/auth');
const StoreIntegrationService = require('../services/storeIntegrationService');

const router = express.Router();
const storeService = new StoreIntegrationService();

// Get orders with filters and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      store_id,
      vendor_id,
      search,
      date_from,
      date_to
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    // Role-based filtering
    if (req.user.role === 'vendor') {
      // Vendors can only see their assigned orders
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      whereConditions.push(`o.id IN (SELECT order_id FROM vendor_assignments WHERE vendor_id = $${++paramCount})`);
      queryParams.push(vendorQuery.rows[0].id);
    }

    // Additional filters
    if (status) {
      whereConditions.push(`o.order_status = $${++paramCount}`);
      queryParams.push(status);
    }

    if (store_id) {
      whereConditions.push(`o.store_id = $${++paramCount}`);
      queryParams.push(store_id);
    }

    if (vendor_id && req.user.role !== 'vendor') {
      whereConditions.push(`o.id IN (SELECT order_id FROM vendor_assignments WHERE vendor_id = $${++paramCount})`);
      queryParams.push(vendor_id);
    }

    if (search) {
      whereConditions.push(`(o.order_number ILIKE $${++paramCount} OR o.customer_name ILIKE $${++paramCount} OR o.customer_email ILIKE $${++paramCount})`);
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (date_from) {
      whereConditions.push(`o.order_date >= $${++paramCount}`);
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push(`o.order_date <= $${++paramCount}`);
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get orders
    const ordersQuery = `
      SELECT
        o.*,
        s.name as store_name,
        s.type as store_type,
        COALESCE(
          json_agg(
            json_build_object(
              'id', va.id,
              'vendor_id', va.vendor_id,
              'vendor_name', u.first_name || ' ' || u.last_name,
              'company_name', v.company_name,
              'status', va.status,
              'assigned_at', va.assigned_at
            )
          ) FILTER (WHERE va.id IS NOT NULL),
          '[]'::json
        ) as vendor_assignments
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      LEFT JOIN vendor_assignments va ON o.id = va.order_id
      LEFT JOIN vendors v ON va.vendor_id = v.id
      LEFT JOIN users u ON v.user_id = u.id
      WHERE ${whereClause}
      GROUP BY o.id, s.name, s.type
      ORDER BY o.order_date DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);

    const orders = await db.query(ordersQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      ${req.user.role === 'vendor' ? 'JOIN vendor_assignments va ON o.id = va.order_id' : ''}
      WHERE ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await db.query(countQuery, countParams);

    res.json({
      orders: orders.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error fetching orders' });
  }
});

// Get single order with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;

    let whereCondition = 'o.id = $1';
    let queryParams = [orderId];

    // Role-based access control
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      whereCondition += ' AND o.id IN (SELECT order_id FROM vendor_assignments WHERE vendor_id = $2)';
      queryParams.push(vendorQuery.rows[0].id);
    }

    // Get order with store info
    const orderQuery = `
      SELECT
        o.*,
        s.name as store_name,
        s.type as store_type,
        s.store_url
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      WHERE ${whereCondition}
    `;

    const orderResult = await db.query(orderQuery, queryParams);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsQuery = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);

    // Get vendor assignments
    const assignmentsQuery = `
      SELECT
        va.*,
        u.first_name || ' ' || u.last_name as vendor_name,
        v.company_name,
        u.email as vendor_email
      FROM vendor_assignments va
      JOIN vendors v ON va.vendor_id = v.id
      JOIN users u ON v.user_id = u.id
      WHERE va.order_id = $1
    `;

    const assignments = await db.query(assignmentsQuery, [orderId]);

    // Get status history
    const historyQuery = `
      SELECT
        osh.*,
        u.first_name || ' ' || u.last_name as changed_by_name
      FROM order_status_history osh
      LEFT JOIN users u ON osh.changed_by = u.id
      WHERE osh.order_id = $1
      ORDER BY osh.created_at DESC
    `;

    const history = await db.query(historyQuery, [orderId]);

    res.json({
      ...order,
      items: itemsQuery.rows,
      vendor_assignments: assignments.rows,
      status_history: history.rows
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Server error fetching order' });
  }
});

// Assign vendor to order
router.post('/:id/assign', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { vendor_id, assignment_type = 'full', items, notes } = req.body;

    // Check if order exists
    const orderQuery = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if vendor exists
    const vendorQuery = await db.query('SELECT * FROM vendors WHERE id = $1 AND is_approved = true', [vendor_id]);
    if (vendorQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Approved vendor not found' });
    }

    const order = orderQuery.rows[0];
    const vendor = vendorQuery.rows[0];

    // Calculate commission
    const commissionAmount = (order.total_amount * (vendor.commission_rate || 0)) / 100;

    // Create vendor assignment
    const assignmentQuery = await db.query(`
      INSERT INTO vendor_assignments (
        order_id, vendor_id, assigned_by, assignment_type, items,
        commission_amount, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'assigned')
      RETURNING *
    `, [
      orderId,
      vendor_id,
      req.user.id,
      assignment_type,
      items ? JSON.stringify(items) : null,
      commissionAmount,
      notes
    ]);

    // Add to status history
    await db.query(`
      INSERT INTO order_status_history (order_id, vendor_assignment_id, changed_by, new_status, notes)
      VALUES ($1, $2, $3, 'assigned', $4)
    `, [orderId, assignmentQuery.rows[0].id, req.user.id, `Assigned to ${vendor.company_name || 'vendor'}`]);

    // Create notification for vendor
    await db.query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'order_assignment', 'New Order Assignment', $2, $3)
    `, [
      vendor.user_id,
      `You have been assigned order #${order.order_number}`,
      JSON.stringify({ order_id: orderId, assignment_id: assignmentQuery.rows[0].id })
    ]);

    res.json({
      message: 'Vendor assigned successfully',
      assignment: assignmentQuery.rows[0]
    });

  } catch (error) {
    console.error('Assign vendor error:', error);
    res.status(500).json({ error: 'Server error assigning vendor' });
  }
});

// Update order status (by vendor)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, notes } = req.body;

    // Check if user has permission to update this order
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }

      const assignmentCheck = await db.query(
        'SELECT id FROM vendor_assignments WHERE order_id = $1 AND vendor_id = $2',
        [orderId, vendorQuery.rows[0].id]
      );

      if (assignmentCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to update this order' });
      }

      // Update vendor assignment status
      await db.query(
        'UPDATE vendor_assignments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE order_id = $2 AND vendor_id = $3',
        [status, orderId, vendorQuery.rows[0].id]
      );
    }

    // Get current order status
    const orderQuery = await db.query('SELECT order_status FROM orders WHERE id = $1', [orderId]);
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const oldStatus = orderQuery.rows[0].order_status;

    // Update order status
    await db.query(
      'UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [status, orderId]
    );

    // Add to status history
    await db.query(`
      INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [orderId, req.user.id, oldStatus, status, notes]);

    res.json({ message: 'Order status updated successfully' });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Server error updating order status' });
  }
});

module.exports = router;