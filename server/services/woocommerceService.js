const axios = require('axios');

class WooCommerceService {
  constructor(storeConfig) {
    this.siteUrl = storeConfig.store_url;
    this.consumerKey = storeConfig.api_credentials.consumer_key;
    this.consumerSecret = storeConfig.api_credentials.consumer_secret;

    this.axiosInstance = axios.create({
      baseURL: `${this.siteUrl}/wp-json/wc/v3`,
      auth: {
        username: this.consumerKey,
        password: this.consumerSecret
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getOrders(since = null, limit = 100) {
    try {
      const params = {
        per_page: limit,
        orderby: 'date',
        order: 'desc'
      };

      if (since) {
        params.after = since;
      }

      const response = await this.axiosInstance.get('/orders', { params });
      return response.data.map(order => this.transformOrder(order));
    } catch (error) {
      console.error('WooCommerce API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch orders from WooCommerce: ${error.message}`);
    }
  }

  async getOrder(orderId) {
    try {
      const response = await this.axiosInstance.get(`/orders/${orderId}`);
      return this.transformOrder(response.data);
    } catch (error) {
      console.error('WooCommerce API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch order ${orderId} from WooCommerce: ${error.message}`);
    }
  }

  async updateOrderStatus(orderId, status) {
    try {
      let wcStatus;

      // Map status to WooCommerce statuses
      switch (status.toLowerCase()) {
        case 'pending': wcStatus = 'pending'; break;
        case 'processing': wcStatus = 'processing'; break;
        case 'on_hold': wcStatus = 'on-hold'; break;
        case 'completed': wcStatus = 'completed'; break;
        case 'cancelled': wcStatus = 'cancelled'; break;
        case 'refunded': wcStatus = 'refunded'; break;
        case 'failed': wcStatus = 'failed'; break;
        default: wcStatus = 'processing';
      }

      const response = await this.axiosInstance.put(`/orders/${orderId}`, {
        status: wcStatus
      });

      return this.transformOrder(response.data);
    } catch (error) {
      console.error('WooCommerce API Error:', error.response?.data || error.message);
      throw new Error(`Failed to update order ${orderId} in WooCommerce: ${error.message}`);
    }
  }

  transformOrder(wcOrder) {
    return {
      external_order_id: wcOrder.id.toString(),
      order_number: wcOrder.number,
      customer_email: wcOrder.billing?.email,
      customer_name: `${wcOrder.billing?.first_name || ''} ${wcOrder.billing?.last_name || ''}`.trim(),
      customer_phone: wcOrder.billing?.phone,
      billing_address: wcOrder.billing,
      shipping_address: wcOrder.shipping,
      total_amount: parseFloat(wcOrder.total),
      currency: wcOrder.currency,
      order_status: wcOrder.status,
      fulfillment_status: wcOrder.status === 'completed' ? 'fulfilled' : 'unfulfilled',
      payment_status: wcOrder.status === 'processing' || wcOrder.status === 'completed' ? 'paid' : 'pending',
      notes: wcOrder.customer_note,
      tags: wcOrder.meta_data?.find(meta => meta.key === '_tags')?.value || '',
      order_date: new Date(wcOrder.date_created),
      items: wcOrder.line_items.map(item => ({
        external_item_id: item.id.toString(),
        product_name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: parseFloat(item.price),
        total_price: parseFloat(item.total),
        variant_title: item.variation_id ?
          item.meta_data?.map(meta => `${meta.display_key}: ${meta.display_value}`).join(', ') : '',
        product_data: {
          product_id: item.product_id,
          variation_id: item.variation_id,
          meta_data: item.meta_data,
          tax_class: item.tax_class
        }
      }))
    };
  }
}

module.exports = WooCommerceService;