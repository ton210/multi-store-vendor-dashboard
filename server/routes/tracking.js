const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const StoreIntegrationService = require('../services/storeIntegrationService');

const router = express.Router();
const storeService = new StoreIntegrationService();

// Add tracking information
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      order_id,
      vendor_assignment_id,
      tracking_number,
      carrier,
      tracking_url,
      notes
    } = req.body;

    // Verify user has access to this order
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }

      // Check if vendor is assigned to this order
      const assignmentCheck = await db.query(
        'SELECT 1 FROM vendor_assignments WHERE id = $1 AND vendor_id = $2',
        [vendor_assignment_id, vendorQuery.rows[0].id]
      );

      if (assignmentCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to add tracking for this order' });
      }
    }

    // Insert tracking info
    const trackingQuery = await db.query(`
      INSERT INTO order_tracking (
        order_id, vendor_assignment_id, tracking_number, carrier,
        tracking_url, shipped_date, status, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'shipped', $6, $7)
      RETURNING *
    `, [
      order_id,
      vendor_assignment_id,
      tracking_number,
      carrier,
      tracking_url,
      notes,
      req.user.id
    ]);

    // Update vendor assignment status
    await db.query(
      'UPDATE vendor_assignments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['shipped', vendor_assignment_id]
    );

    // Update order status if all assignments are shipped
    const pendingAssignments = await db.query(
      'SELECT COUNT(*) as count FROM vendor_assignments WHERE order_id = $1 AND status NOT IN ($2, $3)',
      [order_id, 'shipped', 'completed']
    );

    if (parseInt(pendingAssignments.rows[0].count) === 0) {
      await db.query(
        'UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['shipped', order_id]
      );

      // Sync tracking with external store
      await syncTrackingWithStore(order_id, tracking_number, carrier);
    }

    // Add status history
    await db.query(`
      INSERT INTO order_status_history (order_id, vendor_assignment_id, changed_by, new_status, notes)
      VALUES ($1, $2, $3, 'shipped', $4)
    `, [
      order_id,
      vendor_assignment_id,
      req.user.id,
      `Tracking added: ${carrier} ${tracking_number}`
    ]);

    res.json({
      message: 'Tracking information added successfully',
      tracking: trackingQuery.rows[0]
    });

  } catch (error) {
    console.error('Add tracking error:', error);
    res.status(500).json({ error: 'Server error adding tracking information' });
  }
});

// Get tracking information for order
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Check access permissions
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }

      const accessQuery = await db.query(
        'SELECT 1 FROM vendor_assignments WHERE order_id = $1 AND vendor_id = $2',
        [orderId, vendorQuery.rows[0].id]
      );

      if (accessQuery.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to view tracking for this order' });
      }
    }

    const trackingQuery = `
      SELECT
        ot.*,
        va.vendor_id,
        v.company_name,
        u.first_name || ' ' || u.last_name as vendor_name,
        created_user.first_name || ' ' || created_user.last_name as created_by_name
      FROM order_tracking ot
      LEFT JOIN vendor_assignments va ON ot.vendor_assignment_id = va.id
      LEFT JOIN vendors v ON va.vendor_id = v.id
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN users created_user ON ot.created_by = created_user.id
      WHERE ot.order_id = $1
      ORDER BY ot.created_at DESC
    `;

    const tracking = await db.query(trackingQuery, [orderId]);

    res.json({
      order_id: orderId,
      tracking: tracking.rows
    });

  } catch (error) {
    console.error('Get tracking error:', error);
    res.status(500).json({ error: 'Server error fetching tracking information' });
  }
});

// Update tracking status
router.put('/:trackingId', authenticateToken, async (req, res) => {
  try {
    const trackingId = req.params.trackingId;
    const { status, delivered_date, notes } = req.body;

    // Check if user has permission to update
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }

      const trackingQuery = await db.query(`
        SELECT ot.*, va.vendor_id
        FROM order_tracking ot
        JOIN vendor_assignments va ON ot.vendor_assignment_id = va.id
        WHERE ot.id = $1 AND va.vendor_id = $2
      `, [trackingId, vendorQuery.rows[0].id]);

      if (trackingQuery.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to update this tracking' });
      }
    }

    // Update tracking
    const updateQuery = await db.query(`
      UPDATE order_tracking
      SET status = $1, delivered_date = $2, notes = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [status, delivered_date, notes, trackingId]);

    if (updateQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Tracking not found' });
    }

    // If delivered, update vendor assignment
    if (status === 'delivered') {
      await db.query(
        'UPDATE vendor_assignments SET status = $1 WHERE id = $2',
        ['completed', updateQuery.rows[0].vendor_assignment_id]
      );
    }

    res.json({
      message: 'Tracking updated successfully',
      tracking: updateQuery.rows[0]
    });

  } catch (error) {
    console.error('Update tracking error:', error);
    res.status(500).json({ error: 'Server error updating tracking' });
  }
});

// Sync tracking with external store
async function syncTrackingWithStore(orderId, trackingNumber, carrier) {
  try {
    // Get order and store info
    const orderQuery = await db.query(`
      SELECT o.*, s.*
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      WHERE o.id = $1
    `, [orderId]);

    if (orderQuery.rows.length === 0) return;

    const order = orderQuery.rows[0];
    const service = storeService.getService(order);

    // Update tracking in external store
    if (order.type === 'shopify') {
      await syncShopifyTracking(service, order.external_order_id, trackingNumber, carrier);
    } else if (order.type === 'bigcommerce') {
      await syncBigCommerceTracking(service, order.external_order_id, trackingNumber, carrier);
    } else if (order.type === 'woocommerce') {
      await syncWooCommerceTracking(service, order.external_order_id, trackingNumber, carrier);
    }

  } catch (error) {
    console.error('Store tracking sync error:', error);
  }
}

async function syncShopifyTracking(service, orderId, trackingNumber, carrier) {
  try {
    // Create fulfillment with tracking
    await service.axiosInstance.post(`/orders/${orderId}/fulfillments.json`, {
      fulfillment: {
        tracking_number: trackingNumber,
        tracking_company: carrier,
        notify_customer: true
      }
    });
  } catch (error) {
    console.error('Shopify tracking sync error:', error);
  }
}

async function syncBigCommerceTracking(service, orderId, trackingNumber, carrier) {
  try {
    // Update order with tracking
    await service.axiosInstanceV2.put(`/orders/${orderId}`, {
      status_id: 2, // Shipped
      tracking_number: trackingNumber,
      tracking_carrier: carrier
    });
  } catch (error) {
    console.error('BigCommerce tracking sync error:', error);
  }
}

async function syncWooCommerceTracking(service, orderId, trackingNumber, carrier) {
  try {
    // Update order meta with tracking
    await service.axiosInstance.put(`/orders/${orderId}`, {
      status: 'completed',
      meta_data: [
        { key: '_tracking_number', value: trackingNumber },
        { key: '_tracking_carrier', value: carrier }
      ]
    });
  } catch (error) {
    console.error('WooCommerce tracking sync error:', error);
  }
}

module.exports = router;