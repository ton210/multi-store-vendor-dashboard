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
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Search,
  FilterList,
  Visibility,
  Assignment,
  Message,
  Sync,
  GetApp
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    store_id: '',
    date_from: '',
    date_to: ''
  });

  // Dialog states
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [assignVendorOpen, setAssignVendorOpen] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');

  // Stores for filter dropdown
  const [stores, setStores] = useState([]);

  useEffect(() => {
    loadOrders();
    loadStores();
    if (user?.role === 'admin' || user?.role === 'manager') {
      loadVendors();
    }
  }, [pagination.page, filters]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });

      const response = await axios.get(`/orders?${params}`);
      setOrders(response.data.orders);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const response = await axios.get('/stores');
      setStores(response.data);
    } catch (error) {
      console.error('Failed to load stores:', error);
    }
  };

  const loadVendors = async () => {
    try {
      const response = await axios.get('/vendors');
      setVendors(response.data.vendors);
    } catch (error) {
      console.error('Failed to load vendors:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (event, page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setOrderDetailsOpen(true);
  };

  const handleAssignVendor = (order) => {
    setSelectedOrder(order);
    setAssignVendorOpen(true);
  };

  const submitVendorAssignment = async () => {
    try {
      await axios.post(`/orders/${selectedOrder.id}/assign`, {
        vendor_id: selectedVendor,
        assignment_type: 'full',
        notes: 'Assigned via dashboard'
      });
      setAssignVendorOpen(false);
      setSelectedVendor('');
      loadOrders();
    } catch (error) {
      console.error('Failed to assign vendor:', error);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`/orders/${orderId}/status`, {
        status,
        notes: `Status updated to ${status} via dashboard`
      });
      loadOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'warning',
      processing: 'info',
      completed: 'success',
      cancelled: 'error',
      assigned: 'primary',
      in_progress: 'secondary'
    };
    return colors[status] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Orders Management
        </Typography>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Sync />}
              onClick={() => {/* TODO: Sync all stores */}}
            >
              Sync All Stores
            </Button>
            <Button
              variant="outlined"
              startIcon={<GetApp />}
              onClick={() => {/* TODO: Export orders */}}
            >
              Export
            </Button>
          </Box>
        )}
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Search Orders"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Store</InputLabel>
                <Select
                  value={filters.store_id}
                  onChange={(e) => handleFilterChange('store_id', e.target.value)}
                  label="Store"
                >
                  <MenuItem value="">All Stores</MenuItem>
                  {stores.map((store) => (
                    <MenuItem key={store.id} value={store.id}>
                      {store.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField
                fullWidth
                label="Date From"
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField
                fullWidth
                label="Date To"
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Store</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                {user?.role === 'vendor' && <TableCell>Assignment</TableCell>}
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">Loading orders...</TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">No orders found</TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        #{order.order_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{order.customer_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.customer_email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.store_name}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(order.total_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.order_status}
                        color={getStatusColor(order.order_status)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(order.order_date), 'MMM dd, yyyy')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(order.order_date), 'HH:mm')}
                      </Typography>
                    </TableCell>
                    {user?.role === 'vendor' && (
                      <TableCell>
                        {order.vendor_assignments?.length > 0 ? (
                          <Chip
                            label={order.vendor_assignments[0].status}
                            color={getStatusColor(order.vendor_assignments[0].status)}
                            size="small"
                            sx={{ textTransform: 'capitalize' }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Not assigned
                          </Typography>
                        )}
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewOrder(order)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        {(user?.role === 'admin' || user?.role === 'manager') && (
                          <Tooltip title="Assign Vendor">
                            <IconButton size="small" onClick={() => handleAssignVendor(order)}>
                              <Assignment />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Message">
                          <IconButton size="small">
                            <Message />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={pagination.pages}
              page={pagination.page}
              onChange={handlePageChange}
              color="primary"
            />
          </Box>
        )}
      </Card>

      {/* Order Details Dialog */}
      <Dialog
        open={orderDetailsOpen}
        onClose={() => setOrderDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Order Details - #{selectedOrder?.order_number}
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Customer Information</Typography>
                <Typography><strong>Name:</strong> {selectedOrder.customer_name}</Typography>
                <Typography><strong>Email:</strong> {selectedOrder.customer_email}</Typography>
                <Typography><strong>Phone:</strong> {selectedOrder.customer_phone || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Order Information</Typography>
                <Typography><strong>Total:</strong> {formatCurrency(selectedOrder.total_amount)}</Typography>
                <Typography><strong>Status:</strong> {selectedOrder.order_status}</Typography>
                <Typography><strong>Date:</strong> {format(new Date(selectedOrder.order_date), 'PPp')}</Typography>
              </Grid>
              {selectedOrder.vendor_assignments?.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>Vendor Assignments</Typography>
                  {selectedOrder.vendor_assignments.map((assignment, index) => (
                    <Box key={index} sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                      <Typography><strong>Vendor:</strong> {assignment.vendor_name}</Typography>
                      <Typography><strong>Status:</strong> {assignment.status}</Typography>
                      <Typography><strong>Assigned:</strong> {format(new Date(assignment.assigned_at), 'PPp')}</Typography>
                    </Box>
                  ))}
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {user?.role === 'vendor' && selectedOrder && (
            <>
              <Button onClick={() => updateOrderStatus(selectedOrder.id, 'in_progress')} color="primary">
                Mark In Progress
              </Button>
              <Button onClick={() => updateOrderStatus(selectedOrder.id, 'completed')} color="success">
                Mark Completed
              </Button>
            </>
          )}
          <Button onClick={() => setOrderDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Assign Vendor Dialog */}
      <Dialog
        open={assignVendorOpen}
        onClose={() => setAssignVendorOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assign Vendor to Order #{selectedOrder?.order_number}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Vendor</InputLabel>
            <Select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              label="Select Vendor"
            >
              {vendors.map((vendor) => (
                <MenuItem key={vendor.id} value={vendor.id}>
                  {vendor.company_name || `${vendor.first_name} ${vendor.last_name}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignVendorOpen(false)}>Cancel</Button>
          <Button
            onClick={submitVendorAssignment}
            variant="contained"
            disabled={!selectedVendor}
          >
            Assign Vendor
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Orders;