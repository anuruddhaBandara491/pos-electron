/**
 * ReceiptService.js
 * Backend-driven receipt generation, formatting, and thermal printer handling
 * 
 * Features:
 * - Fetch receipt JSON from backend
 * - Format for thermal printer (58mm standard width)
 * - Support reprint functionality
 * - Handle print failures with retry logic
 * - Multi-language text support
 * 
 * Architecture: Backend is source of truth for receipt content
 */

import log from '../utils/logger';

class ReceiptService {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.printQueue = new Map(); // Track pending print jobs
    this.reprintCache = new Map(); // Cache receipts for reprinting
    this.printAttempts = new Map(); // Track retry attempts
    this.maxPrintRetries = 3;
    this.printTimeout = 30000; // 30 second timeout per print job
    this.supportedLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
    this.defaultLanguage = 'en';
  }

  /**
   * Fetch receipt from backend
   * Backend returns complete receipt data structure
   */
  async fetchReceipt(orderId, language = this.defaultLanguage) {
    try {
      const startTime = Date.now();
      
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      // Validate language support
      const validLanguage = this.supportedLanguages.includes(language) 
        ? language 
        : this.defaultLanguage;

      log.info(`[RECEIPT_FETCH] orderId=${orderId}, language=${validLanguage}`);

      // GET /receipts/{orderId}?language={language}
      const response = await this.apiClient.get(
        `/receipts/${orderId}`,
        {
          params: { language: validLanguage },
          timeout: 10000
        }
      );

      if (!response.data || !response.data.success) {
        throw new Error('Invalid receipt response from backend');
      }

      const receipt = response.data.receipt;
      
      // Validate receipt structure
      this._validateReceiptStructure(receipt);

      // Cache for reprint
      this.reprintCache.set(receipt.receiptId, {
        receipt,
        language: validLanguage,
        fetchedAt: new Date().toISOString()
      });

      const duration = Date.now() - startTime;
      log.info(
        `[RECEIPT_FETCHED] receiptId=${receipt.receiptId}, duration=${duration}ms`
      );

      return receipt;

    } catch (error) {
      log.error('[RECEIPT_FETCH_ERROR]', error.message);
      throw {
        code: 'RECEIPT_FETCH_ERROR',
        message: error.message || 'Failed to fetch receipt from backend'
      };
    }
  }

  /**
   * Validate receipt structure from backend
   */
  _validateReceiptStructure(receipt) {
    const required = ['receiptId', 'orderId', 'header', 'items', 'footer'];
    for (const field of required) {
      if (!receipt[field]) {
        throw new Error(`Missing required receipt field: ${field}`);
      }
    }

    // Validate items array
    if (!Array.isArray(receipt.items) || receipt.items.length === 0) {
      throw new Error('Receipt must contain at least one item');
    }

    // Validate each item
    receipt.items.forEach((item, idx) => {
      if (!item.description || item.quantity === undefined || item.amount === undefined) {
        throw new Error(`Invalid item at index ${idx}`);
      }
    });
  }

  /**
   * Format receipt for 58mm thermal printer
   * Standard thermal printer width: 32 characters at 12pt monospace
   */
  formatReceiptForPrinter(receipt, language = this.defaultLanguage) {
    try {
      log.info(`[FORMAT_RECEIPT] receiptId=${receipt.receiptId}`);

      const width = 32; // Thermal printer character width
      const lines = [];

      // HEADER
      if (receipt.header) {
        lines.push(this._formatHeader(receipt.header, width));
      }

      // RECEIPT METADATA
      lines.push('');
      lines.push(this._centerText(receipt.receiptId, width));
      lines.push(this._centerText(receipt.timestamp || new Date().toLocaleString(), width));
      lines.push('');

      // SEPARATOR
      lines.push(this._repeatChar('-', width));
      lines.push('');

      // ITEMS
      lines.push(this._formatItems(receipt.items, width, language));

      // TOTALS SECTION
      if (receipt.totals) {
        lines.push('');
        lines.push(this._repeatChar('-', width));
        lines.push(this._formatTotals(receipt.totals, width, language));
      }

      // PAYMENT SECTION
      if (receipt.payment) {
        lines.push('');
        lines.push(this._formatPayment(receipt.payment, width, language));
      }

      // FOOTER
      if (receipt.footer) {
        lines.push('');
        lines.push(this._formatFooter(receipt.footer, width));
      }

      // FOOTER MESSAGE
      lines.push('');
      lines.push(this._centerText('THANK YOU!', width));
      lines.push('');
      lines.push(this._repeatChar('-', width));

      const formatted = lines.join('\n');

      log.info(
        `[FORMAT_RECEIPT_SUCCESS] receiptId=${receipt.receiptId}, ` +
        `lines=${lines.length}, chars=${formatted.length}`
      );

      return formatted;

    } catch (error) {
      log.error('[FORMAT_RECEIPT_ERROR]', error.message);
      throw {
        code: 'FORMAT_ERROR',
        message: error.message || 'Failed to format receipt'
      };
    }
  }

  /**
   * Format receipt header
   */
  _formatHeader(header, width) {
    const lines = [];

    if (header.businessName) {
      lines.push(this._centerText(header.businessName, width));
    }

    if (header.address) {
      lines.push(this._centerText(header.address, width));
    }

    if (header.phone) {
      lines.push(this._centerText(header.phone, width));
    }

    if (header.taxId) {
      lines.push(this._centerText(`Tax ID: ${header.taxId}`, width));
    }

    return lines.join('\n');
  }

  /**
   * Format receipt items with proper alignment
   */
  _formatItems(items, width, language) {
    const lines = [];

    // Column headers
    const descWidth = width - 12;
    const qtyWidth = 4;
    const priceWidth = 8;

    const header = this._padRight('DESCRIPTION', descWidth) +
                   this._padRight('QTY', qtyWidth) +
                   this._padRight('PRICE', priceWidth);
    lines.push(header);
    lines.push(this._repeatChar('-', width));

    // Items
    items.forEach(item => {
      const description = this._truncate(item.description, descWidth);
      const qty = String(item.quantity).padStart(qtyWidth);
      const price = this._formatPrice(item.amount).padStart(priceWidth);

      lines.push(
        this._padRight(description, descWidth) +
        this._padRight(qty, qtyWidth) +
        this._padRight(price, priceWidth)
      );

      // Item note if present
      if (item.note) {
        lines.push('  ' + this._truncate(item.note, descWidth - 2));
      }
    });

    return lines.join('\n');
  }

  /**
   * Format totals section
   */
  _formatTotals(totals, width, language) {
    const lines = [];

    if (totals.subtotal !== undefined) {
      lines.push(this._rightAlignLine('SUBTOTAL:', this._formatPrice(totals.subtotal), width));
    }

    if (totals.tax !== undefined) {
      const taxLabel = this._getTranslation('tax', language);
      lines.push(this._rightAlignLine(taxLabel + ':', this._formatPrice(totals.tax), width));
    }

    if (totals.discount !== undefined && totals.discount > 0) {
      const discountLabel = this._getTranslation('discount', language);
      lines.push(this._rightAlignLine(discountLabel + ':', '-' + this._formatPrice(totals.discount), width));
    }

    if (totals.total !== undefined) {
      lines.push(this._repeatChar('-', width));
      lines.push(this._rightAlignLine('TOTAL:', this._formatPrice(totals.total), width));
    }

    return lines.join('\n');
  }

  /**
   * Format payment section
   */
  _formatPayment(payment, width, language) {
    const lines = [];

    if (payment.method) {
      const methodLabel = this._getTranslation('payment_method', language);
      lines.push(this._rightAlignLine(methodLabel + ':', payment.method, width));
    }

    if (payment.amountPaid !== undefined) {
      const paidLabel = this._getTranslation('amount_paid', language);
      lines.push(this._rightAlignLine(paidLabel + ':', this._formatPrice(payment.amountPaid), width));
    }

    if (payment.change !== undefined && payment.change > 0) {
      const changeLabel = this._getTranslation('change', language);
      lines.push(this._rightAlignLine(changeLabel + ':', this._formatPrice(payment.change), width));
    }

    return lines.join('\n');
  }

  /**
   * Format receipt footer
   */
  _formatFooter(footer, width) {
    const lines = [];

    if (footer.message) {
      lines.push(this._centerText(footer.message, width));
    }

    if (footer.website) {
      lines.push(this._centerText(footer.website, width));
    }

    if (footer.returnPolicy) {
      lines.push('');
      lines.push(this._wrapText(footer.returnPolicy, width));
    }

    return lines.join('\n');
  }

  /**
   * Get translated text
   */
  _getTranslation(key, language) {
    const translations = {
      en: {
        tax: 'Tax',
        discount: 'Discount',
        payment_method: 'Payment Method',
        amount_paid: 'Amount Paid',
        change: 'Change',
        thank_you: 'Thank You',
        reprint: 'Reprint',
        copy: 'Copy'
      },
      es: {
        tax: 'Impuesto',
        discount: 'Descuento',
        payment_method: 'Método de Pago',
        amount_paid: 'Cantidad Pagada',
        change: 'Cambio',
        thank_you: 'Gracias',
        reprint: 'Reimprimir',
        copy: 'Copia'
      },
      fr: {
        tax: 'Taxe',
        discount: 'Remise',
        payment_method: 'Mode de Paiement',
        amount_paid: 'Montant Payé',
        change: 'Monnaie',
        thank_you: 'Merci',
        reprint: 'Réimprimer',
        copy: 'Copie'
      },
      de: {
        tax: 'Steuern',
        discount: 'Rabatt',
        payment_method: 'Zahlungsmittel',
        amount_paid: 'Gezahlter Betrag',
        change: 'Wechsel',
        thank_you: 'Danke',
        reprint: 'Nachdrucken',
        copy: 'Kopie'
      },
      zh: {
        tax: '税',
        discount: '折扣',
        payment_method: '付款方式',
        amount_paid: '支付金额',
        change: '零钱',
        thank_you: '谢谢',
        reprint: '重新打印',
        copy: '副本'
      },
      ja: {
        tax: '税金',
        discount: '割引',
        payment_method: '支払い方法',
        amount_paid: '支払い金額',
        change: 'お釣り',
        thank_you: 'ありがとう',
        reprint: '再印刷',
        copy: 'コピー'
      }
    };

    const lang = translations[language] || translations[this.defaultLanguage];
    return lang[key] || key;
  }

  /**
   * Print receipt to thermal printer
   */
  async printReceipt(receipt, language = this.defaultLanguage) {
    try {
      const printJobId = `print_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      log.info(`[PRINT_RECEIPT_START] receiptId=${receipt.receiptId}, printJobId=${printJobId}`);

      // Add to queue
      const printPromise = this._executePrintWithRetry(receipt, language, printJobId);
      this.printQueue.set(printJobId, {
        receiptId: receipt.receiptId,
        status: 'pending',
        startTime: Date.now(),
        attempts: 0
      });

      const result = await printPromise;

      this.printQueue.set(printJobId, {
        ...this.printQueue.get(printJobId),
        status: 'completed',
        completedAt: Date.now()
      });

      log.info(`[PRINT_RECEIPT_SUCCESS] printJobId=${printJobId}`);
      return result;

    } catch (error) {
      log.error('[PRINT_RECEIPT_ERROR]', error.message);
      throw {
        code: 'PRINT_ERROR',
        message: error.message || 'Failed to print receipt',
        printJobId: error.printJobId
      };
    }
  }

  /**
   * Execute print with retry logic
   */
  async _executePrintWithRetry(receipt, language, printJobId, attempt = 1) {
    try {
      const formatted = this.formatReceiptForPrinter(receipt, language);

      // Call backend to send to printer (backend handles actual printer communication)
      const response = await this.apiClient.post(
        '/receipts/print',
        {
          receiptId: receipt.receiptId,
          content: formatted,
          language,
          attempt,
          printJobId
        },
        {
          timeout: this.printTimeout
        }
      );

      if (!response.data || !response.data.success) {
        throw new Error('Backend print request failed');
      }

      return {
        printJobId,
        receiptId: receipt.receiptId,
        attempt,
        timestamp: new Date().toISOString(),
        status: 'success'
      };

    } catch (error) {
      // Retry logic
      if (attempt < this.maxPrintRetries) {
        const backoffDelay = Math.pow(2, attempt - 1) * 500; // Exponential backoff
        log.warn(
          `[PRINT_RETRY] printJobId=${printJobId}, attempt=${attempt}, ` +
          `delay=${backoffDelay}ms`
        );

        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this._executePrintWithRetry(receipt, language, printJobId, attempt + 1);
      }

      const err = new Error(
        `Print failed after ${attempt} attempts: ${error.message}`
      );
      err.printJobId = printJobId;
      err.attempts = attempt;
      throw err;
    }
  }

  /**
   * Reprint existing receipt
   */
  async reprintReceipt(receiptId, language = this.defaultLanguage) {
    try {
      log.info(`[REPRINT_RECEIPT] receiptId=${receiptId}, language=${language}`);

      // Check cache first
      if (this.reprintCache.has(receiptId)) {
        const cached = this.reprintCache.get(receiptId);
        log.info(`[REPRINT_FROM_CACHE] receiptId=${receiptId}`);

        // Still validate with backend
        await this._validateReceiptExists(receiptId);
        
        return this.printReceipt(cached.receipt, language);
      }

      // Fetch from backend if not in cache
      const receipt = await this.fetchReceipt(receiptId, language);
      return this.printReceipt(receipt, language);

    } catch (error) {
      log.error('[REPRINT_ERROR]', error.message);
      throw {
        code: 'REPRINT_ERROR',
        message: error.message || 'Failed to reprint receipt'
      };
    }
  }

  /**
   * Validate receipt exists on backend
   */
  async _validateReceiptExists(receiptId) {
    try {
      const response = await this.apiClient.get(
        `/receipts/${receiptId}/validate`,
        { timeout: 5000 }
      );

      return response.data && response.data.success;

    } catch (error) {
      throw new Error(`Receipt not found: ${receiptId}`);
    }
  }

  /**
   * Get receipt history
   */
  async getReceiptHistory(orderId, limit = 10) {
    try {
      log.info(`[RECEIPT_HISTORY] orderId=${orderId}, limit=${limit}`);

      const response = await this.apiClient.get(
        `/receipts/history/${orderId}`,
        {
          params: { limit },
          timeout: 10000
        }
      );

      if (!response.data || !response.data.success) {
        throw new Error('Invalid receipt history response');
      }

      return response.data.history || [];

    } catch (error) {
      log.error('[RECEIPT_HISTORY_ERROR]', error.message);
      throw {
        code: 'HISTORY_ERROR',
        message: error.message || 'Failed to fetch receipt history'
      };
    }
  }

  /**
   * Get print job status
   */
  getPrintJobStatus(printJobId) {
    return this.printQueue.get(printJobId) || null;
  }

  /**
   * Get all active print jobs
   */
  getActivePrintJobs() {
    return Array.from(this.printQueue.values())
      .filter(job => job.status === 'pending');
  }

  /**
   * Clear print cache
   */
  clearPrintCache() {
    this.reprintCache.clear();
    this.printQueue.clear();
    this.printAttempts.clear();
    log.info('[CACHE_CLEARED]');
  }

  /**
   * TEXT FORMATTING UTILITIES
   */

  _centerText(text, width) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  _padRight(text, width) {
    return text.slice(0, width).padEnd(width, ' ');
  }

  _rightAlignLine(label, value, width) {
    const content = label + ' ' + value;
    return content.length > width 
      ? content.slice(0, width) 
      : content.padStart(width, ' ');
  }

  _truncate(text, width) {
    return text.length > width 
      ? text.slice(0, width - 3) + '...' 
      : text;
  }

  _wrapText(text, width) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + ' ' + word).length > width) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
  }

  _repeatChar(char, count) {
    return char.repeat(count);
  }

  _formatPrice(amount) {
    return '$' + Number(amount).toFixed(2);
  }
}

export default ReceiptService;

