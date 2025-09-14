-- Advanced Features Schema Updates

-- Order item assignments for splitting orders
CREATE TABLE order_item_assignments (
    id SERIAL PRIMARY KEY,
    vendor_assignment_id INTEGER REFERENCES vendor_assignments(id) ON DELETE CASCADE,
    order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    assigned_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'assigned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracking information table
CREATE TABLE order_tracking (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    vendor_assignment_id INTEGER REFERENCES vendor_assignments(id) ON DELETE CASCADE,
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    tracking_url VARCHAR(500),
    shipped_date TIMESTAMP,
    delivered_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Design files and attachments
CREATE TABLE order_attachments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    vendor_assignment_id INTEGER REFERENCES vendor_assignments(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    file_type VARCHAR(50) CHECK (file_type IN ('design', 'specification', 'proof', 'other')),
    uploaded_by INTEGER REFERENCES users(id),
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Slack configuration
CREATE TABLE slack_channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    notification_types JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Zakeke integration data
CREATE TABLE zakeke_orders (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    zakeke_order_id VARCHAR(255),
    customization_data JSONB,
    design_files JSONB,
    artwork_status VARCHAR(50) DEFAULT 'pending',
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Supplier/vendor communications (internal messaging)
CREATE TABLE vendor_communications (
    id SERIAL PRIMARY KEY,
    vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    subject VARCHAR(500),
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(50) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'resolved')),
    created_by INTEGER REFERENCES users(id),
    replied_by INTEGER REFERENCES users(id),
    reply_message TEXT,
    replied_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System settings for advanced features
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(255) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('slack_config', '{"enabled": false, "webhook_url": "", "channels": {}}', 'Slack notification configuration'),
('zakeke_config', '{"enabled": false, "client_id": "", "client_secret": "", "api_url": "https://api.zakeke.com"}', 'Zakeke API integration settings'),
('tracking_config', '{"auto_sync": true, "supported_carriers": ["UPS", "FedEx", "USPS", "DHL"]}', 'Tracking system configuration'),
('file_upload_config', '{"max_size": 10485760, "allowed_types": ["jpg", "jpeg", "png", "pdf", "ai", "psd"], "storage_path": "/uploads/designs"}', 'File upload settings');

-- Create indexes for performance
CREATE INDEX idx_order_item_assignments_vendor ON order_item_assignments(vendor_assignment_id);
CREATE INDEX idx_order_tracking_order ON order_tracking(order_id);
CREATE INDEX idx_order_tracking_vendor ON order_tracking(vendor_assignment_id);
CREATE INDEX idx_order_attachments_order ON order_attachments(order_id);
CREATE INDEX idx_zakeke_orders_order ON zakeke_orders(order_id);
CREATE INDEX idx_vendor_communications_vendor ON vendor_communications(vendor_id);
CREATE INDEX idx_vendor_communications_status ON vendor_communications(status);