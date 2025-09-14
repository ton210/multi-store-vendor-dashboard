const axios = require('axios');

class BigCommerceService {
  constructor(storeConfig) {
    this.storeHash = storeConfig.api_credentials.store_hash || storeConfig.api_credentials.BC_STORE_HASH;
    this.accessToken = storeConfig.api_credentials.access_token || storeConfig.api_credentials.bc_access_token || storeConfig.api_credentials.BC_ACCESS_TOKEN;

    this.axiosInstance = axios.create({
      baseURL: `https://api.bigcommerce.com/stores/${this.storeHash}/v2`,
      headers: {
        'X-Auth-Token': this.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  async getOrders(since = null, limit = 250) {
    try {
      const params = {
        limit,
        sort: 'date_created:desc'
      };

      if (since) {
        params.min_date_created = since;
      }

      const response = await this.axiosInstance.get('/orders', { params });
      const orders = await Promise.all(
        response.data.map(order => this.getOrderWithItems(order.id))
      );

      return orders;
    } catch (error) {
      console.error('BigCommerce API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch orders from BigCommerce: ${error.message}`);
    }
  }

  async getOrder(orderId) {
    try {
      return await this.getOrderWithItems(orderId);
    } catch (error) {
      console.error('BigCommerce API Error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch order ${orderId} from BigCommerce: ${error.message}`);
    }
  }

  async getOrderWithItems(orderId) {
    try {
      const [orderResponse, itemsResponse] = await Promise.all([
        this.axiosInstance.get(`/orders/${orderId}`),
        this.axiosInstance.get(`/orders/${orderId}/products`)
      ]);

      const order = orderResponse.data;
      const items = itemsResponse.data;

      return this.transformOrder(order, items);
    } catch (error) {
      throw error;
    }
  }

  async updateOrderStatus(orderId, status) {
    try {
      let statusId;

      // Map status to BigCommerce status IDs
      switch (status.toLowerCase()) {
        case 'pending': statusId = 1; break;
        case 'shipped': statusId = 2; break;
        case 'partially_shipped': statusId = 3; break;
        case 'refunded': statusId = 4; break;
        case 'cancelled': statusId = 5; break;
        case 'declined': statusId = 6; break;
        case 'awaiting_payment': statusId = 7; break;
        case 'awaiting_pickup': statusId = 8; break;
        case 'awaiting_shipment': statusId = 9; break;
        case 'completed': statusId = 10; break;
        case 'awaiting_fulfillment': statusId = 11; break;
        default: statusId = 1;
      }

      const response = await this.axiosInstance.put(`/orders/${orderId}`, {
        status_id: statusId
      });

      const items = await this.axiosInstance.get(`/orders/${orderId}/products`);
      return this.transformOrder(response.data, items.data);
    } catch (error) {
      console.error('BigCommerce API Error:', error.response?.data || error.message);
      throw new Error(`Failed to update order ${orderId} in BigCommerce: ${error.message}`);
    }
  }

  transformOrder(bcOrder, items = []) {
    return {
      external_order_id: bcOrder.id.toString(),
      order_number: bcOrder.id.toString(),
      customer_email: bcOrder.billing_address?.email,
      customer_name: `${bcOrder.billing_address?.first_name || ''} ${bcOrder.billing_address?.last_name || ''}`.trim(),
      customer_phone: bcOrder.billing_address?.phone,
      billing_address: bcOrder.billing_address,
      shipping_address: bcOrder.shipping_addresses?.[0],
      total_amount: parseFloat(bcOrder.total_inc_tax || bcOrder.total_ex_tax),
      currency: bcOrder.currency_code || 'USD',
      order_status: this.getOrderStatus(bcOrder.status_id),
      fulfillment_status: bcOrder.status === 'Shipped' ? 'fulfilled' : 'unfulfilled',
      payment_status: bcOrder.payment_status || 'pending',
      notes: bcOrder.customer_message || bcOrder.staff_notes,
      tags: '',
      order_date: new Date(bcOrder.date_created),
      items: items.map(item => ({
        external_item_id: item.id.toString(),
        product_name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: parseFloat(item.base_price),
        total_price: parseFloat(item.total_inc_tax || item.total_ex_tax),
        variant_title: item.product_options?.map(opt => `${opt.display_name}: ${opt.display_value}`).join(', ') || '',
        product_data: {
          product_id: item.product_id,
          order_address_id: item.order_address_id,
          type: item.type,
          product_options: item.product_options
        }
      }))
    };
  }

  getOrderStatus(statusId) {
    const statuses = {
      1: 'pending',
      2: 'shipped',
      3: 'partially_shipped',
      4: 'refunded',
      5: 'cancelled',
      6: 'declined',
      7: 'awaiting_payment',
      8: 'awaiting_pickup',
      9: 'awaiting_shipment',
      10: 'completed',
      11: 'awaiting_fulfillment'
    };

    return statuses[statusId] || 'pending';
  }
}

module.exports = BigCommerceService;