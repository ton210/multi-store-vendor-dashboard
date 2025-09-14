const axios = require('axios');
const db = require('../config/database');

class SlackService {
  constructor() {
    this.defaultWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  async getSlackConfig() {
    try {
      const configQuery = await db.query(
        'SELECT setting_value FROM system_settings WHERE setting_key = $1',
        ['slack_config']
      );

      if (configQuery.rows.length > 0) {
        return configQuery.rows[0].setting_value;
      }

      return {
        enabled: false,
        webhook_url: this.defaultWebhookUrl || '',
        channels: {}
      };
    } catch (error) {
      console.error('Failed to get Slack config:', error);
      return { enabled: false };
    }
  }

  async sendNotification(type, data, channelOverride = null) {
    try {
      const config = await this.getSlackConfig();

      if (!config.enabled) {
        console.log('Slack notifications disabled');
        return { success: false, reason: 'disabled' };
      }

      const webhookUrl = channelOverride || config.webhook_url;
      if (!webhookUrl) {
        console.log('No Slack webhook URL configured');
        return { success: false, reason: 'no_webhook' };
      }

      const message = this.formatMessage(type, data);

      const response = await axios.post(webhookUrl, message, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log('Slack notification sent:', type);
      return { success: true, response: response.status };

    } catch (error) {
      console.error('Slack notification error:', error.message);
      return { success: false, error: error.message };
    }
  }

  formatMessage(type, data) {
    const baseMessage = {
      username: 'Vendor Dashboard',
      icon_emoji: ':package:'
    };

    switch (type) {
      case 'new_order':
        return {
          ...baseMessage,
          text: `:new: *New Order Received*`,
          attachments: [{
            color: '#36a64f',
            fields: [
              { title: 'Order Number', value: `#${data.order_number}`, short: true },
              { title: 'Customer', value: data.customer_name, short: true },
              { title: 'Total', value: `$${data.total_amount}`, short: true },
              { title: 'Store', value: data.store_name, short: true }
            ],
            footer: 'Multi-Store Vendor Dashboard',
            ts: Math.floor(Date.now() / 1000)
          }]
        };

      case 'order_assigned':
        return {
          ...baseMessage,
          text: `:handshake: *Order Assigned to Vendor*`,
          attachments: [{
            color: '#ffcc00',
            fields: [
              { title: 'Order Number', value: `#${data.order_number}`, short: true },
              { title: 'Vendor', value: data.vendor_name, short: true },
              { title: 'Assignment Type', value: data.assignment_type, short: true },
              { title: 'Commission', value: `$${data.commission_amount}`, short: true }
            ],
            footer: 'Multi-Store Vendor Dashboard',
            ts: Math.floor(Date.now() / 1000)
          }]
        };

      case 'order_split':
        return {
          ...baseMessage,
          text: `:scissors: *Order Split Among Multiple Vendors*`,
          attachments: [{
            color: '#ff9900',
            fields: [
              { title: 'Order Number', value: `#${data.order_number}`, short: true },
              { title: 'Split Count', value: `${data.splits_count} vendors`, short: true },
              { title: 'Total Amount', value: `$${data.total_amount}`, short: true },
              { title: 'Assigned Amount', value: `$${data.assigned_amount}`, short: true }
            ],
            footer: 'Multi-Store Vendor Dashboard',
            ts: Math.floor(Date.now() / 1000)
          }]
        };

      case 'tracking_added':
        return {
          ...baseMessage,
          text: `:truck: *Tracking Information Added*`,
          attachments: [{
            color: '#0099cc',
            fields: [
              { title: 'Order Number', value: `#${data.order_number}`, short: true },
              { title: 'Tracking Number', value: data.tracking_number, short: true },
              { title: 'Carrier', value: data.carrier, short: true },
              { title: 'Vendor', value: data.vendor_name, short: true }
            ],
            actions: data.tracking_url ? [{
              type: 'button',
              text: 'Track Package',
              url: data.tracking_url,
              style: 'primary'
            }] : [],
            footer: 'Multi-Store Vendor Dashboard',
            ts: Math.floor(Date.now() / 1000)
          }]
        };

      case 'order_completed':
        return {
          ...baseMessage,
          text: `:white_check_mark: *Order Completed*`,
          attachments: [{
            color: '#00cc44',
            fields: [
              { title: 'Order Number', value: `#${data.order_number}`, short: true },
              { title: 'Customer', value: data.customer_name, short: true },
              { title: 'Total Earned', value: `$${data.total_commission}`, short: true },
              { title: 'Completion Time', value: data.completion_time, short: true }
            ],
            footer: 'Multi-Store Vendor Dashboard',
            ts: Math.floor(Date.now() / 1000)
          }]
        };

      case 'vendor_message':
        return {
          ...baseMessage,
          text: `:speech_balloon: *New Vendor Message*`,
          attachments: [{
            color: '#cc0099',
            fields: [
              { title: 'From', value: data.sender_name, short: true },
              { title: 'Subject', value: data.subject || 'No subject', short: true },
              { title: 'Order', value: data.order_number ? `#${data.order_number}` : 'General', short: true }
            ],
            text: data.message.substring(0, 200) + (data.message.length > 200 ? '...' : ''),
            footer: 'Multi-Store Vendor Dashboard',
            ts: Math.floor(Date.now() / 1000)
          }]
        };

      case 'system_alert':
        return {
          ...baseMessage,
          text: `:warning: *System Alert*`,
          attachments: [{
            color: '#ff0000',
            fields: [
              { title: 'Alert Type', value: data.alert_type, short: true },
              { title: 'Severity', value: data.severity, short: true }
            ],
            text: data.message,
            footer: 'Multi-Store Vendor Dashboard',
            ts: Math.floor(Date.now() / 1000)
          }]
        };

      default:
        return {
          ...baseMessage,
          text: data.message || 'Notification from Vendor Dashboard'
        };
    }
  }

  // Specific notification methods
  async notifyNewOrder(orderData) {
    return await this.sendNotification('new_order', orderData);
  }

  async notifyOrderAssigned(assignmentData) {
    return await this.sendNotification('order_assigned', assignmentData);
  }

  async notifyOrderSplit(splitData) {
    return await this.sendNotification('order_split', splitData);
  }

  async notifyTrackingAdded(trackingData) {
    return await this.sendNotification('tracking_added', trackingData);
  }

  async notifyOrderCompleted(completionData) {
    return await this.sendNotification('order_completed', completionData);
  }

  async notifyVendorMessage(messageData) {
    return await this.sendNotification('vendor_message', messageData);
  }

  async notifySystemAlert(alertData) {
    return await this.sendNotification('system_alert', alertData);
  }

  async updateSlackConfig(config, userId) {
    try {
      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value, updated_by)
        VALUES ('slack_config', $1, $2)
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      `, [JSON.stringify(config), userId]);

      return { success: true };
    } catch (error) {
      console.error('Failed to update Slack config:', error);
      return { success: false, error: error.message };
    }
  }

  async testSlackConnection(webhookUrl) {
    try {
      const testMessage = {
        text: ':white_check_mark: Slack integration test successful!',
        username: 'Vendor Dashboard',
        icon_emoji: ':package:',
        attachments: [{
          color: '#36a64f',
          text: 'Your Multi-Store Vendor Dashboard is now connected to Slack.',
          footer: 'Multi-Store Vendor Dashboard',
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      const response = await axios.post(webhookUrl, testMessage, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      return { success: true, status: response.status };
    } catch (error) {
      console.error('Slack test error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SlackService;