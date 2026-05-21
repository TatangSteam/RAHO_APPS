'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileText, Info, Image, Trash2, RefreshCw, Building2, CreditCard } from 'lucide-react';
import { StockRequest } from '../types';
import { showToast } from '@/lib/toast';

interface UploadPaymentModalProps {
  request: StockRequest;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
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

  const processFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      showToast.error('Hanya file gambar yang diperbolehkan');
      return;
    }
    
    if (selectedFile.size > 5 * 1024 * 1024) {
      showToast.error('Ukuran file maksimal 5MB');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

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
    await onUpload(file);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  if (!mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl transform transition-all max-h-[90vh] flex flex-col"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/30">
                <Upload className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Upload Bukti Pembayaran
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {request.requestCode}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Request Info Card */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium">{request.branchName}</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-amber-500/20 text-amber-400">
                      PARTNERSHIP
                    </span>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                  💰 Menunggu Pembayaran
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Info className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-400 mb-1">Informasi</h4>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Upload bukti pembayaran yang dikirimkan oleh Admin Cabang melalui WhatsApp atau Email. 
                    Setelah diupload, Anda dapat memverifikasi dan mengkonfirmasi pembayaran.
                  </p>
                </div>
              </div>
            </div>

            {/* Invoice Info */}
            {request.invoice && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-emerald-400 mb-2">Detail Invoice</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">
                          {request.invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {request.itemCount} item
                        </p>
                      </div>
                      <p className="text-xl font-bold text-emerald-400">
                        {formatCurrency(request.invoice.totalAmount)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Section */}
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-5 w-5 text-purple-400" />
                <h4 className="text-sm font-semibold text-purple-400">File Bukti Pembayaran</h4>
              </div>
              
              {!preview ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('payment-file-input')?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragActive 
                      ? 'border-purple-500 bg-purple-500/20' 
                      : 'border-purple-500/40 bg-purple-500/5 hover:border-purple-500/60 hover:bg-purple-500/10'
                  }`}
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Image className="h-8 w-8 text-purple-400" />
                  </div>
                  <p className="font-semibold text-neutral-900 dark:text-white mb-1">
                    {dragActive ? 'Lepaskan file di sini' : 'Drag & drop atau klik untuk memilih'}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Format: JPG, PNG, JPEG (Maks. 5MB)
                  </p>
                  <input
                    id="payment-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden bg-neutral-900/50 border border-purple-500/20">
                    <img 
                      src={preview} 
                      alt="Preview"
                      className="w-full max-h-[250px] object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-neutral-900 dark:text-white truncate">
                          {file?.name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {file ? `${(file.size / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={removeFile}
                      className="flex-shrink-0 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 flex-shrink-0">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                file
                  ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-500/30'
                  : 'bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
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
