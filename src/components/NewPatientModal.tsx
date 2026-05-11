'use client';

import { useState } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function NewPatientModal({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    tc_no: '',
    phone: '',
    birth_date: '',
    institution: '',
    // Tedavi alanları
    treatment_name: '',
    tooth_number: '',
    total_price: '',
    agreed_price: '',
    paid_amount: '',
    payment_method: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('İsim Soyisim zorunludur.');
      return;
    }

    setLoading(true);
    try {
      // 1. Hastayı ekle
      const { data: patient, error: pErr } = await supabase
        .from('patients')
        .insert({
          full_name: form.full_name.trim(),
          tc_no: form.tc_no.trim() || null,
          phone: form.phone.trim() || null,
          birth_date: form.birth_date || null,
          institution: form.institution.trim() || null,
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Tedavi alanı doluysa tedavi de ekle
      if (form.treatment_name.trim()) {
        const { error: tErr } = await supabase.from('treatments').insert({
          patient_id: patient.id,
          treatment_name: form.treatment_name.trim(),
          tooth_number: form.tooth_number.trim() || null,
          total_price: parseFloat(form.total_price.replace(/\./g, '').replace(',', '.')) || 0,
          agreed_price: parseFloat(form.agreed_price.replace(/\./g, '').replace(',', '.')) || 0,
          paid_amount: parseFloat(form.paid_amount.replace(/\./g, '').replace(',', '.')) || 0,
          payment_method: form.payment_method || null,
        });
        if (tErr) throw tErr;
      }

      toast.success(`${form.full_name} başarıyla eklendi!`);
      setOpen(false);
      setForm({
        full_name: '', tc_no: '', phone: '', birth_date: '', institution: '',
        treatment_name: '', tooth_number: '', total_price: '', agreed_price: '',
        paid_amount: '', payment_method: '',
      });
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Tetikleyici Buton */}
      <button
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 shadow-md"
      >
        <Plus className="mr-2 h-4 w-4" /> Yeni Hasta
      </button>

      {/* Modal Overlay */}
      {open && (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
          <div 
            className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Yeni Hasta Ekle</h2>
              <button 
                onClick={() => setOpen(false)} 
                className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600 hover:text-gray-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[80vh]">
              <div className="px-6 py-5 space-y-5">
                
                {/* Hasta Bilgileri */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Hasta Bilgileri</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">İsim Soyisim <span className="text-destructive">*</span></label>
                      <input
                        name="full_name"
                        value={form.full_name}
                        onChange={handleChange}
                        placeholder="Ahmet Yılmaz"
                        required
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">TC Kimlik No</label>
                      <input
                        name="tc_no"
                        value={form.tc_no}
                        onChange={handleChange}
                        maxLength={11}
                        placeholder="12345678901"
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon</label>
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="0555 555 5555"
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Doğum Tarihi</label>
                      <input
                        type="date"
                        name="birth_date"
                        value={form.birth_date}
                        onChange={handleChange}
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Anlaşmalı Kurum</label>
                      <input
                        name="institution"
                        value={form.institution}
                        onChange={handleChange}
                        placeholder="SGK, Özel Sigorta..."
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Ayırıcı */}
                <div className="border-t pt-5">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Başlangıç Tedavisi <span className="text-gray-400 font-normal normal-case">(isteğe bağlı)</span></h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Yapılan İşlem</label>
                      <input
                        name="treatment_name"
                        value={form.treatment_name}
                        onChange={handleChange}
                        placeholder="Kanal Tedavisi, Dolgu, Çekim..."
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Diş Numarası</label>
                      <input
                        name="tooth_number"
                        value={form.tooth_number}
                        onChange={handleChange}
                        placeholder="16, 21..."
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Ödeme Yöntemi</label>
                      <select
                        name="payment_method"
                        value={form.payment_method}
                        onChange={handleChange}
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="">Seçiniz</option>
                        <option value="Nakit">Nakit</option>
                        <option value="Kredi Kartı">Kredi Kartı</option>
                        <option value="Havale">Havale / EFT</option>
                        <option value="SGK">SGK</option>
                        <option value="Sigorta">Özel Sigorta</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Normal Ücret (₺)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        name="total_price"
                        value={form.total_price}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Anlaşılan Ücret (₺)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        name="agreed_price"
                        value={form.agreed_price}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Alınan Ücret (₺)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        name="paid_amount"
                        value={form.paid_amount}
                        onChange={handleChange}
                        placeholder="0"
                        className="w-full h-10 rounded-md border border-gray-300 bg-white text-gray-900 px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>

                  </div>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/30">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 px-4 rounded-md text-sm font-medium border hover:bg-muted transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-10 px-5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {loading ? 'Kaydediliyor...' : 'Hastayı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
