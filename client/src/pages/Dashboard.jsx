import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  ShoppingCart,
  TrendingUp,
  People,
  Store,
  AttachMoney
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const StatCard = ({ title, value, icon, color, change }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography color="textSecondary" gutterBottom variant="body2">
            {title}
          </Typography>
          <Typography variant="h4" component="h2">
            {value}
          </Typography>
          {change && (
            <Chip
              label={`${change > 0 ? '+' : ''}${change}%`}
              color={change > 0 ? 'success' : 'error'}
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </Box>
        <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
          {icon}
        </Avatar>
      </Box>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await axios.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Loading dashboard...</Typography>
      </Box>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const isVendor = user?.role === 'vendor';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Welcome back, {user?.firstName}!
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {isAdmin && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Orders"
                value={stats?.overview?.total_orders || 0}
                icon={<ShoppingCart />}
                color="#1976d2"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Revenue"
                value={`$${(stats?.overview?.total_revenue || 0).toLocaleString()}`}
                icon={<AttachMoney />}
                color="#388e3c"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Vendors"
                value={stats?.overview?.active_vendors || 0}
                icon={<People />}
                color="#f57c00"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Stores"
                value={stats?.overview?.active_stores || 0}
                icon={<Store />}
                color="#7b1fa2"
              />
            </Grid>
          </>
        )}

        {isVendor && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Assignments"
                value={stats?.overview?.total_assignments || 0}
                icon={<ShoppingCart />}
                color="#1976d2"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Completed"
                value={stats?.overview?.completed_assignments || 0}
                icon={<TrendingUp />}
                color="#388e3c"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="In Progress"
                value={stats?.overview?.in_progress_assignments || 0}
                icon={<ShoppingCart />}
                color="#f57c00"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Earnings"
                value={`$${(stats?.overview?.total_earnings || 0).toLocaleString()}`}
                icon={<AttachMoney />}
                color="#7b1fa2"
              />
            </Grid>
          </>
        )}
      </Grid>

      <Grid container spacing={3}>
        {/* Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {isAdmin ? 'Revenue Trend' : 'Earnings Trend'}
              </Typography>
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={isAdmin ? stats?.revenue_chart : stats?.earnings_chart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                      formatter={(value, name) => [
                        `$${value.toLocaleString()}`,
                        isAdmin ? 'Revenue' : 'Earnings'
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey={isAdmin ? 'revenue' : 'earnings'}
                      stroke="#1976d2"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Items */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {isAdmin ? 'Recent Orders' : 'Recent Assignments'}
              </Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {(isAdmin ? stats?.recent_orders : stats?.recent_assignments)?.map((item, index) => (
                  <ListItem key={index} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#1976d2' }}>
                        <ShoppingCart />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`Order #${item.order_number}`}
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {item.customer_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ${item.total_amount?.toLocaleString()} • {item.store_name}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Vendors (Admin only) */}
        {isAdmin && stats?.top_vendors && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Vendors
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Vendor</TableCell>
                        <TableCell>Company</TableCell>
                        <TableCell align="right">Total Assignments</TableCell>
                        <TableCell align="right">Completed</TableCell>
                        <TableCell align="right">Total Earnings</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.top_vendors.map((vendor, index) => (
                        <TableRow key={index}>
                          <TableCell>{vendor.vendor_name}</TableCell>
                          <TableCell>{vendor.company_name || 'N/A'}</TableCell>
                          <TableCell align="right">{vendor.total_assignments}</TableCell>
                          <TableCell align="right">{vendor.completed_assignments}</TableCell>
                          <TableCell align="right">
                            ${vendor.total_earnings?.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Dashboard;