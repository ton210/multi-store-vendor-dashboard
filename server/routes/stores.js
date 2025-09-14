const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const StoreIntegrationService = require('../services/storeIntegrationService');

const router = express.Router();
const storeService = new StoreIntegrationService();

// Get all stores
router.get('/', authenticateToken, async (req, res) => {
  try {
    const stores = await db.query('SELECT * FROM stores ORDER BY created_at DESC');
    res.json(stores.rows);
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ error: 'Server error fetching stores' });
  }
});

// Add new store
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, type, store_url, api_credentials } = req.body;

    // Validate required fields
    if (!name || !type || !store_url || !api_credentials) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate store type
    if (!['shopify', 'bigcommerce', 'woocommerce'].includes(type)) {
      return res.status(400).json({ error: 'Invalid store type' });
    }

    // Insert store
    const storeQuery = await db.query(`
      INSERT INTO stores (name, type, store_url, api_credentials)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, type, store_url, JSON.stringify(api_credentials)]);

    res.status(201).json({
      message: 'Store added successfully',
      store: storeQuery.rows[0]
    });

  } catch (error) {
    console.error('Add store error:', error);
    res.status(500).json({ error: 'Server error adding store' });
  }
});

// Update store
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const storeId = req.params.id;
    const { name, type, store_url, api_credentials, is_active, sync_enabled } = req.body;

    const updateQuery = await db.query(`
      UPDATE stores
      SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        store_url = COALESCE($3, store_url),
        api_credentials = COALESCE($4, api_credentials),
        is_active = COALESCE($5, is_active),
        sync_enabled = COALESCE($6, sync_enabled),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [
      name,
      type,
      store_url,
      api_credentials ? JSON.stringify(api_credentials) : null,
      is_active,
      sync_enabled,
      storeId
    ]);

    if (updateQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json({
      message: 'Store updated successfully',
      store: updateQuery.rows[0]
    });

  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({ error: 'Server error updating store' });
  }
});

// Delete store
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const storeId = req.params.id;

    // Check if store has orders
    const orderCheck = await db.query('SELECT COUNT(*) as count FROM orders WHERE store_id = $1', [storeId]);
    if (parseInt(orderCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete store with existing orders' });
    }

    const deleteQuery = await db.query('DELETE FROM stores WHERE id = $1 RETURNING *', [storeId]);

    if (deleteQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json({ message: 'Store deleted successfully' });

  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ error: 'Server error deleting store' });
  }
});

// Sync store orders
router.post('/:id/sync', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const storeId = req.params.id;

    const result = await storeService.syncStoreOrders(storeId);

    if (result.success) {
      res.json({
        message: 'Store sync completed successfully',
        ...result
      });
    } else {
      res.status(400).json({
        error: 'Store sync failed',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Sync store error:', error);
    res.status(500).json({ error: 'Server error syncing store' });
  }
});

// Sync all stores
router.post('/sync-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const results = await storeService.syncAllStores();

    res.json({
      message: 'All stores sync completed',
      results
    });

  } catch (error) {
    console.error('Sync all stores error:', error);
    res.status(500).json({ error: 'Server error syncing all stores' });
  }
});

// Test store connection
router.post('/:id/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const storeId = req.params.id;

    const storeQuery = await db.query('SELECT * FROM stores WHERE id = $1', [storeId]);
    if (storeQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const store = storeQuery.rows[0];
    const service = storeService.getService(store);

    // Try to fetch a small number of orders to test connection
    await service.getOrders(null, 1);

    res.json({ message: 'Store connection successful' });

  } catch (error) {
    console.error('Test store connection error:', error);
    res.status(400).json({
      error: 'Store connection failed',
      details: error.message
    });
  }
});

module.exports = router;