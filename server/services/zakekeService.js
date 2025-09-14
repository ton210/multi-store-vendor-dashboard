const axios = require('axios');
const db = require('../config/database');

class ZakekeService {
  constructor() {
    this.apiBaseUrl = 'https://api.zakeke.com';
    this.tokenUrl = 'https://api.zakeke.com/token';
  }

  async getZakekeConfig() {
    try {
      const configQuery = await db.query(
        'SELECT setting_value FROM system_settings WHERE setting_key = $1',
        ['zakeke_config']
      );

      if (configQuery.rows.length > 0) {
        return configQuery.rows[0].setting_value;
      }

      return {
        enabled: false,
        client_id: '',
        client_secret: '',
        api_url: this.apiBaseUrl
      };
    } catch (error) {
      console.error('Failed to get Zakeke config:', error);
      return { enabled: false };
    }
  }

  async getAccessToken() {
    try {
      const config = await this.getZakekeConfig();

      if (!config.enabled || !config.client_id || !config.client_secret) {
        throw new Error('Zakeke API not configured');
      }

      // Check for cached token
      const tokenQuery = await db.query(
        'SELECT setting_value FROM system_settings WHERE setting_key = $1',
        ['zakeke_access_token']
      );

      let tokenData = null;
      if (tokenQuery.rows.length > 0) {
        tokenData = tokenQuery.rows[0].setting_value;

        // Check if token is still valid (expires in 1 hour typically)
        if (tokenData.expires_at && new Date(tokenData.expires_at) > new Date()) {
          return tokenData.access_token;
        }
      }

      // Get new token
      const payload = {
        grant_type: 'client_credentials',
        access_type: 'S2S'
      };

      const authHeader = 'Basic ' + Buffer.from(
        `${config.client_id}:${config.client_secret}`
      ).toString('base64');

      const response = await axios.post(this.tokenUrl, payload, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 20000
      });

      const newTokenData = {
        access_token: response.data.access_token,
        expires_at: new Date(Date.now() + (response.data.expires_in * 1000)).toISOString()
      };

      // Cache the token
      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES ('zakeke_access_token', $1)
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
      `, [JSON.stringify(newTokenData)]);

      return newTokenData.access_token;

    } catch (error) {
      console.error('Zakeke token error:', error.response?.data || error.message);
      throw new Error(`Failed to get Zakeke access token: ${error.message}`);
    }
  }

  async getOrderCustomizations(zakekeOrderId) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(`${this.apiBaseUrl}/orders/${zakekeOrderId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        timeout: 20000
      });

      return response.data;
    } catch (error) {
      console.error('Zakeke get order error:', error.response?.data || error.message);
      throw new Error(`Failed to get Zakeke order: ${error.message}`);
    }
  }

  async getOrderArtwork(zakekeOrderId, artworkId = null) {
    try {
      const accessToken = await this.getAccessToken();

      const endpoint = artworkId
        ? `${this.apiBaseUrl}/orders/${zakekeOrderId}/artwork/${artworkId}`
        : `${this.apiBaseUrl}/orders/${zakekeOrderId}/artwork`;

      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      console.error('Zakeke get artwork error:', error.response?.data || error.message);
      throw new Error(`Failed to get Zakeke artwork: ${error.message}`);
    }
  }

  async syncZakekeOrder(orderId, zakekeOrderId) {
    try {
      // Get Zakeke order details
      const zakekeOrder = await this.getOrderCustomizations(zakekeOrderId);

      // Get artwork files
      let artworkFiles = [];
      try {
        artworkFiles = await this.getOrderArtwork(zakekeOrderId);
      } catch (artworkError) {
        console.log('No artwork found for order:', zakekeOrderId);
      }

      // Save to database
      await db.query(`
        INSERT INTO zakeke_orders (
          order_id, zakeke_order_id, customization_data, design_files, artwork_status
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (order_id)
        DO UPDATE SET
          customization_data = $3,
          design_files = $4,
          artwork_status = $5,
          synced_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [
        orderId,
        zakekeOrderId,
        JSON.stringify(zakekeOrder),
        JSON.stringify(artworkFiles),
        artworkFiles.length > 0 ? 'ready' : 'pending'
      ]);

      return {
        success: true,
        customizations: zakekeOrder,
        artwork_files: artworkFiles
      };

    } catch (error) {
      console.error('Zakeke sync error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async detectZakekeOrder(orderData) {
    try {
      // Check if order has Zakeke customization data
      const indicators = [
        'zakeke',
        'customization',
        'personalization',
        'custom design'
      ];

      // Check order notes, items, or metadata for Zakeke indicators
      const orderText = `
        ${orderData.notes || ''}
        ${orderData.items?.map(item => item.product_name).join(' ') || ''}
        ${JSON.stringify(orderData.items?.map(item => item.product_data) || [])}
      `.toLowerCase();

      const hasZakekeIndicators = indicators.some(indicator =>
        orderText.includes(indicator)
      );

      if (hasZakekeIndicators) {
        // Look for Zakeke order ID in the order data
        const zakekeOrderIdMatch = orderText.match(/zakeke[_-]?order[_-]?id[:\s]*([a-z0-9-]+)/i);

        if (zakekeOrderIdMatch) {
          return {
            is_zakeke_order: true,
            zakeke_order_id: zakekeOrderIdMatch[1]
          };
        }

        return {
          is_zakeke_order: true,
          zakeke_order_id: null,
          needs_manual_link: true
        };
      }

      return {
        is_zakeke_order: false
      };

    } catch (error) {
      console.error('Zakeke detection error:', error);
      return { is_zakeke_order: false };
    }
  }

  async downloadArtworkFiles(zakekeOrderId, orderId) {
    try {
      const artworkFiles = await this.getOrderArtwork(zakekeOrderId);
      const downloadedFiles = [];

      for (const artwork of artworkFiles) {
        if (artwork.download_url) {
          try {
            // Download file
            const fileResponse = await axios.get(artwork.download_url, {
              responseType: 'stream',
              timeout: 60000
            });

            const filename = `zakeke_${zakekeOrderId}_${artwork.id}_${Date.now()}.${artwork.format || 'png'}`;
            const filePath = `/uploads/zakeke/${filename}`;

            // In a real implementation, you'd save this to file system or cloud storage
            // For now, we'll just store the metadata

            await db.query(`
              INSERT INTO order_attachments (
                order_id, filename, original_filename, file_path,
                file_type, mime_type, uploaded_by
              )
              VALUES ($1, $2, $3, $4, 'design', $5, NULL)
            `, [
              orderId,
              filename,
              artwork.original_name || filename,
              filePath,
              artwork.mime_type || 'image/png'
            ]);

            downloadedFiles.push({
              filename,
              original_name: artwork.original_name,
              format: artwork.format,
              download_url: artwork.download_url
            });

          } catch (downloadError) {
            console.error(`Failed to download artwork ${artwork.id}:`, downloadError.message);
          }
        }
      }

      return downloadedFiles;

    } catch (error) {
      console.error('Zakeke artwork download error:', error);
      throw error;
    }
  }

  async updateZakekeConfig(config, userId) {
    try {
      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value, updated_by)
        VALUES ('zakeke_config', $1, $2)
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      `, [JSON.stringify(config), userId]);

      return { success: true };
    } catch (error) {
      console.error('Failed to update Zakeke config:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ZakekeService;