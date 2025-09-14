import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  TextField,
  Button,
  Divider,
  Badge,
  IconButton,
  Tooltip,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Send,
  Refresh,
  Add,
  Search,
  AttachFile,
  MoreVert,
  Reply,
  Delete,
  Mark as MarkIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // New message dialog
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [newMessageData, setNewMessageData] = useState({
    recipient_id: '',
    order_id: '',
    subject: '',
    message: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadConversations();
    loadRecipients();
    loadUnreadCount();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/messages');

      // Group messages by conversation
      const conversationMap = new Map();

      response.data.messages.forEach(message => {
        const otherUserId = message.sender_id === user.id ? message.recipient_id : message.sender_id;
        const key = `${Math.min(user.id, otherUserId)}-${Math.max(user.id, otherUserId)}`;

        if (!conversationMap.has(key)) {
          conversationMap.set(key, {
            id: key,
            otherUser: message.sender_id === user.id ? message.recipient_name : message.sender_name,
            otherUserId,
            lastMessage: message,
            unreadCount: 0,
            order: message.order_info
          });
        }

        if (!message.is_read && message.recipient_id === user.id) {
          conversationMap.get(key).unreadCount++;
        }
      });

      setConversations(Array.from(conversationMap.values()).sort((a, b) =>
        new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at)
      ));
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (otherUserId) => {
    try {
      const response = await axios.get(`/messages/conversation/${otherUserId}`);
      setMessages(response.data.conversation);

      // Update conversation as read
      const conversation = conversations.find(c => c.otherUserId === otherUserId);
      if (conversation) {
        conversation.unreadCount = 0;
      }

      loadUnreadCount();
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const loadRecipients = async () => {
    try {
      if (user.role === 'admin' || user.role === 'manager') {
        // Load all users (vendors and other admins/managers)
        const [vendorsResponse, usersResponse] = await Promise.all([
          axios.get('/vendors'),
          // Could add an endpoint for all users, for now just use vendors
          axios.get('/vendors')
        ]);

        const allRecipients = [
          ...vendorsResponse.data.vendors.map(vendor => ({
            id: vendor.user_id || vendor.id,
            name: `${vendor.first_name} ${vendor.last_name}`,
            company: vendor.company_name,
            role: 'vendor'
          }))
        ];

        setRecipients(allRecipients);
      } else {
        // Vendors can message admins/managers - this would need an admin users endpoint
        setRecipients([]);
      }
    } catch (error) {
      console.error('Failed to load recipients:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await axios.get('/messages/unread-count');
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    loadConversation(conversation.otherUserId);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      await axios.post('/messages', {
        recipient_id: selectedConversation.otherUserId,
        message: newMessage.trim(),
        subject: selectedConversation.order ? `Re: Order #${selectedConversation.order.order_number}` : undefined,
        order_id: selectedConversation.order?.id
      });

      setNewMessage('');
      loadConversation(selectedConversation.otherUserId);
      loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendNewMessage = async () => {
    if (!newMessageData.recipient_id || !newMessageData.message.trim()) return;

    try {
      await axios.post('/messages', newMessageData);
      setNewMessageOpen(false);
      setNewMessageData({
        recipient_id: '',
        order_id: '',
        subject: '',
        message: ''
      });
      loadConversations();
    } catch (error) {
      console.error('Failed to send new message:', error);
    }
  };

  const filteredConversations = conversations.filter(conversation =>
    conversation.otherUser.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conversation.lastMessage.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Messages
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" sx={{ ml: 2 }}>
              <Box />
            </Badge>
          )}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadConversations}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setNewMessageOpen(true)}
          >
            New Message
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Conversations List */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ pb: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </CardContent>
            <Divider />
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography color="text.secondary">Loading conversations...</Typography>
                </Box>
              ) : filteredConversations.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    {searchTerm ? 'No conversations match your search' : 'No conversations yet'}
                  </Typography>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {filteredConversations.map((conversation) => (
                    <ListItem
                      key={conversation.id}
                      button
                      selected={selectedConversation?.id === conversation.id}
                      onClick={() => handleSelectConversation(conversation)}
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' }
                      }}
                    >
                      <ListItemAvatar>
                        <Badge
                          badgeContent={conversation.unreadCount}
                          color="error"
                          invisible={conversation.unreadCount === 0}
                        >
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            {getInitials(conversation.otherUser)}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" fontWeight={conversation.unreadCount > 0 ? 'bold' : 'normal'}>
                              {conversation.otherUser}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(conversation.lastMessage.created_at), 'MMM dd')}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: conversation.unreadCount > 0 ? 'bold' : 'normal'
                              }}
                            >
                              {conversation.lastMessage.message}
                            </Typography>
                            {conversation.order && (
                              <Chip
                                label={`Order #${conversation.order.order_number}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                              />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Chat Area */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <CardContent sx={{ pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {getInitials(selectedConversation.otherUser)}
                      </Avatar>
                      <Box>
                        <Typography variant="h6">{selectedConversation.otherUser}</Typography>
                        {selectedConversation.order && (
                          <Chip
                            label={`Order #${selectedConversation.order.order_number}`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                    <IconButton>
                      <MoreVert />
                    </IconButton>
                  </Box>
                </CardContent>

                {/* Messages */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                  {messages.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No messages in this conversation</Typography>
                    </Box>
                  ) : (
                    messages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          display: 'flex',
                          justifyContent: message.sender_id === user.id ? 'flex-end' : 'flex-start',
                          mb: 2
                        }}
                      >
                        <Paper
                          sx={{
                            p: 2,
                            maxWidth: '70%',
                            bgcolor: message.sender_id === user.id ? 'primary.main' : 'grey.100',
                            color: message.sender_id === user.id ? 'primary.contrastText' : 'text.primary'
                          }}
                        >
                          {message.subject && (
                            <Typography variant="body2" fontWeight="bold" gutterBottom>
                              {message.subject}
                            </Typography>
                          )}
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {message.message}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              opacity: 0.8,
                              display: 'block',
                              textAlign: 'right'
                            }}
                          >
                            {format(new Date(message.created_at), 'MMM dd, HH:mm')}
                          </Typography>
                        </Paper>
                      </Box>
                    ))
                  )}
                </Box>

                {/* Message Input */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sending}
                    />
                    <IconButton>
                      <AttachFile />
                    </IconButton>
                    <Button
                      variant="contained"
                      endIcon={<Send />}
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </Box>
                </Box>
              </>
            ) : (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}>
                <Typography variant="h6" color="text.secondary">
                  Select a conversation to start messaging
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* New Message Dialog */}
      <Dialog
        open={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>New Message</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel>Recipient</InputLabel>
            <Select
              value={newMessageData.recipient_id}
              onChange={(e) => setNewMessageData(prev => ({ ...prev, recipient_id: e.target.value }))}
              label="Recipient"
            >
              {recipients.map((recipient) => (
                <MenuItem key={recipient.id} value={recipient.id}>
                  {recipient.name} {recipient.company && `(${recipient.company})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Subject (Optional)"
            value={newMessageData.subject}
            onChange={(e) => setNewMessageData(prev => ({ ...prev, subject: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Message"
            multiline
            rows={4}
            value={newMessageData.message}
            onChange={(e) => setNewMessageData(prev => ({ ...prev, message: e.target.value }))}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewMessageOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSendNewMessage}
            variant="contained"
            disabled={!newMessageData.recipient_id || !newMessageData.message.trim()}
          >
            Send Message
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Messages;