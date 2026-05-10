'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { NewPatientModal } from '@/components/NewPatientModal';
import { PatientDetailTabs } from '@/components/PatientDetailTabs';
import { Search, User, Phone, Calendar, Building2, Activity, BarChart3, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { format, differenceInYears } from 'date-fns';
import { tr } from 'date-fns/locale';

type Patient = {
  id: string;
  full_name: string;
  tc_no: string | null;
  phone: string | null;
  birth_date: string | null;
  institution: string | null;
  is_active: boolean;
  created_at: string;
  treatments?: { agreed_price: number; paid_amount: number }[];
};

export default function Home() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filtered, setFiltered] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('patients')
      .select('*, treatments(agreed_price, paid_amount)')
      .order('created_at', { ascending: false });
    if (data) {
      setPatients(data);
      setFiltered(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? patients.filter(p =>
            p.full_name.toLowerCase().includes(q) ||
            p.tc_no?.includes(q) ||
            p.phone?.includes(q)
          )
        : patients
    );
  }, [search, patients]);

  const handleSelect = async (patient: Patient) => {
    setSelected(patient);
    setDetailLoading(true);
    const [{ data: t }, { data: n }] = await Promise.all([
      supabase.from('treatments').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }),
      supabase.from('notes').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false }),
    ]);
    setTreatments(t || []);
    setNotes(n || []);
    setDetailLoading(false);
  };

  const getDebt = (p: Patient) =>
    (p.treatments || []).reduce(
      (sum, t) => sum + (Number(t.agreed_price) || 0) - (Number(t.paid_amount) || 0),
      0
    );

  const getAge = (d: string | null) =>
    d ? differenceInYears(new Date(), new Date(d)) : null;

  const handleDeletePatient = async (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    if (!window.confirm(`"${patient.full_name}" hastasını ve tüm tedavi/not kayıtlarını silmek istediğinize emin misiniz?`)) return;
    setDeletingPatientId(patient.id);
    try {
      // Cascade: önce treatments ve notes, sonra hasta
      await supabase.from('treatments').delete().eq('patient_id', patient.id);
      await supabase.from('notes').delete().eq('patient_id', patient.id);
      const { error } = await supabase.from('patients').delete().eq('id', patient.id);
      if (error) throw error;
      setPatients(prev => prev.filter(p => p.id !== patient.id));
      if (selected?.id === patient.id) setSelected(null);
    } catch (err: any) {
      alert('Hasta silinemedi: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setDeletingPatientId(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">

      {/* ─── LEFT SIDEBAR ─── */}
      <div className="w-72 shrink-0 bg-zinc-900 text-white flex flex-col h-full border-r border-zinc-800">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-zinc-800 space-y-3">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Hastalar</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ara..."
              className="w-full h-8 bg-zinc-800 text-white rounded-lg pl-8 pr-3 text-sm placeholder:text-zinc-500 border border-zinc-700 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Patient List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-zinc-500 text-sm">Yükleniyor...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-zinc-500 text-sm text-center mt-4">Hasta bulunamadı.</div>
          ) : (
            filtered.map(patient => {
              const debt = getDebt(patient);
              const age = getAge(patient.birth_date);
              const isSelected = selected?.id === patient.id;
              const hasTreatments = (patient.treatments?.length || 0) > 0;

              return (
                <button
                  key={patient.id}
                  onClick={() => handleSelect(patient)}
                  className={`w-full text-left px-4 py-3.5 border-b border-zinc-800/60 hover:bg-zinc-800/70 transition-colors group ${
                    isSelected ? 'bg-zinc-800 border-l-[3px] border-l-blue-500' : 'border-l-[3px] border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm leading-tight truncate">{patient.full_name}</p>
                      {patient.birth_date && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {format(new Date(patient.birth_date), 'dd.MM.yyyy')}
                          {age !== null ? ` · ${age} yaş` : ''}
                        </p>
                      )}
                      <div className="mt-1.5">
                        {debt > 0 ? (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium">
                            {new Intl.NumberFormat('tr-TR').format(debt)} ₺ bekliyor
                          </span>
                        ) : hasTreatments ? (
                          <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-medium">
                            Ödendi
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeletePatient(e, patient)}
                      disabled={deletingPatientId === patient.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 mt-0.5"
                      title="Hastayı Sil"
                    >
                      {deletingPatientId === patient.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Add Button */}
        <div className="p-3 border-t border-zinc-800 flex flex-col gap-2">
          <NewPatientModal onSuccess={fetchPatients} />
          <Link
            href="/istatistikler"
            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700 h-10 px-4 py-2 mt-2"
          >
            <BarChart3 className="mr-2 h-4 w-4" /> Aylık İstatistikler
          </Link>
        </div>
      </div>

      {/* ─── RIGHT DETAIL PANEL ─── */}
      <div className="flex-1 overflow-y-auto bg-background">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <User className="w-8 h-8 opacity-30" />
              </div>
              <p className="text-sm">Sol taraftan bir hasta seçin</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Yükleniyor...
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

            {/* Patient Info Card */}
            <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
              <div className="flex items-center space-x-5">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-blue-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg">
                  {selected.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">{selected.full_name}</h2>
                  {selected.tc_no && (
                    <p className="text-muted-foreground text-sm font-mono bg-muted/50 inline-block px-2 py-0.5 rounded">
                      TC: {selected.tc_no}
                    </p>
                  )}
                  {selected.institution && (
                    <div>
                      <span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full font-medium inline-block mt-1">
                        {selected.institution}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col space-y-3 p-4 rounded-xl bg-muted/30 border md:min-w-56">
                {selected.phone && (
                  <div className="flex items-center text-sm">
                    <Phone className="w-4 h-4 mr-3 text-primary shrink-0" />
                    <span>{selected.phone}</span>
                  </div>
                )}
                {selected.birth_date && (
                  <div className="flex items-center text-sm">
                    <Calendar className="w-4 h-4 mr-3 text-primary shrink-0" />
                    <span>{format(new Date(selected.birth_date), 'dd MMMM yyyy', { locale: tr })}</span>
                  </div>
                )}
                {selected.institution && (
                  <div className="flex items-center text-sm">
                    <Building2 className="w-4 h-4 mr-3 text-primary shrink-0" />
                    <span>{selected.institution}</span>
                  </div>
                )}
                <div className="flex items-center text-sm">
                  <Activity className={`w-4 h-4 mr-3 shrink-0 ${selected.is_active ? 'text-emerald-500' : 'text-destructive'}`} />
                  <span className={selected.is_active ? 'text-emerald-600' : 'text-destructive'}>
                    {selected.is_active ? 'Aktif Hasta' : 'Pasif Hasta'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <PatientDetailTabs patient={selected} treatments={treatments} notes={notes} />
          </div>
        )}
      </div>
    </div>
  );
}
