const axios = require('axios');

class ShopifyService {
  constructor(storeConfig) {
    this.storeUrl = storeConfig.store_url;
    this.apiCredentials = storeConfig.api_credentials;
    this.axiosInstance = axios.create({
      baseURL: `https://${this.storeUrl}.myshopify.com/admin/api/2023-10`,
      headers: {
        'X-Shopify-Access-Token': this.apiCredentials.access_token,
        'Content-Type': 'application/json'
      }
    });
  }

  async getOrders(since = null, limit = 250) {
    try {
      const params = {
        limit,
        status: 'any',
        financial_status: 'any',
        fulfillment_status: 'any'
      };

      if (since) {
        params.created_at_min = since;
      }

      const response = await this.axiosInstance.get('/orders.json', { params });
      return response.data.orders.map(order => this.transformOrder(order));
    } catch (error) {
      console.error('Shopify API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch orders from Shopify: ${error.message}`);
    }
  }

  async getOrder(orderId) {
    try {
      const response = await this.axiosInstance.get(`/orders/${orderId}.json`);
      return this.transformOrder(response.data.order);
    } catch (error) {
      console.error('Shopify API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch order ${orderId} from Shopify: ${error.message}`);
    }
  }

  async updateOrderStatus(orderId, status, fulfillmentStatus = null) {
    try {
      const updateData = {};

      if (fulfillmentStatus) {
        // Create fulfillment if needed
        const fulfillmentData = {
          fulfillment: {
            location_id: this.apiCredentials.location_id,
            tracking_number: null,
            notify_customer: true
          }
        };
        await this.axiosInstance.post(`/orders/${orderId}/fulfillments.json`, fulfillmentData);
      }

      const response = await this.axiosInstance.put(`/orders/${orderId}.json`, {
        order: updateData
      });

      return this.transformOrder(response.data.order);
    } catch (error) {
      console.error('Shopify API Error:', error.response?.data || error.message);
      throw new Error(`Failed to update order ${orderId} in Shopify: ${error.message}`);
    }
  }

  transformOrder(shopifyOrder) {
    return {
      external_order_id: shopifyOrder.id.toString(),
      order_number: shopifyOrder.order_number || shopifyOrder.name,
      customer_email: shopifyOrder.email,
      customer_name: `${shopifyOrder.billing_address?.first_name || ''} ${shopifyOrder.billing_address?.last_name || ''}`.trim(),
      customer_phone: shopifyOrder.billing_address?.phone || shopifyOrder.shipping_address?.phone,
      billing_address: shopifyOrder.billing_address,
      shipping_address: shopifyOrder.shipping_address,
      total_amount: parseFloat(shopifyOrder.total_price),
      currency: shopifyOrder.currency,
      order_status: shopifyOrder.financial_status,
      fulfillment_status: shopifyOrder.fulfillment_status,
      payment_status: shopifyOrder.financial_status,
      notes: shopifyOrder.note,
      tags: shopifyOrder.tags,
      order_date: new Date(shopifyOrder.created_at),
      items: shopifyOrder.line_items.map(item => ({
        external_item_id: item.id.toString(),
        product_name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: parseFloat(item.price),
        total_price: parseFloat(item.price) * item.quantity,
        variant_title: item.variant_title,
        product_data: {
          product_id: item.product_id,
          variant_id: item.variant_id,
          vendor: item.vendor,
          properties: item.properties
        }
      }))
    };
  }
}

module.exports = ShopifyService;