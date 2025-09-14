const ShopifyService = require('./shopifyService');
const BigCommerceService = require('./bigcommerceService');
const WooCommerceService = require('./woocommerceService');
const db = require('../config/database');

class StoreIntegrationService {
  constructor() {
    this.services = new Map();
  }

  getService(store) {
    if (!this.services.has(store.id)) {
      let service;

      switch (store.type) {
        case 'shopify':
          service = new ShopifyService(store);
          break;
        case 'bigcommerce':
          service = new BigCommerceService(store);
          break;
        case 'woocommerce':
          service = new WooCommerceService(store);
          break;
        default:
          throw new Error(`Unsupported store type: ${store.type}`);
      }

      this.services.set(store.id, service);
    }

    return this.services.get(store.id);
  }

  async syncStoreOrders(storeId) {
    try {
      // Get store configuration
      const storeQuery = await db.query('SELECT * FROM stores WHERE id = $1 AND is_active = true', [storeId]);
      if (storeQuery.rows.length === 0) {
        throw new Error('Store not found or inactive');
      }

      const store = storeQuery.rows[0];
      const service = this.getService(store);

      // Get last sync date
      const lastSync = store.last_sync_at ? new Date(store.last_sync_at).toISOString() : null;

      // Fetch orders from the store with retry logic
      console.log(`Syncing store ${store.name} (${store.type}) - Last sync: ${lastSync}`);

      let orders;
      try {
        orders = await service.getOrders(lastSync);
        console.log(`Fetched ${orders.length} orders from ${store.name}`);
      } catch (fetchError) {
        console.error(`Failed to fetch orders from ${store.name}:`, fetchError.message);
        return {
          success: false,
          error: `Failed to fetch orders: ${fetchError.message}`,
          store_name: store.name
        };
      }

      let syncedOrders = 0;
      let errors = [];

      for (const orderData of orders) {
        try {
          await this.saveOrder(storeId, orderData);
          syncedOrders++;
        } catch (error) {
          console.error(`Error saving order ${orderData.external_order_id}:`, error.message);
          errors.push({
            order_id: orderData.external_order_id,
            error: error.message
          });
        }
      }

      // Update last sync time
      await db.query(
        'UPDATE stores SET last_sync_at = CURRENT_TIMESTAMP WHERE id = $1',
        [storeId]
      );

      return {
        success: true,
        store_name: store.name,
        synced_orders: syncedOrders,
        total_orders: orders.length,
        errors
      };

    } catch (error) {
      console.error('Store sync error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async saveOrder(storeId, orderData) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Insert or update order
      const orderInsertQuery = `
        INSERT INTO orders (
          store_id, external_order_id, order_number, customer_email, customer_name,
          customer_phone, billing_address, shipping_address, total_amount, currency,
          order_status, fulfillment_status, payment_status, notes, tags, order_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (store_id, external_order_id)
        DO UPDATE SET
          order_number = EXCLUDED.order_number,
          customer_email = EXCLUDED.customer_email,
          customer_name = EXCLUDED.customer_name,
          customer_phone = EXCLUDED.customer_phone,
          billing_address = EXCLUDED.billing_address,
          shipping_address = EXCLUDED.shipping_address,
          total_amount = EXCLUDED.total_amount,
          currency = EXCLUDED.currency,
          order_status = EXCLUDED.order_status,
          fulfillment_status = EXCLUDED.fulfillment_status,
          payment_status = EXCLUDED.payment_status,
          notes = EXCLUDED.notes,
          tags = EXCLUDED.tags,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const orderResult = await client.query(orderInsertQuery, [
        storeId,
        orderData.external_order_id,
        orderData.order_number,
        orderData.customer_email,
        orderData.customer_name,
        orderData.customer_phone,
        JSON.stringify(orderData.billing_address),
        JSON.stringify(orderData.shipping_address),
        orderData.total_amount,
        orderData.currency,
        orderData.order_status,
        orderData.fulfillment_status,
        orderData.payment_status,
        orderData.notes,
        orderData.tags,
        orderData.order_date
      ]);

      const orderId = orderResult.rows[0].id;

      // Delete existing order items
      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

      // Insert order items
      for (const item of orderData.items) {
        await client.query(`
          INSERT INTO order_items (
            order_id, external_item_id, product_name, sku, quantity,
            unit_price, total_price, variant_title, product_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          orderId,
          item.external_item_id,
          item.product_name,
          item.sku,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.variant_title,
          JSON.stringify(item.product_data)
        ]);
      }

      await client.query('COMMIT');
      return orderId;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateOrderStatus(storeId, orderId, status) {
    try {
      // Get store configuration
      const storeQuery = await db.query('SELECT * FROM stores WHERE id = $1', [storeId]);
      if (storeQuery.rows.length === 0) {
        throw new Error('Store not found');
      }

      const store = storeQuery.rows[0];

      // Get order
      const orderQuery = await db.query('SELECT * FROM orders WHERE id = $1 AND store_id = $2', [orderId, storeId]);
      if (orderQuery.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderQuery.rows[0];
      const service = this.getService(store);

      // Update status in external system
      await service.updateOrderStatus(order.external_order_id, status);

      // Update local database
      await db.query(
        'UPDATE orders SET order_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [status, orderId]
      );

      return { success: true };

    } catch (error) {
      console.error('Update order status error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async syncAllStores() {
    try {
      const storesQuery = await db.query('SELECT id FROM stores WHERE is_active = true AND sync_enabled = true');
      const results = [];

      for (const store of storesQuery.rows) {
        const result = await this.syncStoreOrders(store.id);
        results.push({ store_id: store.id, ...result });
      }

      return results;
    } catch (error) {
      console.error('Sync all stores error:', error);
      throw error;
    }
  }
}

module.exports = StoreIntegrationService;