/**
 * PDF Service for SentinelOps Checklist Instances
 * Handles PDF generation, download, and preview functionality
 */

import api from './api';

export interface PDFRequest {
  instance_id: string;
  include_summary?: boolean;
  include_details?: boolean;
  include_metadata?: boolean;
}

export interface PDFResponse {
  success: boolean;
  message: string;
  filename?: string;
  size_bytes?: number;
}

export interface ChecklistInstanceData {
  success: boolean;
  data: {
    instance_id: string;
    template_name: string;
    checklist_date: string;
    shift: string;
    instance_status: string;
    section_name?: string;
    created_by_name?: string;
    closed_by_name?: string;
    completion_time_seconds?: number;
    exception_count?: number;
    items_data: any[];
    summary_statistics: {
      total_items: number;
      completed_items: number;
      pending_items: number;
      skipped_items: number;
      failed_items: number;
      total_subitems: number;
      completed_subitems: number;
    };
    download_filename?: string;
    completed_by_summary?: string;
  };
}

class PDFService {
  private baseUrl = '/api/pdf';

  /**
   * Generate PDF for checklist instance
   */
  async generatePDF(request: PDFRequest): Promise<PDFResponse> {
    try {
      const response = await api.post<PDFResponse>(`${this.baseUrl}/generate`, request);
      return response.data;
    } catch (error: any) {
      console.error('PDF generation error:', error);
      throw new Error(error.response?.data?.detail || error.message || 'PDF generation failed');
    }
  }

  /**
   * Download PDF for checklist instance
   */
  async downloadPDF(instanceId: string, fallbackFilename?: string): Promise<void> {
    try {
      const response = await api.get(`${this.baseUrl}/download/${instanceId}`, {
        responseType: 'blob',
      });

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      const filename = this.extractFilename(contentDisposition) || fallbackFilename || 'SentinelOps_Checklist.pdf';

      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`✅ PDF downloaded: ${filename}`);
    } catch (error: any) {
      console.error('PDF download error:', error);
      throw new Error(error.response?.data?.detail || error.message || 'PDF download failed');
    }
  }

  /**
   * Preview PDF for checklist instance (inline)
   */
  async previewPDF(instanceId: string): Promise<string> {
    try {
      const response = await api.get(`${this.baseUrl}/preview/${instanceId}`, {
        responseType: 'blob',
      });

      // Convert blob to data URL for preview
      const blob = new Blob([response.data], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch (error: any) {
      console.error('PDF preview error:', error);
      throw new Error(error.response?.data?.detail || error.message || 'PDF preview failed');
    }
  }

  /**
   * Get checklist instance data (JSON format)
   */
  async getChecklistData(instanceId: string): Promise<ChecklistInstanceData> {
    try {
      const response = await api.get<ChecklistInstanceData>(`${this.baseUrl}/instances/${instanceId}/data`);
      return response.data;
    } catch (error: any) {
      console.error('Checklist data fetch error:', error);
      throw new Error(error.response?.data?.detail || error.message || 'Data fetch failed');
    }
  }

  /**
   * Generate and download PDF in one operation
   */
  async generateAndDownloadPDF(instanceId: string, options?: Partial<PDFRequest>): Promise<void> {
    try {
      // Show loading state
      this.showLoadingState('Generating PDF...');

      // Generate PDF first
      const request: PDFRequest = {
        instance_id: instanceId,
        include_summary: true,
        include_details: true,
        include_metadata: true,
        ...options,
      };

      const generateResponse = await this.generatePDF(request);
      
      if (!generateResponse.success) {
        throw new Error(generateResponse.message || 'PDF generation failed');
      }

      // Download the PDF
      await this.downloadPDF(instanceId, generateResponse.filename);

      this.hideLoadingState();
      this.showSuccessMessage('PDF downloaded successfully!');
    } catch (error) {
      this.hideLoadingState();
      this.showErrorMessage(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get formatted filename for PDF
   */
  getFormattedFilename(instanceData: ChecklistInstanceData['data']): string {
    if (instanceData.download_filename) {
      return instanceData.download_filename;
    }

    const shift = this.toTitleCase(instanceData.shift || 'Checklist');
    const shiftLabel = shift.endsWith('_Shift') ? shift : `${shift}_Shift`;
    const date = this.formatDateForFilename(instanceData.checklist_date);
    return `SentinelOps_${shiftLabel}_${date}.pdf`;
  }

  private extractFilename(contentDisposition?: string): string | undefined {
    if (!contentDisposition) {
      return undefined;
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    return basicMatch?.[1];
  }

  private formatDateForFilename(dateValue?: string): string {
    if (!dateValue) {
      return 'Unknown_Date';
    }

    const parts = dateValue.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}_${month}_${year}`;
    }

    return dateValue.replace(/[^0-9a-zA-Z]+/g, '_');
  }

  private toTitleCase(value: string): string {
    return value
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('_');
  }

  /**
   * Show loading state
   */
  private showLoadingState(message: string): void {
    // Create or update loading overlay
    let loadingOverlay = document.getElementById('pdf-loading-overlay');
    
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'pdf-loading-overlay';
      loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 16px;
      `;
      document.body.appendChild(loadingOverlay);
    }

    loadingOverlay.innerHTML = `
      <div style="text-align: center;">
        <div style="
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #023aa3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        "></div>
        <div>${message}</div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  /**
   * Hide loading state
   */
  private hideLoadingState(): void {
    const loadingOverlay = document.getElementById('pdf-loading-overlay');
    if (loadingOverlay) {
      document.body.removeChild(loadingOverlay);
    }
  }

  /**
   * Show success message
   */
  private showSuccessMessage(message: string): void {
    this.showNotification(message, 'success');
  }

  /**
   * Show error message
   */
  private showErrorMessage(message: string): void {
    this.showNotification(message, 'error');
  }

  /**
   * Show notification
   */
  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      background: ${type === 'success' ? '#005423' : '#ff4757'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      max-width: 400px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 5000);
  }
}

export const pdfService = new PDFService();
export default pdfService;
