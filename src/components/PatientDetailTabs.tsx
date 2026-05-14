'use client';

import { useState } from 'react';
import { format, parse } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FileText, Stethoscope, CreditCard, Mic, Plus, Loader2, X, PlusCircle, Check, Clock, Trash2, Pencil } from 'lucide-react';
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

  // ── Edit Treatment State ───────────────────────────────────
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Edit Installment State ─────────────────────────────────
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [editingInstallmentDate, setEditingInstallmentDate] = useState<string>('');
  const [savingInstallmentEdit, setSavingInstallmentEdit] = useState(false);
  const [deletingInstallmentId, setDeletingInstallmentId] = useState<string | null>(null);

  // ── New Treatment Form ─────────────────────────────────────
  const [showTreatmentForm, setShowTreatmentForm] = useState(false);
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [treatmentForm, setTreatmentForm] = useState({
    treatment_name: '',
    tooth_number: '',
    payment_method: '',
    total_price: '',
    agreed_price: '',
    paid_amount: '',
  });
  const handleTreatmentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setTreatmentForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSaveTreatment = async () => {
    if (!treatmentForm.treatment_name.trim()) { toast.error('Tedavi adı zorunludur.'); return; }
    setSavingTreatment(true);
    try {
      const { data, error } = await supabase.from('treatments').insert({
        patient_id: patient.id,
        treatment_name: treatmentForm.treatment_name.trim(),
        tooth_number: treatmentForm.tooth_number.trim() || null,
        payment_method: treatmentForm.payment_method || null,
        total_price: parseFloat(treatmentForm.total_price) || 0,
        agreed_price: parseFloat(treatmentForm.agreed_price) || parseFloat(treatmentForm.total_price) || 0,
        paid_amount: parseFloat(treatmentForm.paid_amount) || 0,
      }).select().single();
      if (error) throw error;
      setTreatments(prev => [data, ...prev]);
      setTreatmentForm({ treatment_name: '', tooth_number: '', payment_method: '', total_price: '', agreed_price: '', paid_amount: '' });
      setShowTreatmentForm(false);
      toast.success('Tedavi eklendi.');
    } catch (err: any) {
      toast.error(err.message || 'Tedavi kaydedilemedi.');
    } finally {
      setSavingTreatment(false);
    }
  };

  // Payment addition state — keyed by treatment id
  const [paymentInputs, setPaymentInputs] = useState<Record<string, string>>({});
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);

  // Parses payment history from notes
  const paymentHistory = notes
    .map(n => {
      const match = n.note_text?.match(/^(.*?) işlemi için (.*?) ödeme alındı\. \(Ödeme Tarihi: (.*?)\)$/);
      if (match) {
        return {
          id: n.id,
          treatmentName: match[1],
          amountStr: match[2],
          dateStr: match[3],
          rawDate: n.created_at
        };
      }
      return null;
    })
    .filter(Boolean) as { id: string, treatmentName: string, amountStr: string, dateStr: string, rawDate: string }[];

  const totalDebt = treatments.reduce((sum, t) => sum + Number(t.agreed_price || 0), 0);
  const totalPaid = treatments.reduce((sum, t) => sum + Number(t.paid_amount || 0), 0);
  const remainingDebt = totalDebt - totalPaid;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);

  // ── Add payment to a treatment ─────────────────────────────
  const handleAddPayment = async (treatment: any) => {
    const extra = parseFloat(paymentInputs[treatment.id] || '0');
    const pDate = paymentDates[treatment.id] || new Date().toISOString().split('T')[0];
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

      // Add a note about the payment history
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .insert({
          patient_id: patient.id,
          note_text: `${treatment.treatment_name} işlemi için ${formatCurrency(extra)} ödeme alındı. (Ödeme Tarihi: ${format(new Date(pDate), 'dd MMM yyyy', { locale: tr })})`,
          note_type: 'text'
        })
        .select()
        .single();
      
      if (!noteError && noteData) {
        setNotes(prev => [noteData, ...prev]);
      }

      setTreatments(prev =>
        prev.map(t => t.id === treatment.id ? { ...t, paid_amount: cappedPaid } : t)
      );
      setPaymentInputs(prev => ({ ...prev, [treatment.id]: '' }));
      setPaymentDates(prev => ({ ...prev, [treatment.id]: '' }));
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

  // ── Edit treatment ──────────────────────────────────────────
  const handleEditClick = (t: any) => {
    setEditingTreatmentId(t.id);
    setEditingForm({
      treatment_name: t.treatment_name || '',
      tooth_number: t.tooth_number || '',
      agreed_price: t.agreed_price || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingTreatmentId(null);
    setEditingForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingForm.treatment_name?.trim()) {
      toast.error('Tedavi adı zorunludur.');
      return;
    }
    setSavingEdit(true);
    try {
      const { data, error } = await supabase
        .from('treatments')
        .update({
          treatment_name: editingForm.treatment_name.trim(),
          tooth_number: editingForm.tooth_number.trim() || null,
          agreed_price: parseFloat(editingForm.agreed_price) || 0,
        })
        .eq('id', editingTreatmentId)
        .select()
        .single();
        
      if (error) throw error;
      
      setTreatments(prev => prev.map(t => t.id === editingTreatmentId ? { ...t, ...data } : t));
      setEditingTreatmentId(null);
      toast.success('Tedavi güncellendi.');
    } catch (err: any) {
      toast.error(err.message || 'Tedavi güncellenemedi.');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Edit Installment ─────────────────────────────────────────
  const handleEditInstallmentClick = (p: any) => {
    setEditingInstallmentId(p.id);
    try {
      const parsed = parse(p.dateStr, 'dd MMM yyyy', new Date(), { locale: tr });
      setEditingInstallmentDate(format(parsed, 'yyyy-MM-dd'));
    } catch {
      setEditingInstallmentDate('');
    }
  };

  const handleSaveInstallmentDate = async (p: any) => {
    if (!editingInstallmentDate) return;
    setSavingInstallmentEdit(true);
    try {
      const originalNote = notes.find(n => n.id === p.id);
      if (!originalNote) throw new Error('Not bulunamadı');

      const newDateStr = format(new Date(editingInstallmentDate), 'dd MMM yyyy', { locale: tr });
      const newText = originalNote.note_text.replace(/\(Ödeme Tarihi: (.*?)\)/, `(Ödeme Tarihi: ${newDateStr})`);

      const { data, error } = await supabase
        .from('notes')
        .update({ note_text: newText })
        .eq('id', p.id)
        .select()
        .single();
      if (error) throw error;

      setNotes(prev => prev.map(n => n.id === p.id ? data : n));
      setEditingInstallmentId(null);
      toast.success('Ödeme tarihi güncellendi.');
    } catch (err: any) {
      toast.error('Güncellenemedi.');
    } finally {
      setSavingInstallmentEdit(false);
    }
  };

  const handleDeleteInstallment = async (p: any, t: any) => {
    if (!window.confirm(`Bu taksit kaydını silmek istediğinize emin misiniz?`)) return;
    setDeletingInstallmentId(p.id);
    try {
      const { error: noteError } = await supabase.from('notes').delete().eq('id', p.id);
      if (noteError) throw noteError;

      const amountToSubtract = parseFloat(p.amountStr.replace(/\./g, '').replace(',', '.')) || 0;
      const currentPaid = Number(t.paid_amount || 0);
      const newPaid = Math.max(0, currentPaid - amountToSubtract);

      const { error: treatmentError } = await supabase
        .from('treatments')
        .update({ paid_amount: newPaid })
        .eq('id', t.id);
      if (treatmentError) throw treatmentError;

      setNotes(prev => prev.filter(n => n.id !== p.id));
      setTreatments(prev => prev.map(trt => trt.id === t.id ? { ...trt, paid_amount: newPaid } : trt));
      toast.success('Taksit silindi.');
    } catch (err: any) {
      toast.error('Silinemedi.');
    } finally {
      setDeletingInstallmentId(null);
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

      if (!isFullyPaid) {
        const extra = newPaid - Number(treatment.paid_amount);
        const { data: noteData } = await supabase
          .from('notes')
          .insert({
            patient_id: patient.id,
            note_text: `${treatment.treatment_name} işlemi için ${formatCurrency(extra)} ödeme alındı. (Ödeme Tarihi: ${format(new Date(), 'dd MMM yyyy', { locale: tr })})`,
            note_type: 'text'
          })
          .select()
          .single();
        if (noteData) setNotes(prev => [noteData, ...prev]);
      }

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
            {/* Add Treatment Button / Form */}
            <div className="px-4 py-3 border-b bg-muted/20">
              {!showTreatmentForm ? (
                <button
                  onClick={() => setShowTreatmentForm(true)}
                  className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Tedavi Ekle
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Yeni Tedavi</span>
                    <button onClick={() => setShowTreatmentForm(false)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Yapılan İşlem *</label>
                      <input name="treatment_name" value={treatmentForm.treatment_name} onChange={handleTreatmentFormChange}
                        placeholder="Dolgu, Kanal Tedavisi, Diş Çekimi..."
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
                        className="w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Diş Numarası</label>
                      <input name="tooth_number" value={treatmentForm.tooth_number} onChange={handleTreatmentFormChange}
                        placeholder="16, 21..."
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
                        className="w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Ödeme Yöntemi</label>
                      <select name="payment_method" value={treatmentForm.payment_method} onChange={handleTreatmentFormChange}
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
                        className="w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                        <option value="">Seçiniz</option>
                        <option value="Nakit">Nakit</option>
                        <option value="Kredi Kartı">Kredi Kartı</option>
                        <option value="Havale">Havale / EFT</option>
                        <option value="SGK">SGK</option>
                        <option value="Sigorta">Özel Sigorta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Normal Ücret (₺)</label>
                      <input name="total_price" value={treatmentForm.total_price} onChange={handleTreatmentFormChange}
                        placeholder="0" type="text" inputMode="decimal"
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
                        className="w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Anlaşılan Ücret (₺)</label>
                      <input name="agreed_price" value={treatmentForm.agreed_price} onChange={handleTreatmentFormChange}
                        placeholder="0" type="text" inputMode="decimal"
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
                        className="w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Alınan Ücret (₺)</label>
                      <input name="paid_amount" value={treatmentForm.paid_amount} onChange={handleTreatmentFormChange}
                        placeholder="0" type="text" inputMode="decimal"
                        style={{ color: '#111827', backgroundColor: '#ffffff' }}
                        className="w-full h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button onClick={() => setShowTreatmentForm(false)}
                      className="h-9 px-4 rounded-md text-sm border hover:bg-muted transition-colors">İptal</button>
                    <button onClick={handleSaveTreatment} disabled={savingTreatment}
                      className="h-9 px-4 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2">
                      {savingTreatment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Kaydet
                    </button>
                  </div>
                </div>
              )}
            </div>

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
                        {editingTreatmentId === t.id ? (
                          <td colSpan={5} className="px-6 py-4">
                            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full">
                              <input 
                                value={editingForm.treatment_name}
                                onChange={e => setEditingForm({...editingForm, treatment_name: e.target.value})}
                                className="flex-1 h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Tedavi Adı"
                                style={{ color: '#111827', backgroundColor: '#ffffff' }}
                              />
                              <input 
                                value={editingForm.tooth_number}
                                onChange={e => setEditingForm({...editingForm, tooth_number: e.target.value})}
                                className="w-24 h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Diş No"
                                style={{ color: '#111827', backgroundColor: '#ffffff' }}
                              />
                              <input 
                                type="number"
                                value={editingForm.agreed_price}
                                onChange={e => setEditingForm({...editingForm, agreed_price: e.target.value})}
                                className="w-32 h-9 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Tutar (₺)"
                                style={{ color: '#111827', backgroundColor: '#ffffff' }}
                              />
                              <div className="flex gap-2 w-full sm:w-auto justify-end">
                                <button onClick={handleCancelEdit} className="h-9 px-3 rounded-md text-sm border hover:bg-muted transition-colors">İptal</button>
                                <button onClick={handleSaveEdit} disabled={savingEdit} className="h-9 px-3 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center min-w-[72px]">
                                  {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kaydet'}
                                </button>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
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
                              <div className="flex gap-2 transition-opacity justify-end">
                                <button
                                  onClick={() => handleEditClick(t)}
                                  className="p-1.5 rounded-md text-blue-600 hover:bg-blue-600/10 transition-colors"
                                  title="Düzenle"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTreatment(t.id, t.treatment_name)}
                                  disabled={deletingTreatmentId === t.id}
                                  className="p-1.5 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                                  title="Tedaviyi Sil"
                                >
                                  {deletingTreatmentId === t.id
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Trash2 className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </>
                        )}
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
                  const tPayments = paymentHistory.filter(ph => ph.treatmentName === t.treatment_name);

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
                          {isFullyPaid ? `Ödendi ${tPayments.length > 0 ? `(${tPayments[0].dateStr})` : ''}` : `${formatCurrency(remaining)} bekliyor`}
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

                      {/* Installment History */}
                      {tPayments.length > 0 && (
                        <div className="pt-2 border-t mt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Taksit Geçmişi</p>
                          <div className="space-y-1.5">
                            {tPayments.map(p => (
                              <div key={p.id} className="flex justify-between items-center text-xs bg-muted/30 p-2 rounded-md group">
                                {editingInstallmentId === p.id ? (
                                  <div className="flex gap-2 w-full justify-between items-center">
                                    <input 
                                      type="date"
                                      value={editingInstallmentDate}
                                      onChange={e => setEditingInstallmentDate(e.target.value)}
                                      style={{ color: '#111827', backgroundColor: '#ffffff' }}
                                      className="h-7 px-2 rounded border focus:outline-none focus:ring-1 focus:ring-primary text-xs w-32"
                                    />
                                    <div className="flex gap-1 shrink-0">
                                      <button onClick={() => setEditingInstallmentId(null)} className="h-7 px-2 rounded border hover:bg-muted text-[10px]">İptal</button>
                                      <button onClick={() => handleSaveInstallmentDate(p)} disabled={savingInstallmentEdit} className="h-7 px-2 rounded bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                                        {savingInstallmentEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Kaydet'}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">{p.dateStr}</span>
                                      <button 
                                        onClick={() => handleEditInstallmentClick(p)}
                                        className="p-1 text-blue-600 hover:bg-blue-600/10 rounded transition-colors"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-emerald-600">+{p.amountStr}</span>
                                      <button
                                        onClick={() => handleDeleteInstallment(p, t)}
                                        disabled={deletingInstallmentId === p.id}
                                        className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                                      >
                                        {deletingInstallmentId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Progress bar */}
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-500' : 'bg-primary'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {/* Add payment input — only if not fully paid */}
                      {!isFullyPaid && (
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <div className="flex gap-2 flex-1">
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
                            <div className="relative w-36 shrink-0">
                              <input
                                type="date"
                                value={paymentDates[t.id] || new Date().toISOString().split('T')[0]}
                                onChange={e => setPaymentDates(prev => ({ ...prev, [t.id]: e.target.value }))}
                                style={{ color: '#111827', backgroundColor: '#ffffff' }}
                                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddPayment(t)}
                            disabled={payingId === t.id || !paymentInputs[t.id]}
                            className="h-9 px-3 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
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
