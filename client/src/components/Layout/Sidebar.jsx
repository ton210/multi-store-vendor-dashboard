import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Box
} from '@mui/material';
import {
  Dashboard,
  ShoppingCart,
  Store,
  People,
  Message,
  BarChart,
  Settings,
  Assignment
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const drawerWidth = 240;

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const getMenuItems = () => {
    const commonItems = [
      { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
      { text: 'Orders', icon: <ShoppingCart />, path: '/orders' },
      { text: 'Messages', icon: <Message />, path: '/messages' }
    ];

    if (user?.role === 'admin' || user?.role === 'manager') {
      return [
        ...commonItems,
        { text: 'Stores', icon: <Store />, path: '/stores' },
        { text: 'Vendors', icon: <People />, path: '/vendors' },
        { text: 'Analytics', icon: <BarChart />, path: '/analytics' },
        { text: 'Settings', icon: <Settings />, path: '/settings' }
      ];
    } else if (user?.role === 'vendor') {
      return [
        ...commonItems,
        { text: 'My Assignments', icon: <Assignment />, path: '/assignments' },
        { text: 'Analytics', icon: <BarChart />, path: '/analytics' }
      ];
    }

    return commonItems;
  };

  const menuItems = getMenuItems();

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box'
        }
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'primary.dark'
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white'
                    }
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.path ? 'white' : 'inherit'
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
      </Box>
    </Drawer>
  );
};

export default Sidebar;