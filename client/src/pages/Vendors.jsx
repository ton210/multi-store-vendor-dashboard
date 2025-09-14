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
  Grid,
  IconButton,
  Tooltip,
  Avatar,
  Switch,
  FormControlLabel,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tabs,
  Tab,
  Alert,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  Person,
  Edit,
  Visibility,
  CheckCircle,
  Cancel,
  TrendingUp,
  AttachMoney,
  Assignment,
  Message,
  Phone,
  Email,
  Business
} from '@mui/icons-material';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Vendors = () => {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // Filters and pagination
  const [filters, setFilters] = useState({
    status: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });

  // Vendor details data
  const [vendorDetails, setVendorDetails] = useState(null);
  const [vendorMetrics, setVendorMetrics] = useState(null);

  // Edit form data
  const [editFormData, setEditFormData] = useState({
    commission_rate: 0
  });

  useEffect(() => {
    loadVendors();
  }, [pagination.page, filters]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });

      const response = await axios.get(`/vendors?${params}`);
      setVendors(response.data.vendors);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
    } catch (error) {
      console.error('Failed to load vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorDetails = async (vendorId) => {
    try {
      const response = await axios.get(`/vendors/${vendorId}`);
      setVendorDetails(response.data);
    } catch (error) {
      console.error('Failed to load vendor details:', error);
    }
  };

  const loadVendorMetrics = async (vendorId) => {
    try {
      const response = await axios.get(`/vendors/${vendorId}/metrics`);
      setVendorMetrics(response.data);
    } catch (error) {
      console.error('Failed to load vendor metrics:', error);
    }
  };

  const handleViewVendor = async (vendor) => {
    setSelectedVendor(vendor);
    setDetailsOpen(true);
    setTabValue(0);
    await Promise.all([
      loadVendorDetails(vendor.id),
      loadVendorMetrics(vendor.id)
    ]);
  };

  const handleEditVendor = (vendor) => {
    setSelectedVendor(vendor);
    setEditFormData({
      commission_rate: vendor.commission_rate || 0
    });
    setEditOpen(true);
  };

  const handleApproveVendor = async (vendorId, isApproved) => {
    try {
      await axios.put(`/vendors/${vendorId}/approval`, {
        is_approved: isApproved,
        notes: isApproved ? 'Approved via dashboard' : 'Rejected via dashboard'
      });
      loadVendors();
    } catch (error) {
      console.error('Failed to update vendor approval:', error);
    }
  };

  const handleUpdateCommission = async () => {
    try {
      await axios.put(`/vendors/${selectedVendor.id}/commission`, {
        commission_rate: editFormData.commission_rate
      });
      setEditOpen(false);
      loadVendors();
    } catch (error) {
      console.error('Failed to update commission rate:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getVendorStatusColor = (isApproved) => {
    return isApproved ? 'success' : 'warning';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getPerformanceColor = (percentage) => {
    if (percentage >= 90) return 'success';
    if (percentage >= 70) return 'warning';
    return 'error';
  };

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Access denied. Admin or Manager privileges required.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Vendor Management
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search Vendors"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name, email, or company..."
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Vendors</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="pending">Pending Approval</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircle sx={{ mr: 0.5, fontSize: 16, color: 'success.main' }} />
                  Approved: {vendors.filter(v => v.is_approved).length}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Cancel sx={{ mr: 0.5, fontSize: 16, color: 'warning.main' }} />
                  Pending: {vendors.filter(v => !v.is_approved).length}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Commission</TableCell>
                <TableCell>Orders</TableCell>
                <TableCell>Earnings</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">Loading vendors...</TableCell>
                </TableRow>
              ) : vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Box sx={{ py: 4 }}>
                      <Person sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="body1" color="text.secondary">
                        No vendors found
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                vendors.map((vendor) => (
                  <TableRow key={vendor.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {getInitials(vendor.first_name, vendor.last_name)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {vendor.first_name} {vendor.last_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {vendor.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {vendor.company_name || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {vendor.phone || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={vendor.is_approved ? 'Approved' : 'Pending'}
                        color={getVendorStatusColor(vendor.is_approved)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {vendor.commission_rate}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {vendor.total_orders || 0} total
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {vendor.completed_orders || 0} completed
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(vendor.total_earnings)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(vendor.created_at), 'MMM dd, yyyy')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewVendor(vendor)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Commission">
                          <IconButton size="small" onClick={() => handleEditVendor(vendor)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        {!vendor.is_approved ? (
                          <Tooltip title="Approve Vendor">
                            <IconButton
                              size="small"
                              onClick={() => handleApproveVendor(vendor.id, true)}
                              color="success"
                            >
                              <CheckCircle />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Reject Vendor">
                            <IconButton
                              size="small"
                              onClick={() => handleApproveVendor(vendor.id, false)}
                              color="error"
                            >
                              <Cancel />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Send Message">
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
      </Card>

      {/* Vendor Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              {selectedVendor && getInitials(selectedVendor.first_name, selectedVendor.last_name)}
            </Avatar>
            <Box>
              <Typography variant="h6">
                {selectedVendor && `${selectedVendor.first_name} ${selectedVendor.last_name}`}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedVendor?.email}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 3 }}>
            <Tab label="Profile" />
            <Tab label="Performance" />
            <Tab label="Recent Orders" />
          </Tabs>

          {/* Profile Tab */}
          {tabValue === 0 && vendorDetails && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Contact Information</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography>{vendorDetails.vendor.email}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography>{vendorDetails.vendor.phone || 'Not provided'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Business sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography>{vendorDetails.vendor.company_name || 'Not provided'}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Account Status</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography>Status:</Typography>
                    <Chip
                      label={vendorDetails.vendor.is_approved ? 'Approved' : 'Pending'}
                      color={getVendorStatusColor(vendorDetails.vendor.is_approved)}
                      size="small"
                    />
                  </Box>
                  <Typography>Commission Rate: <strong>{vendorDetails.vendor.commission_rate}%</strong></Typography>
                  <Typography>
                    Joined: {format(new Date(vendorDetails.vendor.created_at), 'PPP')}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>Statistics Overview</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Assignment sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                        <Typography variant="h4">{vendorDetails.statistics.total_assignments}</Typography>
                        <Typography variant="body2" color="text.secondary">Total Orders</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <CheckCircle sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                        <Typography variant="h4">{vendorDetails.statistics.completed_assignments}</Typography>
                        <Typography variant="body2" color="text.secondary">Completed</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <AttachMoney sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                        <Typography variant="h4">{formatCurrency(vendorDetails.statistics.total_earnings)}</Typography>
                        <Typography variant="body2" color="text.secondary">Total Earnings</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <TrendingUp sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
                        <Typography variant="h4">{formatCurrency(vendorDetails.statistics.avg_order_value)}</Typography>
                        <Typography variant="body2" color="text.secondary">Avg Order Value</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          )}

          {/* Performance Tab */}
          {tabValue === 1 && vendorMetrics && (
            <Box>
              <Typography variant="h6" gutterBottom>Performance Metrics (Last 30 Days)</Typography>
              <Box sx={{ height: 300, mb: 3 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vendorMetrics.metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} />
                    <YAxis />
                    <RechartsTooltip
                      labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                      formatter={(value, name) => [
                        name === 'commission' ? formatCurrency(value) : value,
                        name === 'commission' ? 'Commission' : 'Orders'
                      ]}
                    />
                    <Line type="monotone" dataKey="assignments" stroke="#1976d2" name="Orders" />
                    <Line type="monotone" dataKey="commission" stroke="#388e3c" name="Commission" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              {vendorDetails && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" gutterBottom>Completion Rate</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={(vendorDetails.statistics.completed_assignments / Math.max(vendorDetails.statistics.total_assignments, 1)) * 100}
                        sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                        color={getPerformanceColor((vendorDetails.statistics.completed_assignments / Math.max(vendorDetails.statistics.total_assignments, 1)) * 100)}
                      />
                      <Typography variant="body2" fontWeight="bold">
                        {Math.round((vendorDetails.statistics.completed_assignments / Math.max(vendorDetails.statistics.total_assignments, 1)) * 100)}%
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" gutterBottom>In Progress Orders</Typography>
                    <Typography variant="h4" color="primary">
                      {vendorDetails.statistics.in_progress_assignments || 0}
                    </Typography>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {/* Recent Orders Tab */}
          {tabValue === 2 && vendorDetails?.recent_orders && (
            <Box>
              <Typography variant="h6" gutterBottom>Recent Orders</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Order #</TableCell>
                      <TableCell>Customer</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Commission</TableCell>
                      <TableCell>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vendorDetails.recent_orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>#{order.order_number}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell>
                          <Chip
                            label={order.assignment_status}
                            size="small"
                            color={getStatusColor(order.assignment_status)}
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(order.commission_amount)}</TableCell>
                        <TableCell>{format(new Date(order.order_date), 'MMM dd')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Commission Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Commission Rate</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Commission Rate (%)"
            type="number"
            value={editFormData.commission_rate}
            onChange={(e) => setEditFormData(prev => ({ ...prev, commission_rate: parseFloat(e.target.value) || 0 }))}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            sx={{ mt: 2 }}
            helperText="Percentage of order value paid to vendor"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateCommission} variant="contained">
            Update Commission
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const getStatusColor = (status) => {
  const colors = {
    assigned: 'primary',
    accepted: 'info',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'error'
  };
  return colors[status] || 'default';
};

export default Vendors;