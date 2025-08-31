// services/qrCodeService.js
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

// Ensure QR codes directory exists
const ensureQRCodesDir = async () => {
  const qrCodesDir = path.join(__dirname, '..', 'uploads', 'qrcodes');
  try {
    await fs.access(qrCodesDir);
  } catch {
    await fs.mkdir(qrCodesDir, { recursive: true });
  }
  return qrCodesDir;
};

// Generate QR Code
exports.generateQRCode = async (data, filename) => {
  try {
    const qrCodesDir = await ensureQRCodesDir();
    const fileName = `${filename || 'qr-' + Date.now()}.png`;
    const filePath = path.join(qrCodesDir, fileName);
    
    // QR Code options
    const options = {
      type: 'png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    };
    
    // Generate QR code and save to file
    await QRCode.toFile(filePath, data, options);
    
    // Also generate base64 version for immediate use
    const base64 = await QRCode.toDataURL(data, options);
    
    return {
      success: true,
      filePath: fileName, // Just filename for database storage
      fullPath: filePath,
      base64,
      data
    };
    
  } catch (error) {
    console.error('QR Code generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate batch QR codes
exports.generateBatchQRCodes = async (dataArray) => {
  try {
    const results = await Promise.all(
      dataArray.map(async (item) => {
        const result = await this.generateQRCode(item.data, item.filename);
        return {
          ...result,
          id: item.id
        };
      })
    );
    
    return {
      success: true,
      results,
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Validate QR Code data
exports.validateQRCode = async (qrData) => {
  try {
    const parsedData = JSON.parse(qrData);
    
    // Basic validation
    const requiredFields = ['ticketId', 'eventId', 'ticketNumber'];
    const missingFields = requiredFields.filter(field => !parsedData[field]);
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      };
    }
    
    return {
      valid: true,
      data: parsedData
    };
    
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid QR code format'
    };
  }
};

// Delete QR Code file
exports.deleteQRCode = async (filename) => {
  try {
    const qrCodesDir = await ensureQRCodesDir();
    const filePath = path.join(qrCodesDir, filename);
    
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      return { success: true, message: 'QR code deleted successfully' };
    } catch {
      return { success: true, message: 'QR code file not found (already deleted)' };
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};