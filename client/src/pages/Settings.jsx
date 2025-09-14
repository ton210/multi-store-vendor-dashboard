import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import {
  Save,
  Refresh,
  Security,
  Notifications,
  Business,
  Email,
  Delete,
  Add,
  Edit,
  Visibility,
  VisibilityOff,
  Settings as SettingsIcon,
  People
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile Settings
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: ''
  });

  // System Settings
  const [systemSettings, setSystemSettings] = useState({
    autoSync: true,
    syncInterval: 30,
    emailNotifications: true,
    slackNotifications: false,
    defaultCommissionRate: 10,
    maxOrdersPerVendor: 100,
    requireVendorApproval: true
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorAuth: false,
    sessionTimeout: 60
  });

  // User Management
  const [users, setUsers] = useState([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUserData, setNewUserData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'vendor',
    password: ''
  });

  useEffect(() => {
    loadUserProfile();
    loadSystemSettings();
    if (user?.role === 'admin') {
      loadUsers();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      const response = await axios.get('/auth/me');
      setProfileData({
        firstName: response.data.firstName || '',
        lastName: response.data.lastName || '',
        email: response.data.email || '',
        phone: response.data.vendorInfo?.phone || '',
        companyName: response.data.vendorInfo?.company_name || ''
      });
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const loadSystemSettings = async () => {
    // In a real app, this would load from a settings API
    // For now, using mock data
    setSystemSettings({
      autoSync: true,
      syncInterval: 30,
      emailNotifications: true,
      slackNotifications: false,
      defaultCommissionRate: 10,
      maxOrdersPerVendor: 100,
      requireVendorApproval: true
    });
  };

  const loadUsers = async () => {
    try {
      // This would be a users endpoint, for now using vendors
      const response = await axios.get('/vendors');
      setUsers(response.data.vendors || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleProfileSave = async () => {
    setLoading(true);
    try {
      const result = await updateProfile(profileData);
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleSystemSettingsSave = async () => {
    setLoading(true);
    try {
      // In a real app, this would save to a settings API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      setMessage({ type: 'success', text: 'System settings updated successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update system settings' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (securitySettings.newPassword !== securitySettings.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      // In a real app, this would call a password change API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Mock delay
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setSecuritySettings(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    setLoading(true);
    try {
      await axios.post('/auth/register', {
        ...newUserData,
        firstName: newUserData.firstName,
        lastName: newUserData.lastName
      });
      setMessage({ type: 'success', text: 'User created successfully!' });
      setUserDialogOpen(false);
      setNewUserData({
        email: '',
        firstName: '',
        lastName: '',
        role: 'vendor',
        password: ''
      });
      loadUsers();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create user' });
    } finally {
      setLoading(false);
    }
  };

  const clearMessage = () => {
    setMessage({ type: '', text: '' });
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    clearMessage();
  };

  if (user?.role !== 'admin') {
    // Show limited settings for non-admin users
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Account Settings
        </Typography>

        {message.text && (
          <Alert severity={message.type} sx={{ mb: 3 }} onClose={clearMessage}>
            {message.text}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Profile Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={profileData.email}
                  disabled
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  margin="normal"
                />
              </Grid>
              {user?.role === 'vendor' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Company Name"
                    value={profileData.companyName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, companyName: e.target.value }))}
                    margin="normal"
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleProfileSave}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        System Settings
      </Typography>

      {message.text && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={clearMessage}>
          {message.text}
        </Alert>
      )}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Profile" icon={<Business />} />
            <Tab label="System" icon={<SettingsIcon />} />
            <Tab label="Security" icon={<Security />} />
            <Tab label="Users" icon={<People />} />
          </Tabs>
        </Box>

        {/* Profile Tab */}
        {activeTab === 0 && (
          <CardContent>
            <Typography variant="h6" gutterBottom>Profile Information</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  value={profileData.email}
                  disabled
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleProfileSave}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        )}

        {/* System Tab */}
        {activeTab === 1 && (
          <CardContent>
            <Typography variant="h6" gutterBottom>System Configuration</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>Store Synchronization</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.autoSync}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, autoSync: e.target.checked }))}
                    />
                  }
                  label="Enable Auto-Sync"
                />
                <TextField
                  fullWidth
                  label="Sync Interval (minutes)"
                  type="number"
                  value={systemSettings.syncInterval}
                  onChange={(e) => setSystemSettings(prev => ({ ...prev, syncInterval: parseInt(e.target.value) }))}
                  margin="normal"
                  inputProps={{ min: 5, max: 1440 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>Notifications</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.emailNotifications}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                    />
                  }
                  label="Email Notifications"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.slackNotifications}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, slackNotifications: e.target.checked }))}
                    />
                  }
                  label="Slack Notifications"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>Vendor Management</Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Default Commission Rate (%)"
                  type="number"
                  value={systemSettings.defaultCommissionRate}
                  onChange={(e) => setSystemSettings(prev => ({ ...prev, defaultCommissionRate: parseFloat(e.target.value) }))}
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Max Orders per Vendor"
                  type="number"
                  value={systemSettings.maxOrdersPerVendor}
                  onChange={(e) => setSystemSettings(prev => ({ ...prev, maxOrdersPerVendor: parseInt(e.target.value) }))}
                  inputProps={{ min: 1 }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={systemSettings.requireVendorApproval}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, requireVendorApproval: e.target.checked }))}
                    />
                  }
                  label="Require Vendor Approval"
                  sx={{ mt: 1 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSystemSettingsSave}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save System Settings'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        )}

        {/* Security Tab */}
        {activeTab === 2 && (
          <CardContent>
            <Typography variant="h6" gutterBottom>Security Settings</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>Change Password</Typography>
                <TextField
                  fullWidth
                  label="Current Password"
                  type="password"
                  value={securitySettings.currentPassword}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, currentPassword: e.target.value }))}
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="New Password"
                  type="password"
                  value={securitySettings.newPassword}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, newPassword: e.target.value }))}
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type="password"
                  value={securitySettings.confirmPassword}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  margin="normal"
                />
                <Button
                  variant="contained"
                  onClick={handlePasswordChange}
                  disabled={loading || !securitySettings.currentPassword || !securitySettings.newPassword}
                  sx={{ mt: 2 }}
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </Button>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>Security Options</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={securitySettings.twoFactorAuth}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, twoFactorAuth: e.target.checked }))}
                    />
                  }
                  label="Two-Factor Authentication"
                />
                <TextField
                  fullWidth
                  label="Session Timeout (minutes)"
                  type="number"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }))}
                  margin="normal"
                  inputProps={{ min: 15, max: 480 }}
                />
              </Grid>
            </Grid>
          </CardContent>
        )}

        {/* Users Tab */}
        {activeTab === 3 && (
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">User Management</Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setUserDialogOpen(true)}
              >
                Add User
              </Button>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((userData) => (
                    <TableRow key={userData.id}>
                      <TableCell>{userData.first_name} {userData.last_name}</TableCell>
                      <TableCell>{userData.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={userData.role || 'vendor'}
                          color={userData.role === 'admin' ? 'error' : 'primary'}
                          size="small"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={userData.is_approved ? 'Active' : 'Pending'}
                          color={userData.is_approved ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(userData.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small">
                          <Edit />
                        </IconButton>
                        <IconButton size="small" color="error">
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}
      </Card>

      {/* Add User Dialog */}
      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="First Name"
                value={newUserData.firstName}
                onChange={(e) => setNewUserData(prev => ({ ...prev, firstName: e.target.value }))}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Last Name"
                value={newUserData.lastName}
                onChange={(e) => setNewUserData(prev => ({ ...prev, lastName: e.target.value }))}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newUserData.email}
                onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Role</InputLabel>
                <Select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, role: e.target.value }))}
                  label="Role"
                >
                  <MenuItem value="vendor">Vendor</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={newUserData.password}
                onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                margin="normal"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateUser}
            variant="contained"
            disabled={loading || !newUserData.email || !newUserData.password}
          >
            {loading ? 'Creating...' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;