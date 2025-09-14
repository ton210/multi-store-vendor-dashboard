const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticateToken, requireAdminOrManager } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');

    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Create subdirectories
    const subDirs = ['designs', 'specifications', 'proofs'];
    subDirs.forEach(dir => {
      const subDir = path.join(uploadDir, dir);
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
    });

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'image/svg+xml',
    'application/postscript', // .ai files
    'image/vnd.adobe.photoshop' // .psd files
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: JPG, PNG, PDF, SVG, AI, PSD'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload design files for order
router.post('/design-files/:orderId', authenticateToken, requireAdminOrManager, upload.array('files', 10), async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { file_type = 'design', vendor_assignment_id, notes } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Verify order exists
    const orderQuery = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      // Save file info to database
      const fileQuery = await db.query(`
        INSERT INTO order_attachments (
          order_id, vendor_assignment_id, filename, original_filename,
          file_path, file_size, mime_type, file_type, uploaded_by, is_public
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        orderId,
        vendor_assignment_id || null,
        file.filename,
        file.originalname,
        file.path,
        file.size,
        file.mimetype,
        file_type,
        req.user.id,
        true
      ]);

      uploadedFiles.push(fileQuery.rows[0]);

      // Create notification for assigned vendors
      if (vendor_assignment_id) {
        const vendorQuery = await db.query(`
          SELECT v.user_id, u.first_name, u.last_name
          FROM vendor_assignments va
          JOIN vendors v ON va.vendor_id = v.id
          JOIN users u ON v.user_id = u.id
          WHERE va.id = $1
        `, [vendor_assignment_id]);

        if (vendorQuery.rows.length > 0) {
          const vendor = vendorQuery.rows[0];
          await db.query(`
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES ($1, 'design_file_uploaded', 'New Design File', $2, $3)
          `, [
            vendor.user_id,
            `New ${file_type} file uploaded for your order assignment`,
            JSON.stringify({
              order_id: orderId,
              file_id: fileQuery.rows[0].id,
              filename: file.originalname
            })
          ]);
        }
      }
    }

    // Add to order history
    await db.query(`
      INSERT INTO order_status_history (order_id, changed_by, new_status, notes)
      VALUES ($1, $2, 'files_uploaded', $3)
    `, [
      orderId,
      req.user.id,
      `${uploadedFiles.length} ${file_type} file(s) uploaded: ${uploadedFiles.map(f => f.original_filename).join(', ')}`
    ]);

    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get files for order
router.get('/order/:orderId/files', authenticateToken, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { file_type } = req.query;

    // Check access permissions
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }

      const accessQuery = await db.query(
        'SELECT 1 FROM vendor_assignments WHERE order_id = $1 AND vendor_id = $2',
        [orderId, vendorQuery.rows[0].id]
      );

      if (accessQuery.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to view files for this order' });
      }
    }

    let whereClause = 'order_id = $1';
    let queryParams = [orderId];

    if (file_type) {
      whereClause += ' AND file_type = $2';
      queryParams.push(file_type);
    }

    const filesQuery = `
      SELECT
        oa.*,
        u.first_name || ' ' || u.last_name as uploaded_by_name
      FROM order_attachments oa
      LEFT JOIN users u ON oa.uploaded_by = u.id
      WHERE ${whereClause}
      ORDER BY oa.created_at DESC
    `;

    const files = await db.query(filesQuery, queryParams);

    res.json({
      order_id: orderId,
      files: files.rows
    });

  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Server error fetching files' });
  }
});

// Download file
router.get('/download/:fileId', authenticateToken, async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // Get file info
    const fileQuery = await db.query('SELECT * FROM order_attachments WHERE id = $1', [fileId]);
    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Check permissions
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }

      const accessQuery = await db.query(
        'SELECT 1 FROM vendor_assignments WHERE order_id = $1 AND vendor_id = $2',
        [file.order_id, vendorQuery.rows[0].id]
      );

      if (accessQuery.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized to download this file' });
      }
    }

    // Check if file exists
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.setHeader('Content-Type', file.mime_type);

    // Stream file
    const fileStream = fs.createReadStream(file.file_path);
    fileStream.pipe(res);

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Server error downloading file' });
  }
});

// Delete file
router.delete('/:fileId', authenticateToken, requireAdminOrManager, async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // Get file info
    const fileQuery = await db.query('SELECT * FROM order_attachments WHERE id = $1', [fileId]);
    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Delete file from filesystem
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    // Delete from database
    await db.query('DELETE FROM order_attachments WHERE id = $1', [fileId]);

    res.json({ message: 'File deleted successfully' });

  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({ error: 'Server error deleting file' });
  }
});

// Upload vendor proof/specification files
router.post('/vendor-files/:assignmentId', authenticateToken, upload.array('files', 5), async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    const { file_type = 'proof' } = req.body;

    // Verify vendor has access to this assignment
    if (req.user.role === 'vendor') {
      const vendorQuery = await db.query('SELECT id FROM vendors WHERE user_id = $1', [req.user.id]);
      if (vendorQuery.rows.length === 0) {
        return res.status(404).json({ error: 'Vendor profile not found' });
      }

      const assignmentQuery = await db.query(
        'SELECT order_id FROM vendor_assignments WHERE id = $1 AND vendor_id = $2',
        [assignmentId, vendorQuery.rows[0].id]
      );

      if (assignmentQuery.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized for this assignment' });
      }

      const orderId = assignmentQuery.rows[0].order_id;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const uploadedFiles = [];

      for (const file of req.files) {
        const fileQuery = await db.query(`
          INSERT INTO order_attachments (
            order_id, vendor_assignment_id, filename, original_filename,
            file_path, file_size, mime_type, file_type, uploaded_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          orderId,
          assignmentId,
          file.filename,
          file.originalname,
          file.path,
          file.size,
          file.mimetype,
          file_type,
          req.user.id
        ]);

        uploadedFiles.push(fileQuery.rows[0]);
      }

      res.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles
      });
    }

  } catch (error) {
    console.error('Vendor file upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;