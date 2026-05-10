'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FileText, Stethoscope, CreditCard, Mic, Plus, Loader2, X, PlusCircle, Check, Clock, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type PatientDetailTabsProps = {
  patient: any;
  treatments: any[];
  notes: any[];
};

export function PatientDetailTabs({ patient, treatments: initialTreatments, notes: initialNotes }: PatientDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<'treatments' | 'payments' | 'notes'>('treatments');
  const [treatments, setTreatments] = useState(initialTreatments);
  const [notes, setNotes] = useState(initialNotes);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingTreatmentId, setDeletingTreatmentId] = useState<string | null>(null);

  // Payment addition state — keyed by treatment id
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);

  const totalDebt = treatments.reduce((sum, t) => sum + Number(t.agreed_price || 0), 0);
  const totalPaid = treatments.reduce((sum, t) => sum + Number(t.paid_amount || 0), 0);
  const remainingDebt = totalDebt - totalPaid;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

  // ── Add payment to a treatment ─────────────────────────────
  const handleAddPayment = async (treatment: any) => {
    const extra = parseFloat(paymentInputs[treatment.id] || '0');
    if (!extra || extra <= 0) {
      toast.error('Geçerli bir tutar girin.');
      return;
    }
    const newPaid = Number(treatment.paid_amount || 0) + extra;
    const cappedPaid = Math.min(newPaid, Number(treatment.agreed_price || 0));

    setPayingId(treatment.id);
    try {
      const { error } = await supabase
        .from('treatments')
        .update({ paid_amount: cappedPaid })
        .eq('id', treatment.id);
      if (error) throw error;

      setTreatments(prev =>
        prev.map(t => t.id === treatment.id ? { ...t, paid_amount: cappedPaid } : t)
      );
      setPaymentInputs(prev => ({ ...prev, [treatment.id]: '' }));
      toast.success(`${formatCurrency(extra)} ödeme eklendi.`);
    } catch (err: any) {
      toast.error(err.message || 'Ödeme kaydedilemedi.');
    } finally {
      setPayingId(null);
    }
  };

  // ── Delete treatment ────────────────────────────────────────
  const handleDeleteTreatment = async (treatmentId: string, treatmentName: string) => {
    if (!window.confirm(`"${treatmentName}" tedavisini silmek istediğinize emin misiniz?`)) return;
    setDeletingTreatmentId(treatmentId);
    try {
      const { error } = await supabase.from('treatments').delete().eq('id', treatmentId);
      if (error) throw error;
      setTreatments(prev => prev.filter(t => t.id !== treatmentId));
      toast.success('Tedavi silindi.');
    } catch (err: any) {
      toast.error(err.message || 'Tedavi silinemedi.');
    } finally {
      setDeletingTreatmentId(null);
    }
  };

  // ── Toggle paid status (mark fully paid or reset) ──────────
  const handleTogglePaid = async (treatment: any) => {
    const isFullyPaid = Number(treatment.paid_amount) >= Number(treatment.agreed_price);
    const newPaid = isFullyPaid ? 0 : Number(treatment.agreed_price);

    setPayingId(treatment.id);
    try {
      const { error } = await supabase
        .from('treatments')
        .update({ paid_amount: newPaid })
        .eq('id', treatment.id);
      if (error) throw error;

      setTreatments(prev =>
        prev.map(t => t.id === treatment.id ? { ...t, paid_amount: newPaid } : t)
      );
      toast.success(isFullyPaid ? 'Ödeme sıfırlandı.' : 'Tamamen ödendi olarak işaretlendi.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPayingId(null);
    }
  };

  // ── Save note ───────────────────────────────────────────────
  const handleSaveNote = async () => {
    if (!noteText.trim()) { toast.error('Not boş olamaz.'); return; }
    setSavingNote(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({ patient_id: patient.id, note_text: noteText.trim(), note_type: 'text' })
        .select()
        .single();
      if (error) throw error;
      setNotes(prev => [data, ...prev]);
      setNoteText('');
      setShowNoteForm(false);
      toast.success('Not kaydedildi.');
    } catch (err: any) {
      toast.error(err.message || 'Not kaydedilemedi.');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="mt-8 space-y-6 animate-in slide-in-from-bottom-6 duration-500">

      {/* Tab Navigation */}
      <div className="flex space-x-1 rounded-xl bg-muted/50 p-1 w-full overflow-x-auto">
        {(['treatments', 'payments', 'notes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all flex-1 ${
              activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {tab === 'treatments' && <><Stethoscope className="w-4 h-4 mr-2" /> Tedaviler</>}
            {tab === 'payments' && <><CreditCard className="w-4 h-4 mr-2" /> Ödemeler</>}
            {tab === 'notes' && <><FileText className="w-4 h-4 mr-2" /> Notlar</>}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">

        {/* ── TREATMENTS TAB ── */}
        {activeTab === 'treatments' && (
          <div className="p-0">
            {treatments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Kayıtlı tedavi bulunamadı.</div>
            ) : (
              <div className="w-full overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-6 py-4">Tarih</th>
                      <th className="px-6 py-4">Diş No</th>
                      <th className="px-6 py-4">Tedavi</th>
                      <th className="px-6 py-4">Tutar</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {treatments.map(t => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors group">
                        <td className="px-6 py-4 font-medium">
                          {t.treatment_date ? format(new Date(t.treatment_date), 'dd MMM yyyy', { locale: tr }) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                            {t.tooth_number || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">{t.treatment_name}</td>
                        <td className="px-6 py-4 font-medium text-emerald-600">{formatCurrency(t.agreed_price || 0)}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDeleteTreatment(t.id, t.treatment_name)}
                            disabled={deletingTreatmentId === t.id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50"
                            title="Tedaviyi Sil"
                          >
                            {deletingTreatmentId === t.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PAYMENTS TAB ── */}
        {activeTab === 'payments' && (
          <div className="p-6 space-y-6">

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-muted/20 flex flex-col items-center text-center">
                <p className="text-sm text-muted-foreground mb-1">Toplam Anlaşılan</p>
                <p className="text-2xl font-bold">{formatCurrency(totalDebt)}</p>
              </div>
              <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-700 flex flex-col items-center text-center">
                <p className="text-sm mb-1 opacity-80">Toplam Ödenen</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
              </div>
              <div className={`p-4 rounded-xl border flex flex-col items-center text-center ${remainingDebt > 0 ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-muted/20 text-muted-foreground'}`}>
                <p className="text-sm mb-1 opacity-80">Kalan Borç</p>
                <p className="text-2xl font-bold">{formatCurrency(remainingDebt)}</p>
              </div>
            </div>

            {/* Treatment Rows with payment actions */}
            {treatments.length > 0 && (
              <div className="space-y-3">
                {treatments.map(t => {
                  const agreed = Number(t.agreed_price || 0);
                  const paid = Number(t.paid_amount || 0);
                  const remaining = agreed - paid;
                  const isFullyPaid = remaining <= 0;
                  const progress = agreed > 0 ? Math.min((paid / agreed) * 100, 100) : 0;

                  return (
                    <div key={t.id} className="rounded-xl border p-4 space-y-3 bg-card">
                      {/* Top row: name + status toggle */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{t.treatment_name}</p>
                          {t.payment_method && (
                            <span className="text-xs text-muted-foreground">{t.payment_method}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleTogglePaid(t)}
                          disabled={payingId === t.id}
                          className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                            isFullyPaid
                              ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25'
                          }`}
                        >
                          {payingId === t.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isFullyPaid ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {isFullyPaid ? 'Ödendi' : `${formatCurrency(remaining)} bekliyor`}
                        </button>
                      </div>

                      {/* Amounts */}
                      <div className="flex gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Anlaşılan</p>
                          <p className="font-semibold">{formatCurrency(agreed)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ödenen</p>
                          <p className="font-semibold text-emerald-600">{formatCurrency(paid)}</p>
                        </div>
                        {remaining > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Kalan</p>
                            <p className="font-semibold text-destructive">{formatCurrency(remaining)}</p>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-500' : 'bg-primary'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {/* Add payment input — only if not fully paid */}
                      {!isFullyPaid && (
                        <div className="flex gap-2 pt-1">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₺</span>
                            <input
                              type="number"
                              min="1"
                              max={remaining}
                              placeholder={`Maks. ${formatCurrency(remaining).replace('₺', '').trim()}`}
                              value={paymentInputs[t.id] || ''}
                              onChange={e => setPaymentInputs(prev => ({ ...prev, [t.id]: e.target.value }))}
                              className="w-full h-9 rounded-md border border-input bg-background pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                          <button
                            onClick={() => handleAddPayment(t)}
                            disabled={payingId === t.id || !paymentInputs[t.id]}
                            className="h-9 px-3 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                          >
                            {payingId === t.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PlusCircle className="w-3.5 h-3.5" />
                            )}
                            Ödeme Ekle
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {activeTab === 'notes' && (
          <div className="p-6 space-y-4">
            {!showNoteForm ? (
              <button
                onClick={() => setShowNoteForm(true)}
                className="flex items-center gap-2 h-10 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Not Ekle
              </button>
            ) : (
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Yeni Not</span>
                  <button onClick={() => { setShowNoteForm(false); setNoteText(''); }} className="p-1 rounded hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Not içeriğini yazın..."
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setShowNoteForm(false); setNoteText(''); }}
                    className="h-9 px-4 rounded-md text-sm border hover:bg-muted transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    className="h-9 px-4 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    Kaydet
                  </button>
                </div>
              </div>
            )}

            {notes.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">Henüz not eklenmemiş.</div>
            ) : (
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors flex gap-4 items-start">
                    <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      {n.note_type === 'audio' ? <Mic className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="space-y-1 flex-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(n.created_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                      </span>
                      <p className="text-sm leading-relaxed">{n.note_text}</p>
                      {n.audio_url && <audio controls src={n.audio_url} className="h-8 mt-2 w-full max-w-sm" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
