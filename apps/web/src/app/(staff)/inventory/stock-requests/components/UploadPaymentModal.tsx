'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Info, ImageIcon, Trash2, RefreshCw, Building2, CreditCard, Download, CheckCircle2 } from 'lucide-react';
import { StockRequest } from '../types';
import { showToast } from '@/lib/toast';
import { generateStockRequestInvoicePDF } from '@/lib/stockRequestInvoicePdf';
import { compressImageWithPreset, formatFileSize, isImageFile } from '@/lib/imageCompressor';
import { devError } from '@/lib/logger';

interface UploadPaymentModalProps {
  request: StockRequest;
  onClose: () => void;
  onUpload: (file: File, amount?: number, notes?: string) => Promise<void>;
  loading: boolean;
}

export default function UploadPaymentModal({ 
  request, 
  onClose, 
  onUpload, 
  loading 
}: UploadPaymentModalProps) {
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{ original: number; compressed: number } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      showToast.error('Hanya file gambar yang diperbolehkan');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 10MB');
      return;
    }

    // Compress the image
    if (isImageFile(selectedFile)) {
      setCompressing(true);
      try {
        const result = await compressImageWithPreset(selectedFile, 'paymentProof');
        setFile(result.file);
        setPreview(URL.createObjectURL(result.blob));
        setCompressionInfo({
          original: result.originalSize,
          compressed: result.compressedSize
        });
      } catch (error) {
        devError('Error compressing image:', error);
        // Fallback to original file
        setFile(selectedFile);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
        setCompressionInfo(null);
      } finally {
        setCompressing(false);
      }
    }
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showToast.error('Pilih file bukti pembayaran terlebih dahulu');
      return;
    }

    const amount = Number(paymentAmount.replace(/\D/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast.error('Masukkan jumlah pembayaran yang valid');
      return;
    }

    if (amount > remainingAmount) {
      showToast.error(`Jumlah pembayaran melebihi sisa utang ${formatCurrency(remainingAmount)}`);
      return;
    }

    await onUpload(file, amount, paymentNotes.trim() || undefined);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatAmountInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits ? new Intl.NumberFormat('id-ID').format(Number(digits)) : '';
  };

  const handleDownloadInvoice = async () => {
    if (!request.invoice) {
      showToast.error('Invoice tidak ditemukan');
      return;
    }
    
    setDownloadingPdf(true);
    try {
      let invoiceItems = request.invoice.items;
      
      if (!invoiceItems || invoiceItems.length === 0) {
        const totalQty = request.items.reduce((sum, i) => sum + i.requestedQty, 0);
        const pricePerUnit = totalQty > 0 ? Math.round(request.invoice.totalAmount / totalQty) : 0;
        
        invoiceItems = request.items.map(item => ({
          id: item.id,
          masterProductId: item.masterProductId,
          productName: item.productName,
          quantity: item.requestedQty,
          pricePerUnit: pricePerUnit,
          subtotal: pricePerUnit * item.requestedQty,
        }));
      }
      
      const invoiceWithItems = {
        ...request,
        invoice: { ...request.invoice, items: invoiceItems },
      };
      
      await generateStockRequestInvoicePDF(invoiceWithItems);
      showToast.success('Invoice PDF berhasil didownload');
    } catch (error) {
      devError('Error generating invoice PDF:', error);
      showToast.error('Gagal membuat PDF invoice');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    setCompressionInfo(null);
  };

  if (!mounted) return null;

  const isDebtInvoice = request.invoice?.status === 'DEBT';
  const totalAmount = request.invoice?.totalAmount ?? 0;
  const paidAmount = request.invoice?.paidAmount ?? 0;
  const remainingAmount = request.invoice?.remainingAmount ?? Math.max(0, totalAmount - paidAmount);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overscroll-contain p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative my-auto w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 shadow-2xl shadow-black/50">
          
          {/* Header */}
          <div className="relative flex-shrink-0 px-6 pt-6 pb-4">
            {/* Decorative gradient line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Upload Bukti Pembayaran</h2>
                  <p className="text-sm text-neutral-400 font-mono">{request.requestCode}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 pb-6">
            
            {/* Branch Info */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50">
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-200">{request.branchName}</span>
              </div>
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {request.branchType}
              </span>
            </div>

            {/* Invoice Card */}
            {request.invoice && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Invoice</span>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-mono text-neutral-300">{request.invoice.invoiceNumber}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {request.itemCount} item{isDebtInvoice ? ' - pembayaran utang' : ''}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(request.invoice.totalAmount)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="rounded-lg bg-neutral-950/40 border border-neutral-800 px-3 py-2">
                    <p className="text-[11px] font-semibold text-neutral-500 uppercase">Terbayar</p>
                    <p className="text-sm font-bold text-emerald-300">{formatCurrency(paidAmount)}</p>
                  </div>
                  <div className="rounded-lg bg-neutral-950/40 border border-neutral-800 px-3 py-2">
                    <p className="text-[11px] font-semibold text-neutral-500 uppercase">Sisa Utang</p>
                    <p className="text-sm font-bold text-amber-300">{formatCurrency(remainingAmount)}</p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadInvoice}
                  disabled={downloadingPdf}
                  className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {downloadingPdf ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Membuat PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Invoice PDF
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Upload Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">Bukti Pembayaran</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-400">Jumlah Pembayaran</label>
                <div className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 focus-within:border-amber-500/70">
                  <span className="text-sm font-bold text-neutral-500">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatAmountInput(paymentAmount)}
                    onChange={(e) => setPaymentAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder="0"
                    className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-neutral-600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-400">Catatan Pembayaran</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  placeholder="Opsional"
                  className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-amber-500/70"
                />
              </div>

              {!preview ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => !compressing && document.getElementById('payment-file-input')?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    compressing
                      ? 'border-blue-500 bg-blue-500/10 cursor-wait'
                      : dragActive 
                        ? 'border-amber-500 bg-amber-500/10' 
                        : 'border-neutral-700 bg-neutral-800/30 hover:border-amber-500/50 hover:bg-neutral-800/50 cursor-pointer'
                  }`}
                >
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-neutral-800 flex items-center justify-center">
                    {compressing ? (
                      <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
                    ) : (
                      <ImageIcon className="w-7 h-7 text-neutral-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-neutral-300 mb-1">
                    {compressing 
                      ? 'Mengkompresi gambar...' 
                      : dragActive 
                        ? 'Lepaskan file di sini' 
                        : 'Drag & drop atau klik untuk memilih'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    JPG, PNG, JPEG • Maks. 10MB (akan dikompresi otomatis)
                  </p>
                  <input
                    id="payment-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={compressing}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Preview Image */}
                  <div className="relative rounded-xl overflow-hidden bg-neutral-900 border border-neutral-700">
                    <img 
                      src={preview} 
                      alt="Preview"
                      className="w-full max-h-48 object-contain"
                    />
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={removeFile}
                        className="p-2 rounded-lg bg-red-500/90 hover:bg-red-500 text-white transition-all shadow-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* File Info */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-200 truncate">{file?.name}</p>
                      <p className="text-xs text-neutral-500">
                        {file ? formatFileSize(file.size) : ''}
                        {compressionInfo && (
                          <span className="text-emerald-400 ml-2">
                            (dikompresi dari {formatFileSize(compressionInfo.original)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300/80 leading-relaxed">
                {isDebtInvoice
                  ? 'Upload bukti pembayaran utang dapat dilakukan berkali-kali. Nominal yang diinput akan mengurangi sisa utang.'
                  : 'Upload bukti pembayaran sebagai Admin Manager. Setelah tersimpan, pembayaran dapat dikonfirmasi untuk membuat pengiriman.'}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-neutral-800 bg-neutral-900/50 px-6 py-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              title={!file ? 'Pilih file bukti pembayaran terlebih dahulu' : undefined}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                file
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload & Simpan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
