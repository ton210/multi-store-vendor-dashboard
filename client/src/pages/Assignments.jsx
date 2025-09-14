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
  Grid,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
  Alert
} from '@mui/material';
import {
  Visibility,
  CheckCircle,
  PlayArrow,
  Pause,
  Cancel,
  Message,
  AttachMoney,
  Schedule,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Assignments = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  });

  const [filters, setFilters] = useState({
    status: '',
    search: '',
    date_from: '',
    date_to: ''
  });

  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    total_earnings: 0
  });

  useEffect(() => {
    loadAssignments();
    loadStats();
  }, [pagination.page, filters]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      // Since we don't have a specific assignments endpoint, we'll use orders with vendor role
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });

      const response = await axios.get(`/orders?${params}`);

      // Filter and transform orders to show only assignments
      const assignmentsData = response.data.orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        total_amount: order.total_amount,
        currency: order.currency,
        order_date: order.order_date,
        store_name: order.store_name,
        store_type: order.store_type,
        assignment: order.vendor_assignments?.[0] || null,
        items: order.items || []
      }));

      setAssignments(assignmentsData);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
    } catch (error) {
      console.error('Failed to load assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get('/dashboard/stats');
      if (response.data.overview) {
        setStats({
          total: response.data.overview.total_assignments || 0,
          assigned: response.data.overview.pending_assignments || 0,
          in_progress: response.data.overview.in_progress_assignments || 0,
          completed: response.data.overview.completed_assignments || 0,
          total_earnings: response.data.overview.total_earnings || 0
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
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

  const handleViewAssignment = async (assignment) => {
    try {
      // Load full order details
      const response = await axios.get(`/orders/${assignment.id}`);
      setSelectedAssignment(response.data);
      setDetailsOpen(true);
    } catch (error) {
      console.error('Failed to load assignment details:', error);
    }
  };

  const updateAssignmentStatus = async (assignmentId, status) => {
    try {
      await axios.put(`/orders/${assignmentId}/status`, {
        status,
        notes: `Status updated to ${status} by vendor`
      });
      loadAssignments();
      loadStats();
    } catch (error) {
      console.error('Failed to update assignment status:', error);
    }
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

  const getStatusIcon = (status) => {
    const icons = {
      assigned: <AssignmentIcon />,
      accepted: <CheckCircle />,
      in_progress: <PlayArrow />,
      completed: <CheckCircle />,
      cancelled: <Cancel />
    };
    return icons[status] || <AssignmentIcon />;
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount || 0);
  };

  const getNextStatusActions = (currentStatus) => {
    switch (currentStatus) {
      case 'assigned':
        return [
          { status: 'accepted', label: 'Accept', color: 'info' },
          { status: 'cancelled', label: 'Reject', color: 'error' }
        ];
      case 'accepted':
        return [
          { status: 'in_progress', label: 'Start Work', color: 'warning' }
        ];
      case 'in_progress':
        return [
          { status: 'completed', label: 'Complete', color: 'success' },
          { status: 'assigned', label: 'Pause', color: 'default' }
        ];
      default:
        return [];
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          My Assignments
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssignmentIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4">{stats.total}</Typography>
              <Typography variant="body2" color="text.secondary">Total Assignments</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Schedule sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
              <Typography variant="h4">{stats.in_progress}</Typography>
              <Typography variant="body2" color="text.secondary">In Progress</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
              <Typography variant="h4">{stats.completed}</Typography>
              <Typography variant="body2" color="text.secondary">Completed</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AttachMoney sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
              <Typography variant="h4">{formatCurrency(stats.total_earnings)}</Typography>
              <Typography variant="body2" color="text.secondary">Total Earnings</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
                placeholder="Order number, customer..."
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
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="assigned">Assigned</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Date From"
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Date To"
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={1}>
              <Typography variant="body2" color="text.secondary">
                {assignments.length} assignments
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Performance Indicator */}
      {stats.total > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2">
                <strong>Completion Rate:</strong> {((stats.completed / stats.total) * 100).toFixed(1)}%
                ({stats.completed} of {stats.total} assignments completed)
              </Typography>
            </Box>
            <Box sx={{ width: 200 }}>
              <LinearProgress
                variant="determinate"
                value={(stats.completed / stats.total) * 100}
                color={(stats.completed / stats.total) >= 0.8 ? 'success' : 'primary'}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>
          </Box>
        </Alert>
      )}

      {/* Assignments Table */}
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
                <TableCell>Commission</TableCell>
                <TableCell>Assigned Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">Loading assignments...</TableCell>
                </TableRow>
              ) : assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Box sx={{ py: 4 }}>
                      <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="body1" color="text.secondary">
                        No assignments found
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((assignment) => (
                  <TableRow key={assignment.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        #{assignment.order_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{assignment.customer_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {assignment.customer_email}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={assignment.store_name}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(assignment.total_amount, assignment.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={assignment.assignment?.status || 'assigned'}
                        color={getStatusColor(assignment.assignment?.status || 'assigned')}
                        size="small"
                        icon={getStatusIcon(assignment.assignment?.status || 'assigned')}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {assignment.assignment?.commission_amount ?
                          formatCurrency(assignment.assignment.commission_amount) :
                          'TBD'
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {assignment.assignment?.assigned_at ?
                          format(new Date(assignment.assignment.assigned_at), 'MMM dd, yyyy') :
                          format(new Date(assignment.order_date), 'MMM dd, yyyy')
                        }
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewAssignment(assignment)}>
                            <Visibility />
                          </IconButton>
                        </Tooltip>

                        {/* Status Action Buttons */}
                        {getNextStatusActions(assignment.assignment?.status || 'assigned').map((action) => (
                          <Tooltip key={action.status} title={action.label}>
                            <Button
                              size="small"
                              variant="outlined"
                              color={action.color}
                              onClick={() => updateAssignmentStatus(assignment.id, action.status)}
                              sx={{ minWidth: 'auto', px: 1 }}
                            >
                              {action.label}
                            </Button>
                          </Tooltip>
                        ))}

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

      {/* Assignment Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Assignment Details - Order #{selectedAssignment?.order_number}
        </DialogTitle>
        <DialogContent>
          {selectedAssignment && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Order Information</Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography><strong>Customer:</strong> {selectedAssignment.customer_name}</Typography>
                  <Typography><strong>Email:</strong> {selectedAssignment.customer_email}</Typography>
                  <Typography><strong>Total:</strong> {formatCurrency(selectedAssignment.total_amount)}</Typography>
                  <Typography><strong>Store:</strong> {selectedAssignment.store_name}</Typography>
                  <Typography><strong>Order Date:</strong> {format(new Date(selectedAssignment.order_date), 'PPp')}</Typography>
                </Box>

                {selectedAssignment.shipping_address && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" gutterBottom>Shipping Address</Typography>
                    <Typography>{selectedAssignment.shipping_address.first_name} {selectedAssignment.shipping_address.last_name}</Typography>
                    <Typography>{selectedAssignment.shipping_address.address1}</Typography>
                    {selectedAssignment.shipping_address.address2 && (
                      <Typography>{selectedAssignment.shipping_address.address2}</Typography>
                    )}
                    <Typography>{selectedAssignment.shipping_address.city}, {selectedAssignment.shipping_address.province} {selectedAssignment.shipping_address.zip}</Typography>
                    <Typography>{selectedAssignment.shipping_address.country}</Typography>
                  </Box>
                )}
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>Assignment Status</Typography>
                {selectedAssignment.vendor_assignments?.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {selectedAssignment.status_history?.map((status, index) => (
                      <Paper key={index} sx={{ p: 2 }} variant="outlined">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Chip
                            icon={getStatusIcon(status.new_status)}
                            label={status.new_status.replace('_', ' ')}
                            color={getStatusColor(status.new_status)}
                            size="small"
                            sx={{ textTransform: 'capitalize' }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(status.created_at), 'MMM dd, HH:mm')}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {status.notes}
                        </Typography>
                        {status.changed_by_name && (
                          <Typography variant="caption" color="text.secondary">
                            Updated by {status.changed_by_name}
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Box>
                )}
              </Grid>

              {selectedAssignment.items && selectedAssignment.items.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>Order Items</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell>SKU</TableCell>
                          <TableCell>Quantity</TableCell>
                          <TableCell>Unit Price</TableCell>
                          <TableCell>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedAssignment.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Box>
                                <Typography variant="body2">{item.product_name}</Typography>
                                {item.variant_title && (
                                  <Typography variant="caption" color="text.secondary">
                                    {item.variant_title}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>{item.sku || 'N/A'}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell>{formatCurrency(item.total_price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {selectedAssignment?.vendor_assignments?.[0] &&
           getNextStatusActions(selectedAssignment.vendor_assignments[0].status).map((action) => (
            <Button
              key={action.status}
              onClick={() => {
                updateAssignmentStatus(selectedAssignment.id, action.status);
                setDetailsOpen(false);
              }}
              color={action.color}
              variant="contained"
            >
              {action.label}
            </Button>
          ))}
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Assignments;