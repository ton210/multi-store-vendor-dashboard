import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  AttachMoney,
  People,
  Store as StoreIcon,
  Assignment,
  Speed
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Analytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [orderStatusData, setOrderStatusData] = useState([]);
  const [storePerformanceData, setStorePerformanceData] = useState([]);
  const [vendorPerformanceData, setVendorPerformanceData] = useState([]);

  useEffect(() => {
    loadAnalyticsData();
  }, [period]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const [dashboardResponse] = await Promise.all([
        axios.get(`/dashboard/stats?period=${period}`)
      ]);

      const data = dashboardResponse.data;
      setStats(data.overview || data);

      // Process revenue/earnings chart data
      const chartData = (user?.role === 'vendor' ? data.earnings_chart : data.revenue_chart) || [];
      setRevenueData(chartData.map(item => ({
        ...item,
        date: format(new Date(item.date), 'MMM dd')
      })));

      // Generate mock order status data for pie chart
      if (user?.role === 'admin' || user?.role === 'manager') {
        setOrderStatusData([
          { name: 'Pending', value: data.overview?.pending_orders || 0, color: '#ff9800' },
          { name: 'Processing', value: data.overview?.processing_orders || 0, color: '#2196f3' },
          { name: 'Completed', value: data.overview?.completed_orders || 0, color: '#4caf50' },
          { name: 'Cancelled', value: Math.floor((data.overview?.total_orders || 0) * 0.1), color: '#f44336' }
        ]);

        // Process top vendors for store performance
        setVendorPerformanceData(data.top_vendors || []);
      } else if (user?.role === 'vendor') {
        // Vendor-specific status data
        setOrderStatusData([
          { name: 'Assigned', value: Math.floor((data.overview?.total_assignments || 0) * 0.2), color: '#2196f3' },
          { name: 'In Progress', value: data.overview?.in_progress_assignments || 0, color: '#ff9800' },
          { name: 'Completed', value: data.overview?.completed_assignments || 0, color: '#4caf50' }
        ]);
      }

      // Mock store performance data
      setStorePerformanceData([
        { name: 'Shopify Store', orders: 150, revenue: 15000, growth: 12.5 },
        { name: 'BigCommerce Store', orders: 89, revenue: 8900, growth: -2.3 },
        { name: 'WooCommerce Store', orders: 234, revenue: 23400, growth: 8.7 }
      ]);

    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatPercentage = (value) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n.charAt(0)).join('').toUpperCase() || 'N/A';
  };

  const StatCard = ({ title, value, change, icon, color }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
              {typeof value === 'number' && title.toLowerCase().includes('revenue') ? formatCurrency(value) : value}
            </Typography>
            {change !== undefined && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {change > 0 ? (
                  <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                )}
                <Typography
                  variant="body2"
                  color={change > 0 ? 'success.main' : 'error.main'}
                  fontWeight="bold"
                >
                  {formatPercentage(change)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  vs last period
                </Typography>
              </Box>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading analytics...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Analytics Dashboard
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={period}
            label="Period"
            onChange={(e) => setPeriod(e.target.value)}
          >
            <MenuItem value="7">Last 7 days</MenuItem>
            <MenuItem value="30">Last 30 days</MenuItem>
            <MenuItem value="90">Last 90 days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Key Metrics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {user?.role === 'admin' || user?.role === 'manager' ? (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Orders"
                value={stats?.total_orders || 0}
                change={8.2}
                icon={<ShoppingCart />}
                color="#1976d2"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Revenue"
                value={stats?.total_revenue || 0}
                change={12.5}
                icon={<AttachMoney />}
                color="#388e3c"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Vendors"
                value={stats?.active_vendors || 0}
                change={5.3}
                icon={<People />}
                color="#f57c00"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Active Stores"
                value={stats?.active_stores || 0}
                change={0}
                icon={<StoreIcon />}
                color="#7b1fa2"
              />
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Assignments"
                value={stats?.total_assignments || 0}
                change={15.2}
                icon={<Assignment />}
                color="#1976d2"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Completed Orders"
                value={stats?.completed_assignments || 0}
                change={8.7}
                icon={<TrendingUp />}
                color="#388e3c"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Total Earnings"
                value={stats?.total_earnings || 0}
                change={22.1}
                icon={<AttachMoney />}
                color="#f57c00"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Completion Rate"
                value={`${Math.round(((stats?.completed_assignments || 0) / Math.max(stats?.total_assignments || 1, 1)) * 100)}%`}
                change={3.2}
                icon={<Speed />}
                color="#7b1fa2"
              />
            </Grid>
          </>
        )}
      </Grid>

      <Grid container spacing={3}>
        {/* Revenue/Earnings Trend */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {user?.role === 'vendor' ? 'Earnings Trend' : 'Revenue Trend'}
              </Typography>
              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1976d2" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#1976d2" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), user?.role === 'vendor' ? 'Earnings' : 'Revenue']}
                    />
                    <Area
                      type="monotone"
                      dataKey={user?.role === 'vendor' ? 'earnings' : 'revenue'}
                      stroke="#1976d2"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Status Distribution */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {user?.role === 'vendor' ? 'Assignment Status' : 'Order Status Distribution'}
              </Typography>
              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      dataKey="value"
                      label={({ name, percentage }) => `${name}: ${(percentage || 0).toFixed(0)}%`}
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Store Performance */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Store Performance
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Store</TableCell>
                        <TableCell>Orders</TableCell>
                        <TableCell>Revenue</TableCell>
                        <TableCell>Growth</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {storePerformanceData.map((store, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <StoreIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                              {store.name}
                            </Box>
                          </TableCell>
                          <TableCell>{store.orders}</TableCell>
                          <TableCell>{formatCurrency(store.revenue)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {store.growth > 0 ? (
                                <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                              ) : (
                                <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                              )}
                              <Typography
                                variant="body2"
                                color={store.growth > 0 ? 'success.main' : 'error.main'}
                                fontWeight="bold"
                              >
                                {formatPercentage(store.growth)}
                              </Typography>
                            </Box>
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

        {/* Top Vendors Performance */}
        {(user?.role === 'admin' || user?.role === 'manager') && vendorPerformanceData.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Performing Vendors
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {vendorPerformanceData.slice(0, 5).map((vendor, index) => {
                    const completionRate = (vendor.completed_assignments / Math.max(vendor.total_assignments, 1)) * 100;
                    return (
                      <Box key={index}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                            {getInitials(vendor.vendor_name)}
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              {vendor.vendor_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {vendor.company_name || 'Independent Vendor'}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="body2" fontWeight="bold">
                              {formatCurrency(vendor.total_earnings)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {vendor.total_assignments} orders
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={completionRate}
                            sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                            color={completionRate >= 90 ? 'success' : completionRate >= 70 ? 'warning' : 'error'}
                          />
                          <Typography variant="caption" fontWeight="bold">
                            {completionRate.toFixed(0)}%
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Daily Activity Chart */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Daily Activity Overview
              </Typography>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="orders"
                      fill="#1976d2"
                      name={user?.role === 'vendor' ? 'Assignments' : 'Orders'}
                      radius={[4, 4, 0, 0]}
                    />
                    {user?.role === 'vendor' ? (
                      <Bar
                        dataKey="earnings"
                        fill="#388e3c"
                        name="Earnings"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <Bar
                        dataKey="revenue"
                        fill="#388e3c"
                        name="Revenue"
                        radius={[4, 4, 0, 0]}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Performance Insights */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Performance Insights:</strong> {user?.role === 'vendor'
                ? `Your completion rate has improved by 3.2% this period. Keep up the excellent work! Focus on maintaining quality while increasing throughput.`
                : `Revenue growth is strong at 12.5% this period. Consider expanding vendor capacity to handle increased order volume. Top performing stores show consistent growth patterns.`
              }
            </Typography>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;