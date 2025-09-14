const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// Split order to multiple vendors
router.post('/:orderId/split', authenticateToken, requireAdminOrManager, async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const orderId = req.params.orderId;
    const { splits } = req.body; // Array of { vendor_id, items: [{ item_id, quantity }], notes }

    // Validate order exists
    const orderQuery = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderQuery.rows.length === 0) {
      throw new Error('Order not found');
    }

    const order = orderQuery.rows[0];

    // Remove existing assignments for this order
    await client.query('DELETE FROM vendor_assignments WHERE order_id = $1', [orderId]);

    let totalAssignedAmount = 0;

    // Create new split assignments
    for (const split of splits) {
      const { vendor_id, items, notes } = split;

      // Calculate split amount
      let splitAmount = 0;
      for (const item of items) {
        const itemQuery = await client.query(
          'SELECT unit_price FROM order_items WHERE id = $1 AND order_id = $2',
          [item.item_id, orderId]
        );
        if (itemQuery.rows.length > 0) {
          splitAmount += itemQuery.rows[0].unit_price * item.quantity;
        }
      }

      // Get vendor commission rate
      const vendorQuery = await client.query('SELECT commission_rate FROM vendors WHERE id = $1', [vendor_id]);
      const commissionRate = vendorQuery.rows[0]?.commission_rate || 0;
      const commissionAmount = (splitAmount * commissionRate) / 100;

      // Create vendor assignment
      const assignmentQuery = await client.query(`
        INSERT INTO vendor_assignments (
          order_id, vendor_id, assigned_by, assignment_type,
          commission_amount, notes, status
        )
        VALUES ($1, $2, $3, 'partial', $4, $5, 'assigned')
        RETURNING id
      `, [orderId, vendor_id, req.user.id, commissionAmount, notes]);

      const assignmentId = assignmentQuery.rows[0].id;

      // Create item assignments
      for (const item of items) {
        await client.query(`
          INSERT INTO order_item_assignments (
            vendor_assignment_id, order_item_id, quantity, assigned_amount
          )
          VALUES ($1, $2, $3, $4)
        `, [
          assignmentId,
          item.item_id,
          item.quantity,
          item.quantity * (await client.query('SELECT unit_price FROM order_items WHERE id = $1', [item.item_id])).rows[0].unit_price
        ]);
      }

      totalAssignedAmount += splitAmount;

      // Create notification for vendor
      const vendorUserQuery = await client.query('SELECT user_id FROM vendors WHERE id = $1', [vendor_id]);
      if (vendorUserQuery.rows.length > 0) {
        await client.query(`
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES ($1, 'order_split_assignment', 'Order Split Assignment', $2, $3)
        `, [
          vendorUserQuery.rows[0].user_id,
          `You have been assigned items from order #${order.order_number}`,
          JSON.stringify({ order_id: orderId, assignment_id: assignmentId, split_amount: splitAmount })
        ]);
      }
    }

    // Add status history
    await client.query(`
      INSERT INTO order_status_history (order_id, changed_by, new_status, notes)
      VALUES ($1, $2, 'split_assigned', $3)
    `, [
      orderId,
      req.user.id,
      `Order split among ${splits.length} vendors. Total assigned: $${totalAssignedAmount.toFixed(2)}`
    ]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Order split successfully',
      splits_created: splits.length,
      total_assigned: totalAssignedAmount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Order splitting error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get order split preview
router.post('/:orderId/split-preview', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { splits } = req.body;

    // Get order items
    const itemsQuery = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    const items = itemsQuery.rows;

    // Calculate preview
    const preview = {
      total_order_amount: 0,
      total_assigned_amount: 0,
      splits: []
    };

    for (const item of items) {
      preview.total_order_amount += parseFloat(item.total_price);
    }

    for (const split of splits) {
      let splitAmount = 0;
      const splitItems = [];

      for (const assignedItem of split.items) {
        const item = items.find(i => i.id === assignedItem.item_id);
        if (item) {
          const itemAmount = item.unit_price * assignedItem.quantity;
          splitAmount += itemAmount;
          splitItems.push({
            ...item,
            assigned_quantity: assignedItem.quantity,
            assigned_amount: itemAmount
          });
        }
      }

      // Get vendor info
      const vendorQuery = await db.query(`
        SELECT v.*, u.first_name, u.last_name
        FROM vendors v
        JOIN users u ON v.user_id = u.id
        WHERE v.id = $1
      `, [split.vendor_id]);

      const vendor = vendorQuery.rows[0];
      const commissionAmount = vendor ? (splitAmount * vendor.commission_rate) / 100 : 0;

      preview.splits.push({
        vendor: vendor ? `${vendor.first_name} ${vendor.last_name}` : 'Unknown',
        company: vendor?.company_name || '',
        commission_rate: vendor?.commission_rate || 0,
        split_amount: splitAmount,
        commission_amount: commissionAmount,
        items: splitItems
      });

      preview.total_assigned_amount += splitAmount;
    }

    preview.unassigned_amount = preview.total_order_amount - preview.total_assigned_amount;

    res.json(preview);

  } catch (error) {
    console.error('Split preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order split details
router.get('/:orderId/splits', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const splitsQuery = `
      SELECT
        va.*,
        v.company_name,
        u.first_name || ' ' || u.last_name as vendor_name,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id', oia.order_item_id,
              'product_name', oi.product_name,
              'sku', oi.sku,
              'assigned_quantity', oia.quantity,
              'assigned_amount', oia.assigned_amount
            )
          ) FILTER (WHERE oia.id IS NOT NULL),
          '[]'::json
        ) as assigned_items
      FROM vendor_assignments va
      JOIN vendors v ON va.vendor_id = v.id
      JOIN users u ON v.user_id = u.id
      LEFT JOIN order_item_assignments oia ON va.id = oia.vendor_assignment_id
      LEFT JOIN order_items oi ON oia.order_item_id = oi.id
      WHERE va.order_id = $1
      GROUP BY va.id, v.company_name, u.first_name, u.last_name
    `;

    const splits = await db.query(splitsQuery, [orderId]);

    res.json({
      order_id: orderId,
      splits: splits.rows
    });

  } catch (error) {
    console.error('Get order splits error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;