const ExcelJS = require("exceljs");
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");

class ReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, "..", "uploads", "reports");
    this.ensureDirectories();
  }

  // Ensure reports directory exists
  async ensureDirectories() {
    try {
      await fs.access(this.reportsDir);
    } catch {
      await fs.mkdir(this.reportsDir, { recursive: true });
    }
  }

  // Generate CSV report
  async generateCSV(data, options = {}) {
    try {
      await this.ensureDirectories();

      const {
        filename = `report-${uuidv4()}-${Date.now()}.csv`,
        headers = null,
        delimiter = ",",
        includeHeaders = true,
      } = options;

      if (!data || data.length === 0) {
        throw new Error("No data provided for CSV generation");
      }

      // Auto-generate headers from first row if not provided
      const csvHeaders = headers || Object.keys(data[0]);

      // Build CSV content
      let csvContent = "";

      if (includeHeaders) {
        csvContent += csvHeaders.join(delimiter) + "\n";
      }

      // Add data rows
      data.forEach((row) => {
        const values = csvHeaders.map((header) => {
          let value = row[header] || "";

          // Handle special characters and quotes
          if (typeof value === "string") {
            value = value.replace(/"/g, '""'); // Escape quotes
            if (
              value.includes(delimiter) ||
              value.includes("\n") ||
              value.includes('"')
            ) {
              value = `"${value}"`; // Wrap in quotes if needed
            }
          }

          return value;
        });

        csvContent += values.join(delimiter) + "\n";
      });

      // Write file
      const filePath = path.join(this.reportsDir, filename);
      await fs.writeFile(filePath, csvContent, "utf8");

      return {
        success: true,
        data: {
          filename,
          filePath,
          relativePath: `uploads/reports/${filename}`,
          rowCount: data.length,
          size: await this.getFileSize(filePath),
          createdAt: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generate Excel report
  async generateExcel(data, options = {}) {
    try {
      await this.ensureDirectories();

      const {
        filename = `report-${uuidv4()}-${Date.now()}.xlsx`,
        sheetName = "Report",
        title = "EventX Studio Report",
        includeCharts = false,
        styling = true,
      } = options;

      if (!data || data.length === 0) {
        throw new Error("No data provided for Excel generation");
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "EventX Studio";
      workbook.lastModifiedBy = "EventX Studio";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet(sheetName);

      // Add title
      if (title) {
        worksheet.mergeCells(
          "A1",
          `${String.fromCharCode(65 + Object.keys(data[0]).length - 1)}1`
        );
        const titleCell = worksheet.getCell("A1");
        titleCell.value = title;
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: "center" };

        // Add generation date
        worksheet.mergeCells(
          "A2",
          `${String.fromCharCode(65 + Object.keys(data[0]).length - 1)}2`
        );
        const dateCell = worksheet.getCell("A2");
        dateCell.value = `Generated on: ${new Date().toLocaleString()}`;
        dateCell.font = { size: 11, italic: true };
        dateCell.alignment = { horizontal: "center" };

        // Add empty row
        worksheet.addRow([]);
      }

      // Add headers
      const headers = Object.keys(data[0]);
      const headerRow = worksheet.addRow(headers);

      if (styling) {
        // Style header row
        headerRow.eachCell((cell, colNumber) => {
          cell.font = { bold: true, color: { argb: "FFFFFF" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "366092" },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }

      // Add data rows
      data.forEach((row) => {
        const dataRow = worksheet.addRow(Object.values(row));

        if (styling) {
          // Style data rows
          dataRow.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };

            // Alternate row colors
            if (dataRow.number % 2 === 0) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "F2F2F2" },
              };
            }
          });
        }
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50); // Max width of 50
      });

      // Add summary if requested
      if (options.includeSummary) {
        worksheet.addRow([]);
        const summaryRow = worksheet.addRow(["Summary"]);
        summaryRow.getCell(1).font = { bold: true, size: 14 };

        worksheet.addRow([`Total Records: ${data.length}`]);
        worksheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
      }

      // Write file
      const filePath = path.join(this.reportsDir, filename);
      await workbook.xlsx.writeFile(filePath);

      return {
        success: true,
        data: {
          filename,
          filePath,
          relativePath: `uploads/reports/${filename}`,
          rowCount: data.length,
          size: await this.getFileSize(filePath),
          createdAt: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generate ticket sales report
  async generateTicketSalesReport(tickets, format = "xlsx", options = {}) {
    try {
      const reportData = tickets.map((ticket) => ({
        "Ticket Number": ticket.ticketNumber,
        "Event Title": ticket.event?.title || "N/A",
        "Event Date": ticket.event?.dateTime?.start
          ? new Date(ticket.event.dateTime.start).toLocaleDateString()
          : "N/A",
        "Attendee Name": ticket.attendeeInfo?.name || "N/A",
        "Attendee Email": ticket.attendeeInfo?.email || "N/A",
        "Seat Number": ticket.seatInfo?.seatNumber || "N/A",
        "Original Price": ticket.pricing?.originalPrice || 0,
        "Final Price": ticket.pricing?.finalPrice || 0,
        Discount: ticket.pricing?.discount || 0,
        "Payment Method": ticket.payment?.paymentMethod || "N/A",
        "Payment Status": ticket.payment?.paymentStatus || "N/A",
        "Purchase Date": ticket.purchaseDate
          ? new Date(ticket.purchaseDate).toLocaleDateString()
          : "N/A",
        Status: ticket.status || "N/A",
        "Checked In": ticket.checkIn?.isCheckedIn ? "Yes" : "No",
      }));

      const reportOptions = {
        ...options,
        title: "Ticket Sales Report",
        sheetName: "Ticket Sales",
        filename: options.filename || `ticket-sales-${Date.now()}.${format}`,
      };

      if (format.toLowerCase() === "csv") {
        return await this.generateCSV(reportData, reportOptions);
      } else {
        return await this.generateExcel(reportData, reportOptions);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generate event performance report
  async generateEventPerformanceReport(events, format = "xlsx", options = {}) {
    try {
      const reportData = events.map((event) => ({
        "Event Title": event.title,
        Category: event.category?.name || "N/A",
        Status: event.status,
        "Start Date": event.dateTime?.start
          ? new Date(event.dateTime.start).toLocaleDateString()
          : "N/A",
        Venue: event.venue?.name || "N/A",
        City: event.venue?.city || "N/A",
        "Total Seats": event.capacity?.totalSeats || 0,
        "Available Seats": event.capacity?.availableSeats || 0,
        "Sold Seats": event.capacity?.soldSeats || 0,
        "Occupancy Rate": event.occupancyRate
          ? `${event.occupancyRate.toFixed(2)}%`
          : "0%",
        "Attendance Rate": event.attendanceRate
          ? `${event.attendanceRate.toFixed(2)}%`
          : "0%",
        "Ticket Price": event.pricing?.ticketPrice || 0,
        "Total Revenue": event.revenue || 0,
        Views: event.views || 0,
        "Average Rating": event.averageRating
          ? event.averageRating.toFixed(1)
          : "N/A",
        "Reviews Count": event.reviewsCount || 0,
      }));

      const reportOptions = {
        ...options,
        title: "Event Performance Report",
        sheetName: "Event Performance",
        filename:
          options.filename || `event-performance-${Date.now()}.${format}`,
      };

      if (format.toLowerCase() === "csv") {
        return await this.generateCSV(reportData, reportOptions);
      } else {
        return await this.generateExcel(reportData, reportOptions);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Generate attendee demographics report
  async generateDemographicsReport(
    demographicsData,
    format = "xlsx",
    options = {}
  ) {
    try {
      // Process demographics data into reportable format
      const { ageDistribution, genderDistribution, locationDistribution } =
        demographicsData;

      const reportData = [];

      // Age distribution section
      if (ageDistribution) {
        reportData.push({
          Category: "Age Distribution",
          Subcategory: "",
          Count: "",
          Percentage: "",
        });

        const totalAge = ageDistribution.reduce(
          (sum, item) => sum + item.count,
          0
        );
        ageDistribution.forEach((item) => {
          reportData.push({
            Category: "",
            Subcategory: item._id,
            Count: item.count,
            Percentage: `${((item.count / totalAge) * 100).toFixed(1)}%`,
          });
        });
        reportData.push({
          Category: "",
          Subcategory: "",
          Count: "",
          Percentage: "",
        });
      }

      // Gender distribution section
      if (genderDistribution) {
        reportData.push({
          Category: "Gender Distribution",
          Subcategory: "",
          Count: "",
          Percentage: "",
        });

        const totalGender = genderDistribution.reduce(
          (sum, item) => sum + item.count,
          0
        );
        genderDistribution.forEach((item) => {
          reportData.push({
            Category: "",
            Subcategory: item._id || "Not specified",
            Count: item.count,
            Percentage: `${((item.count / totalGender) * 100).toFixed(1)}%`,
          });
        });
        reportData.push({
          Category: "",
          Subcategory: "",
          Count: "",
          Percentage: "",
        });
      }

      // Location distribution section
      if (locationDistribution) {
        reportData.push({
          Category: "Location Distribution",
          Subcategory: "",
          Count: "",
          Percentage: "",
        });

        const totalLocation = locationDistribution.reduce(
          (sum, item) => sum + item.count,
          0
        );
        locationDistribution.forEach((item) => {
          reportData.push({
            Category: "",
            Subcategory: item._id || "Not specified",
            Count: item.count,
            Percentage: `${((item.count / totalLocation) * 100).toFixed(1)}%`,
          });
        });
      }

      const reportOptions = {
        ...options,
        title: "Attendee Demographics Report",
        sheetName: "Demographics",
        filename: options.filename || `demographics-${Date.now()}.${format}`,
      };

      if (format.toLowerCase() === "csv") {
        return await this.generateCSV(reportData, reportOptions);
      } else {
        return await this.generateExcel(reportData, reportOptions);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Get file size helper
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        bytes: stats.size,
        kb: Math.round((stats.size / 1024) * 100) / 100,
        mb: Math.round((stats.size / (1024 * 1024)) * 100) / 100,
      };
    } catch (error) {
      return null;
    }
  }

  // Delete report file
  async deleteReport(filename) {
    try {
      const filePath = path.join(this.reportsDir, filename);
      await fs.unlink(filePath);
      return {
        success: true,
        message: "Report deleted successfully",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Clean old reports
  async cleanupOldReports(daysOld = 7) {
    try {
      const files = await fs.readdir(this.reportsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;
      let errors = [];

      for (const file of files) {
        try {
          const filePath = path.join(this.reportsDir, file);
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
        message: `Cleaned up ${deletedCount} old reports`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        deletedCount: 0,
      };
    }
  }
}

// Export singleton instance
module.exports = new ReportGenerator();
