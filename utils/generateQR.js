const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class QRGenerator {
  constructor() {
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
    this.qrCodesDir = path.join(this.uploadsDir, 'qrcodes');
    this.ensureDirectories();
  }

  // Ensure required directories exist
  async ensureDirectories() {
    try {
      await fs.access(this.uploadsDir);
    } catch {
      await fs.mkdir(this.uploadsDir, { recursive: true });
    }

    try {
      await fs.access(this.qrCodesDir);
    } catch {
      await fs.mkdir(this.qrCodesDir, { recursive: true });
    }
  }

  // Generate single QR code
  async generateSingle(data, options = {}) {
    try {
      await this.ensureDirectories();
      
      const {
        filename = `qr-${uuidv4()}-${Date.now()}`,
        format = 'png',
        size = 256,
        margin = 2,
        darkColor = '#000000',
        lightColor = '#FFFFFF',
        errorCorrectionLevel = 'M',
        quality = 0.92
      } = options;

      // QR Code generation options
      const qrOptions = {
        type: format,
        quality,
        margin,
        color: {
          dark: darkColor,
          light: lightColor
        },
        width: size,
        errorCorrectionLevel
      };

      // Generate filename with extension
      const fullFilename = `${filename}.${format}`;
      const filePath = path.join(this.qrCodesDir, fullFilename);

      // Generate QR code file
      await QRCode.toFile(filePath, data, qrOptions);

      // Generate base64 version
      const base64 = await QRCode.toDataURL(data, qrOptions);

      return {
        success: true,
        data: {
          filename: fullFilename,
          filePath,
          relativePath: `uploads/qrcodes/${fullFilename}`,
          base64,
          size: await this.getFileSize(filePath),
          format,
          data,
          createdAt: new Date()
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  // Generate batch QR codes
  async generateBatch(dataArray, options = {}) {
    try {
      const results = [];
      const {
        filenamePrefix = 'batch-qr',
        ...qrOptions
      } = options;

      for (let i = 0; i < dataArray.length; i++) {
        const item = dataArray[i];
        const filename = `${filenamePrefix}-${i + 1}-${Date.now()}`;
        
        const result = await this.generateSingle(item.data, {
          ...qrOptions,
          filename: item.filename || filename
        });

        results.push({
          ...result,
          index: i,
          originalData: item
        });
      }

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      return {
        success: true,
        summary: {
          total: results.length,
          successful: successful.length,
          failed: failed.length,
          successRate: Math.round((successful.length / results.length) * 100)
        },
        results
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  // Generate QR for ticket with specific format
  async generateTicketQR(ticketData, options = {}) {
    try {
      const {
        ticketId,
        ticketNumber,
        eventId,
        eventTitle,
        attendeeName,
        seatNumber,
        eventDate,
        venue
      } = ticketData;

      // Create structured QR data
      const qrData = {
        type: 'TICKET',
        version: '1.0',
        ticketId,
        ticketNumber,
        eventId,
        eventTitle,
        attendee: attendeeName,
        seat: seatNumber,
        date: eventDate,
        venue,
        validatedAt: null,
        generatedAt: new Date().toISOString()
      };

      const filename = `ticket-${ticketNumber}-${Date.now()}`;
      
      const result = await this.generateSingle(JSON.stringify(qrData), {
        filename,
        size: 300,
        margin: 3,
        ...options
      });

      if (result.success) {
        result.data.ticketData = qrData;
        result.data.type = 'ticket';
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  // Generate QR for event check-in
  async generateEventCheckInQR(eventData, options = {}) {
    try {
      const {
        eventId,
        eventTitle,
        checkInCode,
        validUntil,
        gate = 'Main Gate'
      } = eventData;

      const qrData = {
        type: 'CHECK_IN',
        version: '1.0',
        eventId,
        eventTitle,
        checkInCode,
        gate,
        validUntil,
        generatedAt: new Date().toISOString()
      };

      const filename = `checkin-${eventId}-${Date.now()}`;
      
      const result = await this.generateSingle(JSON.stringify(qrData), {
        filename,
        size: 400,
        darkColor: '#1F2937',
        lightColor: '#FFFFFF',
        ...options
      });

      if (result.success) {
        result.data.eventData = qrData;
        result.data.type = 'check_in';
      }

      return result;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  // Validate QR code data
  async validateQRData(qrString) {
    try {
      const qrData = JSON.parse(qrString);
      
      // Basic structure validation
      const requiredFields = ['type', 'version'];
      const missingFields = requiredFields.filter(field => !qrData[field]);
      
      if (missingFields.length > 0) {
        return {
          valid: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
          data: null
        };
      }

      // Type-specific validation
      switch (qrData.type) {
        case 'TICKET':
          return this.validateTicketQR(qrData);
        case 'CHECK_IN':
          return this.validateCheckInQR(qrData);
        default:
          return {
            valid: false,
            error: 'Unknown QR code type',
            data: null
          };
      }

    } catch (error) {
      return {
        valid: false,
        error: 'Invalid QR code format - not valid JSON',
        data: null
      };
    }
  }

  // Validate ticket QR
  validateTicketQR(qrData) {
    const requiredFields = ['ticketId', 'eventId', 'ticketNumber', 'attendee'];
    const missingFields = requiredFields.filter(field => !qrData[field]);
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Missing ticket fields: ${missingFields.join(', ')}`,
        data: null
      };
    }

    return {
      valid: true,
      type: 'ticket',
      data: qrData
    };
  }

  // Validate check-in QR
  validateCheckInQR(qrData) {
    const requiredFields = ['eventId', 'checkInCode'];
    const missingFields = requiredFields.filter(field => !qrData[field]);
    
    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Missing check-in fields: ${missingFields.join(', ')}`,
        data: null
      };
    }

    // Check if QR is expired
    if (qrData.validUntil && new Date(qrData.validUntil) < new Date()) {
      return {
        valid: false,
        error: 'QR code has expired',
        data: null
      };
    }

    return {
      valid: true,
      type: 'check_in',
      data: qrData
    };
  }

  // Delete QR code file
  async deleteQR(filename) {
    try {
      const filePath = path.join(this.qrCodesDir, filename);
      await fs.unlink(filePath);
      return {
        success: true,
        message: 'QR code deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get file size
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        bytes: stats.size,
        kb: Math.round(stats.size / 1024 * 100) / 100,
        mb: Math.round(stats.size / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      return null;
    }
  }

  // Clean old QR codes (older than specified days)
  async cleanupOldQRs(daysOld = 30) {
    try {
      const files = await fs.readdir(this.qrCodesDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let deletedCount = 0;
      let errors = [];

      for (const file of files) {
        try {
          const filePath = path.join(this.qrCodesDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            deletedCount++;
          }
        } catch (error) {
          errors.push({ file, error: error.message });
        }
      }

      return {
        success: true,
        deletedCount,
        errors: errors.length > 0 ? errors : null,
        message: `Cleaned up ${deletedCount} old QR codes`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        deletedCount: 0
      };
    }
  }
}

// Export singleton instance
module.exports = new QRGenerator();