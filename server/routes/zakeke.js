const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const ZakekeService = require('../services/zakekeService');

const router = express.Router();
const zakekeService = new ZakekeService();

// Get Zakeke configuration
router.get('/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = await zakekeService.getZakekeConfig();

    // Don't expose sensitive data
    const publicConfig = {
      enabled: config.enabled,
      has_credentials: !!(config.client_id && config.client_secret),
      api_url: config.api_url
    };

    res.json(publicConfig);
  } catch (error) {
    console.error('Get Zakeke config error:', error);
    res.status(500).json({ error: 'Server error fetching Zakeke configuration' });
  }
});

// Update Zakeke configuration
router.put('/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { enabled, client_id, client_secret, api_url } = req.body;

    const config = {
      enabled: !!enabled,
      client_id: client_id || '',
      client_secret: client_secret || '',
      api_url: api_url || 'https://api.zakeke.com'
    };

    const result = await zakekeService.updateZakekeConfig(config, req.user.id);

    if (result.success) {
      res.json({ message: 'Zakeke configuration updated successfully' });
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    console.error('Update Zakeke config error:', error);
    res.status(500).json({ error: 'Server error updating Zakeke configuration' });
  }
});

// Test Zakeke connection
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const token = await zakekeService.getAccessToken();
    res.json({
      success: true,
      message: 'Zakeke connection successful',
      has_token: !!token
    });
  } catch (error) {
    console.error('Zakeke test error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Sync order with Zakeke
router.post('/sync/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { zakeke_order_id } = req.body;

    if (!zakeke_order_id) {
      return res.status(400).json({ error: 'Zakeke order ID is required' });
    }

    // Check if user has permission
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
        return res.status(403).json({ error: 'Not authorized for this order' });
      }
    }

    const result = await zakekeService.syncZakekeOrder(orderId, zakeke_order_id);

    if (result.success) {
      // Download artwork files if available
      if (result.artwork_files.length > 0) {
        try {
          const downloadedFiles = await zakekeService.downloadArtworkFiles(zakeke_order_id, orderId);
          result.downloaded_files = downloadedFiles;
        } catch (downloadError) {
          console.error('Artwork download error:', downloadError);
          result.download_error = downloadError.message;
        }
      }

      // Add to order history
      await db.query(`
        INSERT INTO order_status_history (order_id, changed_by, new_status, notes)
        VALUES ($1, $2, 'zakeke_synced', $3)
      `, [
        orderId,
        req.user.id,
        `Zakeke order synced: ${zakeke_order_id}. ${result.artwork_files.length} artwork files found.`
      ]);

      res.json({
        message: 'Zakeke order synced successfully',
        ...result
      });
    } else {
      res.status(400).json({
        error: 'Failed to sync Zakeke order',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Zakeke sync error:', error);
    res.status(500).json({ error: 'Server error syncing Zakeke order' });
  }
});

// Auto-detect Zakeke orders
router.post('/detect/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Get order data
    const orderQuery = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderQuery.rows[0];

    // Get order items
    const itemsQuery = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);

    const orderData = {
      ...order,
      items: itemsQuery.rows
    };

    const detection = await zakekeService.detectZakekeOrder(orderData);

    res.json({
      order_id: orderId,
      ...detection
    });

  } catch (error) {
    console.error('Zakeke detection error:', error);
    res.status(500).json({ error: 'Server error detecting Zakeke order' });
  }
});

// Get Zakeke order details
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Check permissions
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
        return res.status(403).json({ error: 'Not authorized for this order' });
      }
    }

    const zakekeQuery = await db.query('SELECT * FROM zakeke_orders WHERE order_id = $1', [orderId]);

    if (zakekeQuery.rows.length === 0) {
      return res.status(404).json({ error: 'No Zakeke data found for this order' });
    }

    const zakekeOrder = zakekeQuery.rows[0];

    res.json({
      order_id: orderId,
      zakeke_order_id: zakekeOrder.zakeke_order_id,
      customization_data: zakekeOrder.customization_data,
      design_files: zakekeOrder.design_files,
      artwork_status: zakekeOrder.artwork_status,
      synced_at: zakekeOrder.synced_at
    });

  } catch (error) {
    console.error('Get Zakeke order error:', error);
    res.status(500).json({ error: 'Server error fetching Zakeke order' });
  }
});

// Refresh Zakeke order data
router.post('/refresh/:orderId', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Get existing Zakeke order
    const zakekeQuery = await db.query('SELECT zakeke_order_id FROM zakeke_orders WHERE order_id = $1', [orderId]);
    if (zakekeQuery.rows.length === 0) {
      return res.status(404).json({ error: 'No Zakeke order found to refresh' });
    }

    const zakekeOrderId = zakekeQuery.rows[0].zakeke_order_id;

    // Re-sync with latest data
    const result = await zakekeService.syncZakekeOrder(orderId, zakekeOrderId);

    if (result.success) {
      res.json({
        message: 'Zakeke order refreshed successfully',
        ...result
      });
    } else {
      res.status(400).json({
        error: 'Failed to refresh Zakeke order',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Zakeke refresh error:', error);
    res.status(500).json({ error: 'Server error refreshing Zakeke order' });
  }
});

// Get all Zakeke orders with statistics
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, artwork_status } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    if (artwork_status) {
      whereConditions.push(`zo.artwork_status = $${++paramCount}`);
      queryParams.push(artwork_status);
    }

    // If vendor, filter to their orders
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }
      whereConditions.push(`o.id IN (SELECT order_id FROM vendor_assignments WHERE vendor_id = $${++paramCount})`);
      queryParams.push(vendorQuery.rows[0].id);
    }

    const whereClause = whereConditions.join(' AND ');

    const zakekeOrdersQuery = `
      SELECT
        zo.*,
        o.order_number,
        o.customer_name,
        o.total_amount,
        o.order_date,
        s.name as store_name
      FROM zakeke_orders zo
      JOIN orders o ON zo.order_id = o.id
      JOIN stores s ON o.store_id = s.id
      WHERE ${whereClause}
      ORDER BY zo.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);

    const zakekeOrders = await db.query(zakekeOrdersQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM zakeke_orders zo
      JOIN orders o ON zo.order_id = o.id
      WHERE ${whereClause}
    `;

    const countParams = queryParams.slice(0, -2);
    const countResult = await db.query(countQuery, countParams);

    res.json({
      zakeke_orders: zakekeOrders.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get Zakeke orders error:', error);
    res.status(500).json({ error: 'Server error fetching Zakeke orders' });
  }
});

module.exports = router;