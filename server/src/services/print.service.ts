import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { formatCurrency } from '../utils/helpers';

type FullOrder = any; // Prisma order with all relations

class PrintService {
  private async getPrinterConfig(type = 'RECEIPT') {
    const printer = await prisma.printer.findFirst({
      where: { type: type as any, isActive: true, isDefault: true },
    });
    return printer;
  }

  private createPrinter(ipAddress: string, port: number) {
    return new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${ipAddress}:${port}`,
      characterSet: CharacterSet.PC437_USA,
      removeSpecialCharacters: false,
      lineCharacter: '-',
      options: { timeout: 5000 },
    });
  }

  async printReceipt(order: FullOrder, settings: Record<string, string>): Promise<void> {
    const printerConfig = await this.getPrinterConfig('RECEIPT');
    if (!printerConfig?.ipAddress) {
      logger.warn('No receipt printer configured');
      return;
    }

    const printer = this.createPrinter(printerConfig.ipAddress, printerConfig.port ?? 9100);

    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      logger.error(`Printer not reachable: ${printerConfig.ipAddress}`);
      return;
    }

    try {
      // Header
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(settings.restaurant_name ?? 'SonicPOS');
      printer.bold(false);
      printer.setTextNormal();
      printer.println(settings.address ?? '');
      printer.println(settings.phone ?? '');
      printer.drawLine();

      // Order info
      printer.alignLeft();
      printer.println(`Order: ${order.orderNumber}`);
      printer.println(`Type: ${order.type.replace('_', ' ')}`);
      if (order.table) printer.println(`Table: ${order.table.name}`);
      if (order.server) printer.println(`Server: ${order.server.firstName} ${order.server.lastName}`);
      printer.println(`Date: ${new Date(order.createdAt).toLocaleString()}`);
      printer.drawLine();

      // Items
      for (const item of order.items) {
        if (item.status === 'VOIDED') continue;
        const itemTotal = (Number(item.unitPrice) * item.quantity).toFixed(2);
        printer.tableCustom([
          { text: `${item.quantity}x ${item.menuItem.name}`, align: 'LEFT', width: 0.7 },
          { text: `$${itemTotal}`, align: 'RIGHT', width: 0.3 },
        ]);
        // Modifiers
        for (const mod of item.modifiers) {
          printer.println(`   + ${mod.modifier.name}${Number(mod.price) > 0 ? ` ($${Number(mod.price).toFixed(2)})` : ''}`);
        }
        if (item.notes) printer.println(`   Note: ${item.notes}`);
      }

      printer.drawLine();

      // Totals
      printer.tableCustom([{ text: 'Subtotal:', align: 'LEFT', width: 0.6 }, { text: formatCurrency(order.subtotal), align: 'RIGHT', width: 0.4 }]);
      if (Number(order.discountAmount) > 0) {
        printer.tableCustom([{ text: 'Discount:', align: 'LEFT', width: 0.6 }, { text: `-${formatCurrency(order.discountAmount)}`, align: 'RIGHT', width: 0.4 }]);
      }
      printer.tableCustom([{ text: 'Tax:', align: 'LEFT', width: 0.6 }, { text: formatCurrency(order.taxAmount), align: 'RIGHT', width: 0.4 }]);
      if (Number(order.tipAmount) > 0) {
        printer.tableCustom([{ text: 'Tip:', align: 'LEFT', width: 0.6 }, { text: formatCurrency(order.tipAmount), align: 'RIGHT', width: 0.4 }]);
      }
      printer.bold(true);
      printer.tableCustom([{ text: 'TOTAL:', align: 'LEFT', width: 0.6 }, { text: formatCurrency(order.total), align: 'RIGHT', width: 0.4 }]);
      printer.bold(false);

      // Payments
      printer.drawLine();
      for (const payment of order.payments) {
        printer.tableCustom([
          { text: payment.method.replace('_', ' '), align: 'LEFT', width: 0.6 },
          { text: formatCurrency(payment.amount), align: 'RIGHT', width: 0.4 },
        ]);
        if (payment.cashTendered) {
          printer.tableCustom([{ text: 'Cash Tendered:', align: 'LEFT', width: 0.6 }, { text: formatCurrency(payment.cashTendered), align: 'RIGHT', width: 0.4 }]);
          printer.tableCustom([{ text: 'Change:', align: 'LEFT', width: 0.6 }, { text: formatCurrency(payment.changeGiven ?? 0), align: 'RIGHT', width: 0.4 }]);
        }
      }

      // Tip suggestions
      if (order.status !== 'PAID') {
        printer.drawLine();
        printer.alignCenter();
        printer.println('Suggested Tips:');
        const sub = Number(order.subtotal);
        printer.println(`15%: ${formatCurrency(sub * 0.15)}   18%: ${formatCurrency(sub * 0.18)}   20%: ${formatCurrency(sub * 0.20)}`);
      }

      // Footer
      printer.drawLine();
      printer.alignCenter();
      printer.println(settings.receipt_footer ?? 'Thank you!');
      printer.newLine();
      printer.cut();

      await printer.execute();
      logger.info(`Receipt printed for order ${order.orderNumber}`);
    } catch (err) {
      logger.error('Print failed', err);
    }
  }

  async printKitchenTicket(order: FullOrder): Promise<void> {
    const printerConfig = await this.getPrinterConfig('KITCHEN');
    if (!printerConfig?.ipAddress) {
      logger.warn('No kitchen printer configured');
      return;
    }

    const printer = this.createPrinter(printerConfig.ipAddress, printerConfig.port ?? 9100);
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) return;

    try {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println('** KITCHEN **');
      printer.setTextNormal();
      printer.bold(false);
      printer.println(`Order: ${order.orderNumber}`);
      if (order.table) printer.println(`Table: ${order.table.name}`);
      printer.println(`Type: ${order.type.replace('_', ' ')}`);
      printer.println(new Date().toLocaleTimeString());
      printer.drawLine();

      printer.alignLeft();
      for (const item of order.items) {
        if (item.status !== 'SENT' && item.status !== 'IN_PROGRESS') continue;
        printer.bold(true);
        printer.println(`${item.quantity}x ${item.menuItem.name}`);
        printer.bold(false);
        for (const mod of item.modifiers) {
          printer.println(`   + ${mod.modifier.name}`);
        }
        if (item.notes) {
          printer.bold(true);
          printer.println(`   !! ${item.notes}`);
          printer.bold(false);
        }
      }

      if (order.notes) {
        printer.drawLine();
        printer.bold(true);
        printer.println(`ORDER NOTE: ${order.notes}`);
        printer.bold(false);
      }

      printer.newLine();
      printer.cut();
      await printer.execute();
      logger.info(`Kitchen ticket printed for order ${order.orderNumber}`);
    } catch (err) {
      logger.error('Kitchen print failed', err);
    }
  }

  async testPrinter(printerConfig: { ipAddress: string; port: number | null; name: string }): Promise<void> {
    const printer = this.createPrinter(printerConfig.ipAddress, printerConfig.port ?? 9100);
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) throw new Error(`Cannot reach printer at ${printerConfig.ipAddress}`);

    printer.alignCenter();
    printer.bold(true);
    printer.println('** TEST PRINT **');
    printer.bold(false);
    printer.println(printerConfig.name);
    printer.println(new Date().toLocaleString());
    printer.println('SonicPOS is connected!');
    printer.newLine();
    printer.cut();
    await printer.execute();
  }
}

export const printService = new PrintService();
