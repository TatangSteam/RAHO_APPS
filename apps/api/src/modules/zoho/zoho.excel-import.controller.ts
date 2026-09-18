import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { AppError } from '@middleware/errorHandler';
import { sendSuccess } from '@utils/response';
import { enqueueExcelImport, previewExcelImport } from './zoho.excel-import.service';
import { importFields, importTypeSchema } from './zoho.excel-import.policy';
import { inspectImportWorkbook, MAX_IMPORT_BYTES, readImportWorkbook } from './zoho.excel-import.workbook';

export const excelImportLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
export const excelImportUpload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: MAX_IMPORT_BYTES, files: 1, fields: 5, fieldSize: 4000 },
  fileFilter: (_req, file, callback) => {
    if (!/\.xlsx$/i.test(file.originalname)) return callback(new AppError(400, 'ZOHO_EXCEL_FORMAT', 'Pilih file .xlsx, bukan .xls, CSV atau file macro.'));
    callback(null, true);
  },
}).single('file');

const headerRowSchema = z.coerce.number().int().min(1).max(100).default(1);
function fileBuffer(req: Request) {
  if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Pilih file Excel terlebih dahulu.');
  return req.file.buffer;
}

export async function inspectExcel(req: Request, res: Response, next: NextFunction) {
  try {
    const headerRow = headerRowSchema.parse(req.body.headerRow);
    sendSuccess(res, inspectImportWorkbook(await readImportWorkbook(fileBuffer(req)), headerRow));
  } catch (error) { next(error); }
}

export async function previewExcel(req: Request, res: Response, next: NextFunction) {
  try {
    let mapping: unknown;
    try { mapping = JSON.parse(req.body.mapping); }
    catch { throw new AppError(400, 'ZOHO_EXCEL_MAPPING', 'Pemetaan kolom tidak valid.'); }
    const input = {
      type: importTypeSchema.parse(req.body.type), sheetId: z.coerce.number().int().positive().parse(req.body.sheetId),
      headerRow: headerRowSchema.parse(req.body.headerRow), mapping: z.record(z.string().regex(/^\d{1,3}$/)).parse(mapping),
    };
    sendSuccess(res, await previewExcelImport(req.user!.id, fileBuffer(req), input));
  } catch (error) { next(error); }
}

export async function commitExcel(req: Request, res: Response, next: NextFunction) {
  try { sendSuccess(res, await enqueueExcelImport(req.user!.id, req.body), 202); }
  catch (error) { next(error); }
}

export async function templateExcel(req: Request, res: Response, next: NextFunction) {
  try {
    const type = importTypeSchema.parse(req.query.type);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type);
    sheet.columns = importFields[type].map((field) => ({ header: field, key: field, width: field === 'address' ? 50 : 28 }));
    sheet.getRow(1).font = { bold: true };
    if (type !== 'item') sheet.getColumn('phone').numFmt = '@';
    if (type === 'item') sheet.getColumn('sku').numFmt = '@';
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template-zoho-${type}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) { next(error); }
}
