const axios = require('axios');

class BigCommerceService {
  constructor(storeConfig) {
    this.storeHash = storeConfig.api_credentials.store_hash || storeConfig.api_credentials.BC_STORE_HASH;
    this.accessToken = storeConfig.api_credentials.access_token || storeConfig.api_credentials.bc_access_token || storeConfig.api_credentials.BC_ACCESS_TOKEN;

    console.log('BigCommerce Config:', {
      storeHash: this.storeHash,
      hasToken: !!this.accessToken,
      tokenLength: this.accessToken?.length
    });

    this.axiosInstance = axios.create({
      baseURL: `https://api.bigcommerce.com/stores/${this.storeHash}/v3`,
      headers: {
        'X-Auth-Token': this.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });
  }

  async checkScopes() {
    // Test different endpoints to determine available scopes
    const testEndpoints = [
      { path: '/store', scope: 'store_v2_information_read_only' },
      { path: '/orders', scope: 'store_v2_orders_read_only' },
      { path: '/products', scope: 'store_v2_products_read_only' }
    ];

    const availableScopes = [];

    for (const endpoint of testEndpoints) {
      try {
        await this.axiosInstance.get(`${endpoint.path}?limit=1`);
        availableScopes.push(endpoint.scope);
        console.log(`✅ ${endpoint.scope} - Available`);
      } catch (error) {
        console.log(`❌ ${endpoint.scope} - Not available (${error.response?.status})`);
      }
    }

    return availableScopes;
  }

  async getOrders(since = null, limit = 50) {
    try {
      // First, let's check what scopes are available
      console.log('Checking available API scopes...');
      const scopes = await this.checkScopes();
      console.log('Available scopes:', scopes);

      // If we don't have orders scope, throw a helpful error
      if (!scopes.includes('store_v2_orders_read_only')) {
        throw new Error('Missing required OAuth scope: store_v2_orders_read_only. Please update your BigCommerce API account permissions.');
      }

      const params = {
        limit: Math.min(limit, 50),
        sort: 'date_created',
        direction: 'desc'
      };

      if (since) {
        params.min_date_created = since;
      }

      console.log('Fetching orders with params:', params);

      const response = await this.axiosInstance.get('/orders', { params });
      console.log('BigCommerce orders response:', response.data?.length || 0, 'orders');

      // Process orders (simplified to avoid rate limits)
      const orders = response.data || [];
      const transformedOrders = orders.map(order => this.transformOrder(order, []));

      return transformedOrders;
    } catch (error) {
      console.error('BigCommerce API Error:', error.response?.data || error.message);
      console.error('Request config:', error.config?.url, error.config?.headers);

      if (error.response?.status === 403) {
        throw new Error(`BigCommerce API Permission Error: Your API token lacks required OAuth scopes. Please add 'Orders - Read' permission to your BigCommerce API account. Error: ${error.response?.data?.title || 'Authentication Required'}`);
      }

      throw new Error(`Failed to fetch orders from BigCommerce: ${error.response?.status || error.message}`);
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
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));

      const orderResponse = await this.axiosInstance.get(`/orders/${orderId}`);

      // Add delay before getting items
      await new Promise(resolve => setTimeout(resolve, 50));

      const itemsResponse = await this.axiosInstance.get(`/orders/${orderId}/products`);

      const order = orderResponse.data;
      const items = itemsResponse.data;

      return this.transformOrder(order, items);
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error.response?.status, error.response?.data);
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
    const processingStatus = this.getProcessingStatus(bcOrder.status_id);

    return {
      external_order_id: bcOrder.id.toString(),
      order_number: bcOrder.id.toString(),
      customer_email: bcOrder.billing_address?.email,
      customer_name: `${bcOrder.billing_address?.first_name || ''} ${bcOrder.billing_address?.last_name || ''}`.trim(),
      customer_phone: bcOrder.billing_address?.phone,
      billing_address: bcOrder.billing_address,
      shipping_address: bcOrder.shipping_addresses?.[0],
      total_amount: parseFloat(bcOrder.total_inc_tax || bcOrder.total_ex_tax || 0),
      currency: bcOrder.currency_code || 'USD',
      order_status: processingStatus,
      fulfillment_status: processingStatus === 'SHIPPED' ? 'fulfilled' : 'unfulfilled',
      payment_status: bcOrder.payment_status || 'pending',
      notes: bcOrder.customer_message || bcOrder.staff_notes || '',
      tags: bcOrder.status_id ? `status_${bcOrder.status_id}` : '',
      order_date: new Date(bcOrder.date_created),
      items: items.map(item => ({
        external_item_id: item.id.toString(),
        product_name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: parseFloat(item.base_price || item.price || 0),
        total_price: parseFloat(item.total_inc_tax || item.total_ex_tax || 0),
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
      0: 'incomplete',
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
      11: 'awaiting_fulfillment',
      12: 'manual_verification_required',
      13: 'disputed',
      14: 'partially_refunded'
    };

    return statuses[statusId] || 'pending';
  }

  getProcessingStatus(statusId) {
    // Map to our internal processing statuses
    const processingStatuses = {
      0: 'DRAFT',
      1: 'PROCESSING',
      2: 'SHIPPED',
      3: 'SHIPPED',
      4: 'SHIPPED',
      5: 'CANCELLED',
      6: 'CANCELLED',
      7: 'PROCESSING',
      8: 'PROCESSING',
      9: 'PROCESSING',
      10: 'SHIPPED',
      11: 'PROCESSING',
      12: 'PROCESSING',
      13: 'PROCESSING',
      14: 'SHIPPED'
    };

    return processingStatuses[statusId] || 'PROCESSING';
  }
}

module.exports = BigCommerceService;