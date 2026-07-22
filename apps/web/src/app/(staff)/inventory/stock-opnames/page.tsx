'use client';

import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { stockOpnameApi, type StockOpname } from '@/lib/stockOpnameApi';
import { showToast } from '@/lib/toast';

export default function StockOpnamePage() {
  const [rows, setRows] = useState<StockOpname[]>([]); const [loading, setLoading] = useState(true);
  const reload = async () => { setLoading(true); try { setRows((await stockOpnameApi.list()).data); } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Gagal memuat stock opname.'); } finally { setLoading(false); } };
  useEffect(() => { void reload(); }, []);
  const act = async (operation: () => Promise<unknown>, message: string) => { try { await operation(); showToast.success(message); await reload(); } catch (error: any) { showToast.error(error.response?.data?.error?.message || 'Aksi gagal.'); } };
  return <div className="mx-auto max-w-7xl space-y-5"><header><h1 className="flex items-center gap-2 text-2xl font-semibold"><ClipboardCheck/> Stock Opname</h1><p className="text-sm text-neutral-500">Snapshot fisik, approval maker-checker, mutation FIFO, dan jurnal adjustment.</p></header>{loading ? <p>Memuat…</p> : <div className="overflow-x-auto rounded-xl border bg-white dark:bg-neutral-900"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-3">Dokumen</th><th className="p-3">Status</th><th className="p-3">Selisih</th><th className="p-3">Nilai</th><th className="p-3">Journal</th><th className="p-3">Aksi</th></tr></thead><tbody>{rows.map((row) => <tr className="border-t" key={row.id}><td className="p-3"><b>{row.opnameNumber}</b><small className="block">{new Date(row.countedAt).toLocaleString('id-ID')}</small></td><td className="p-3">{row.status}</td><td className="p-3">{row.lines.filter((line) => Number(line.differenceQty) !== 0).length}/{row.lines.length} baris</td><td className="p-3">Rp {row.totalAdjustmentValue}</td><td className="p-3">{row.journalEntry?.journalNumber || '-'}</td><td className="p-3"><div className="flex gap-2">{row.status === 'DRAFT' && <button className="rounded border px-2 py-1" onClick={() => void act(() => stockOpnameApi.submit(row.id), 'Opname diajukan.')}>Submit</button>}{row.status === 'SUBMITTED' && <><button className="rounded border px-2 py-1" onClick={() => void act(() => stockOpnameApi.approve(row.id), 'Keputusan approval disimpan.')}>Approve</button><button className="rounded border px-2 py-1" onClick={() => { const note = prompt('Alasan penolakan'); if (note) void act(() => stockOpnameApi.reject(row.id, note), 'Opname ditolak.'); }}>Reject</button></>}</div></td></tr>)}</tbody></table></div>}</div>;
}
