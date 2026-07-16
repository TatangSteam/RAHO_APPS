-- Add payment account details for stock request invoices
ALTER TABLE "stock_request_invoices" ADD COLUMN "paymentAccountLabel" TEXT;
ALTER TABLE "stock_request_invoices" ADD COLUMN "paymentBankName" TEXT;
ALTER TABLE "stock_request_invoices" ADD COLUMN "paymentAccountNumber" TEXT;
ALTER TABLE "stock_request_invoices" ADD COLUMN "paymentAccountHolder" TEXT;
