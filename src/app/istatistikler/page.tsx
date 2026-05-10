'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { BarChart3, Loader2, ArrowLeft, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

type TreatmentRow = {
  id: string;
  treatment_name: string;
  tooth_number: string | null;
  agreed_price: number;
  paid_amount: number;
  payment_method: string | null;
  treatment_date: string | null;
  created_at: string;
  patients: { full_name: string } | null;
};

type StatItem = {
  treatment_name: string;
  count: number;
  totalRevenue: number;
  ids: string[];
};

export default function IstatistiklerPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TreatmentRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'date' | 'name' | 'treatment' | 'price'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();

      const { data, error } = await supabase
        .from('treatments')
        .select('id, treatment_name, tooth_number, agreed_price, paid_amount, payment_method, treatment_date, created_at, patients(full_name)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows((data as any[]) || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Build summary stats from rows ──────────────────────────
  const stats: StatItem[] = Object.values(
    rows.reduce((acc: Record<string, StatItem>, row) => {
      const name = row.treatment_name || 'Bilinmeyen İşlem';
      if (!acc[name]) acc[name] = { treatment_name: name, count: 0, totalRevenue: 0, ids: [] };
      acc[name].count++;
      acc[name].totalRevenue += Number(row.agreed_price || 0);
      acc[name].ids.push(row.id);
      return acc;
    }, {})
  ).sort((a, b) => b.count - a.count);

  // ── Delete single row ──────────────────────────────────────
  const handleDeleteRow = async (row: TreatmentRow) => {
    if (!window.confirm(`"${row.treatment_name}" tedavisini silmek istediğinize emin misiniz?`)) return;
    setDeletingId(row.id);
    try {
      const { error } = await supabase.from('treatments').delete().eq('id', row.id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== row.id));
    } catch (err: any) {
      alert('Silinemedi: ' + (err.message || 'Hata'));
    } finally {
      setDeletingId(null);
    }
  };

  // ── Delete entire category ─────────────────────────────────
  const handleDeleteCategory = async (stat: StatItem) => {
    if (!window.confirm(`Bu ayki ${stat.count} adet "${stat.treatment_name}" kaydını silmek istiyor musunuz?`)) return;
    setDeletingCategory(stat.treatment_name);
    try {
      const { error } = await supabase.from('treatments').delete().in('id', stat.ids);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.treatment_name !== stat.treatment_name));
    } catch (err: any) {
      alert('Silinemedi: ' + (err.message || 'Hata'));
    } finally {
      setDeletingCategory(null);
    }
  };

  // ── Sorting ────────────────────────────────────────────────
  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'date') {
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortField === 'name') {
      cmp = (a.patients?.full_name || '').localeCompare(b.patients?.full_name || '', 'tr');
    } else if (sortField === 'treatment') {
      cmp = a.treatment_name.localeCompare(b.treatment_name, 'tr');
    } else if (sortField === 'price') {
      cmp = Number(a.agreed_price) - Number(b.agreed_price);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);

  const currentMonthName = format(new Date(), 'MMMM yyyy', { locale: tr });

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field
      ? sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 ml-1 inline" /> : <ChevronDown className="w-3.5 h-3.5 ml-1 inline" />
      : <ChevronDown className="w-3.5 h-3.5 ml-1 inline opacity-30" />;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              Aylık Yapılan İşlemler
            </h1>
            <p className="text-muted-foreground capitalize text-lg ml-[60px]">{currentMonthName} İstatistikleri</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium bg-muted/50 hover:bg-muted/80 px-4 py-2.5 rounded-lg transition-colors border"
          >
            <ArrowLeft className="w-4 h-4" />
            Ana Sayfaya Dön
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
            <p>İstatistikler Yükleniyor...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-32 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-lg">Bu ay henüz hiçbir işlem kaydedilmemiş.</p>
          </div>
        ) : (
          <>
            {/* ── Özet Kartlar ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="relative flex flex-col p-5 bg-card border rounded-2xl shadow-sm hover:shadow-md transition-shadow group"
                >
                  <button
                    onClick={() => handleDeleteCategory(stat)}
                    disabled={deletingCategory === stat.treatment_name}
                    className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-destructive hover:bg-destructive/10"
                    title="Tüm kayıtları sil"
                  >
                    {deletingCategory === stat.treatment_name
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>

                  <span className="text-4xl font-extrabold text-primary mb-1">{stat.count}</span>
                  <span className="font-semibold text-sm text-foreground leading-tight mb-2">{stat.treatment_name}</span>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full self-start">
                    {formatCurrency(stat.totalRevenue)}
                  </span>
                </div>
              ))}

              {/* Toplam kartı */}
              <div className="flex flex-col p-5 bg-primary/5 border border-primary/20 rounded-2xl shadow-sm">
                <span className="text-4xl font-extrabold text-primary mb-1">
                  {rows.length}
                </span>
                <span className="font-semibold text-sm text-foreground mb-2">Toplam İşlem</span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full self-start">
                  {formatCurrency(rows.reduce((s, r) => s + Number(r.agreed_price || 0), 0))}
                </span>
              </div>
            </div>

            {/* ── Detaylı Tablo ── */}
            <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
                <h2 className="font-semibold text-base">Tüm İşlem Detayları</h2>
                <span className="text-sm text-muted-foreground">{rows.length} kayıt</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('date')}>
                        Tarih <SortIcon field="date" />
                      </th>
                      <th className="px-5 py-3.5 font-semibold cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('name')}>
                        Hasta Adı <SortIcon field="name" />
                      </th>
                      <th className="px-5 py-3.5 font-semibold whitespace-nowrap">
                        Diş No
                      </th>
                      <th className="px-5 py-3.5 font-semibold cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('treatment')}>
                        Tedavi <SortIcon field="treatment" />
                      </th>
                      <th className="px-5 py-3.5 font-semibold whitespace-nowrap">
                        Ödeme Yöntemi
                      </th>
                      <th className="px-5 py-3.5 font-semibold cursor-pointer select-none whitespace-nowrap text-right" onClick={() => toggleSort('price')}>
                        Tutar <SortIcon field="price" />
                      </th>
                      <th className="px-5 py-3.5 font-semibold whitespace-nowrap text-right">
                        Ödenen
                      </th>
                      <th className="px-5 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sorted.map((row) => {
                      const agreed = Number(row.agreed_price || 0);
                      const paid = Number(row.paid_amount || 0);
                      const isFullyPaid = paid >= agreed;
                      const dateStr = row.treatment_date
                        ? format(new Date(row.treatment_date), 'dd MMM yyyy', { locale: tr })
                        : format(new Date(row.created_at), 'dd MMM yyyy', { locale: tr });

                      return (
                        <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                          <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">{dateStr}</td>
                          <td className="px-5 py-3.5 font-medium whitespace-nowrap">
                            {row.patients?.full_name || <span className="text-muted-foreground italic">—</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            {row.tooth_number ? (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs">
                                {row.tooth_number}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">
                              {row.treatment_name}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                            {row.payment_method || '—'}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-right whitespace-nowrap">
                            {formatCurrency(agreed)}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              isFullyPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {isFullyPaid ? 'Ödendi' : formatCurrency(paid)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => handleDeleteRow(row)}
                              disabled={deletingId === row.id}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              title="Sil"
                            >
                              {deletingId === row.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
