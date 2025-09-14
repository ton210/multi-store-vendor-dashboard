import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Sync,
  Science,
  Settings,
  Store as StoreIcon,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Stores = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [syncingStore, setSyncingStore] = useState(null);
  const [testingStore, setTestingStore] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    store_url: '',
    api_credentials: {
      // Shopify
      access_token: '',
      // BigCommerce
      bc_access_token: '',
      store_hash: '',
      // WooCommerce
      consumer_key: '',
      consumer_secret: ''
    },
    is_active: true,
    sync_enabled: true
  });

  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/stores');
      setStores(response.data);
    } catch (error) {
      console.error('Failed to load stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStore = () => {
    setEditingStore(null);
    setFormData({
      name: '',
      type: '',
      store_url: '',
      api_credentials: {
        access_token: '',
        bc_access_token: '',
        store_hash: '',
        consumer_key: '',
        consumer_secret: ''
      },
      is_active: true,
      sync_enabled: true
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleEditStore = (store) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      type: store.type,
      store_url: store.store_url,
      api_credentials: store.api_credentials,
      is_active: store.is_active,
      sync_enabled: store.sync_enabled
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleFormChange = (field, value) => {
    if (field.startsWith('api_credentials.')) {
      const credentialField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        api_credentials: {
          ...prev.api_credentials,
          [credentialField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Store name is required';
    if (!formData.type) newErrors.type = 'Store type is required';
    if (!formData.store_url.trim()) newErrors.store_url = 'Store URL is required';

    // Validate API credentials based on store type
    if (formData.type === 'shopify') {
      if (!formData.api_credentials.access_token.trim()) {
        newErrors.access_token = 'Access token is required for Shopify';
      }
    } else if (formData.type === 'bigcommerce') {
      if (!formData.api_credentials.bc_access_token.trim()) {
        newErrors.bc_access_token = 'Access token is required for BigCommerce';
      }
      if (!formData.api_credentials.store_hash.trim()) {
        newErrors.store_hash = 'Store hash is required for BigCommerce';
      }
    } else if (formData.type === 'woocommerce') {
      if (!formData.api_credentials.consumer_key.trim()) {
        newErrors.consumer_key = 'Consumer key is required for WooCommerce';
      }
      if (!formData.api_credentials.consumer_secret.trim()) {
        newErrors.consumer_secret = 'Consumer secret is required for WooCommerce';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitLoading(true);
    try {
      if (editingStore) {
        await axios.put(`/stores/${editingStore.id}`, formData);
      } else {
        await axios.post('/stores', formData);
      }
      setDialogOpen(false);
      loadStores();
    } catch (error) {
      console.error('Failed to save store:', error);
      setErrors({ submit: error.response?.data?.error || 'Failed to save store' });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteStore = async (storeId) => {
    if (!window.confirm('Are you sure you want to delete this store? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`/stores/${storeId}`);
      loadStores();
    } catch (error) {
      console.error('Failed to delete store:', error);
      alert('Failed to delete store: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSyncStore = async (storeId) => {
    setSyncingStore(storeId);
    try {
      const response = await axios.post(`/stores/${storeId}/sync`);
      alert(`Sync completed: ${response.data.synced_orders} orders synced`);
      loadStores();
    } catch (error) {
      console.error('Failed to sync store:', error);
      alert('Failed to sync store: ' + (error.response?.data?.error || error.message));
    } finally {
      setSyncingStore(null);
    }
  };

  const handleTestConnection = async (storeId) => {
    setTestingStore(storeId);
    try {
      await axios.post(`/stores/${storeId}/test`);
      alert('Connection test successful!');
    } catch (error) {
      console.error('Connection test failed:', error);
      alert('Connection test failed: ' + (error.response?.data?.details || error.message));
    } finally {
      setTestingStore(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      const response = await axios.post('/stores/sync-all');
      const totalSynced = response.data.results.reduce((sum, result) => sum + (result.synced_orders || 0), 0);
      alert(`All stores synced: ${totalSynced} total orders synced`);
      loadStores();
    } catch (error) {
      console.error('Failed to sync all stores:', error);
      alert('Failed to sync all stores: ' + error.message);
    }
  };

  const getStoreIcon = (type) => {
    const icons = {
      shopify: '🛍️',
      bigcommerce: '🏪',
      woocommerce: '🛒'
    };
    return icons[type] || '🏬';
  };

  const getLastSyncStatus = (store) => {
    if (!store.last_sync_at) {
      return { text: 'Never synced', color: 'error' };
    }

    const lastSync = new Date(store.last_sync_at);
    const now = new Date();
    const hoursAgo = (now - lastSync) / (1000 * 60 * 60);

    if (hoursAgo < 1) {
      return { text: 'Recently synced', color: 'success' };
    } else if (hoursAgo < 24) {
      return { text: `${Math.floor(hoursAgo)}h ago`, color: 'warning' };
    } else {
      return { text: `${Math.floor(hoursAgo / 24)}d ago`, color: 'error' };
    }
  };

  const renderApiCredentialsFields = () => {
    switch (formData.type) {
      case 'shopify':
        return (
          <TextField
            fullWidth
            label="Access Token"
            value={formData.api_credentials.access_token || ''}
            onChange={(e) => handleFormChange('api_credentials.access_token', e.target.value)}
            error={!!errors.access_token}
            helperText={errors.access_token || 'Private app access token from Shopify admin'}
            margin="normal"
          />
        );

      case 'bigcommerce':
        return (
          <>
            <TextField
              fullWidth
              label="Access Token"
              value={formData.api_credentials.bc_access_token || ''}
              onChange={(e) => handleFormChange('api_credentials.bc_access_token', e.target.value)}
              error={!!errors.bc_access_token}
              helperText={errors.bc_access_token || 'Your BigCommerce API access token'}
              margin="normal"
              placeholder="e.g., lmg7prm3b0fxypwwaja27rtlvqejic0"
            />
            <TextField
              fullWidth
              label="Store Hash"
              value={formData.api_credentials.store_hash || ''}
              onChange={(e) => handleFormChange('api_credentials.store_hash', e.target.value)}
              error={!!errors.store_hash}
              helperText={errors.store_hash || 'Your BigCommerce store hash'}
              margin="normal"
              placeholder="e.g., tqjrceegho"
            />
          </>
        );

      case 'woocommerce':
        return (
          <>
            <TextField
              fullWidth
              label="Consumer Key"
              value={formData.api_credentials.consumer_key || ''}
              onChange={(e) => handleFormChange('api_credentials.consumer_key', e.target.value)}
              error={!!errors.consumer_key}
              helperText={errors.consumer_key}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Consumer Secret"
              value={formData.api_credentials.consumer_secret || ''}
              onChange={(e) => handleFormChange('api_credentials.consumer_secret', e.target.value)}
              error={!!errors.consumer_secret}
              helperText={errors.consumer_secret}
              margin="normal"
            />
          </>
        );

      default:
        return null;
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Access denied. Admin privileges required.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Store Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Sync />}
            onClick={handleSyncAll}
            disabled={loading}
          >
            Sync All
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddStore}
          >
            Add Store
          </Button>
        </Box>
      </Box>

      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Store</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Sync Status</TableCell>
                <TableCell>Last Sync</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">Loading stores...</TableCell>
                </TableRow>
              ) : stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Box sx={{ py: 4 }}>
                      <StoreIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="body1" color="text.secondary">
                        No stores configured yet. Add your first store to get started.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                stores.map((store) => {
                  const syncStatus = getLastSyncStatus(store);
                  return (
                    <TableRow key={store.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span style={{ fontSize: '1.2em' }}>{getStoreIcon(store.type)}</span>
                          <Typography variant="body2" fontWeight="bold">
                            {store.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={store.type}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {store.store_url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {store.is_active ? (
                            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                          ) : (
                            <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />
                          )}
                          <Typography variant="body2">
                            {store.is_active ? 'Active' : 'Inactive'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={store.sync_enabled ? 'Enabled' : 'Disabled'}
                          size="small"
                          color={store.sync_enabled ? 'success' : 'default'}
                          variant={store.sync_enabled ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={syncStatus.text}
                          size="small"
                          color={syncStatus.color}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="Edit Store">
                            <IconButton size="small" onClick={() => handleEditStore(store)}>
                              <Edit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Test Connection">
                            <IconButton
                              size="small"
                              onClick={() => handleTestConnection(store.id)}
                              disabled={testingStore === store.id}
                            >
                              {testingStore === store.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <Science />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Sync Orders">
                            <IconButton
                              size="small"
                              onClick={() => handleSyncStore(store.id)}
                              disabled={syncingStore === store.id}
                            >
                              {syncingStore === store.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <Sync />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Store">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteStore(store.id)}
                              color="error"
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Add/Edit Store Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingStore ? 'Edit Store' : 'Add New Store'}
        </DialogTitle>
        <DialogContent>
          {errors.submit && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.submit}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Store Name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal" error={!!errors.type}>
                <InputLabel>Store Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                  label="Store Type"
                >
                  <MenuItem value="shopify">Shopify</MenuItem>
                  <MenuItem value="bigcommerce">BigCommerce</MenuItem>
                  <MenuItem value="woocommerce">WooCommerce</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Store URL"
                value={formData.store_url}
                onChange={(e) => handleFormChange('store_url', e.target.value)}
                error={!!errors.store_url}
                helperText={errors.store_url || 'Full URL to your store (e.g., https://mystore.myshopify.com)'}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                API Credentials
              </Typography>
              {renderApiCredentialsFields()}
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => handleFormChange('is_active', e.target.checked)}
                  />
                }
                label="Store Active"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.sync_enabled}
                    onChange={(e) => handleFormChange('sync_enabled', e.target.checked)}
                  />
                }
                label="Auto-sync Enabled"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={submitLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitLoading}
            startIcon={submitLoading ? <CircularProgress size={16} /> : null}
          >
            {submitLoading ? 'Saving...' : (editingStore ? 'Update' : 'Add Store')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Stores;