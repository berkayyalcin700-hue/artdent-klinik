import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import { ChevronLeft, Calendar, Phone, Activity, Building2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { PatientDetailTabs } from '@/components/PatientDetailTabs';

export const revalidate = 0;

export default async function PatientPage({ params }: { params: { id: string } }) {
  // Fetch patient details
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*')
    .eq('id', params.id)
    .single();

  if (patientError || !patient) {
    notFound();
  }

  // Fetch treatments
  const { data: treatments } = await supabase
    .from('treatments')
    .select('*')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false });

  // Fetch notes
  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Back Button & Header */}
      <div className="flex items-center space-x-4">
        <Link 
          href="/" 
          className="p-2 rounded-full hover:bg-muted transition-colors flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Hasta Detayı</h1>
      </div>

      {/* Patient Info Card */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden glass">
        
        {/* Left Side: Avatar & Basic Info */}
        <div className="flex items-center space-x-5">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-blue-600 text-white flex items-center justify-center text-3xl font-bold shadow-lg">
                {patient.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
                <h2 className="text-2xl font-bold">{patient.full_name}</h2>
                {patient.tc_no && (
                    <p className="text-muted-foreground text-sm font-mono bg-muted/50 inline-block px-2 py-0.5 rounded">
                        TC: {patient.tc_no}
                    </p>
                )}
                {patient.institution && (
                    <div><span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full font-medium inline-block mt-1">{patient.institution}</span></div>
                )}
            </div>
        </div>

        {/* Right Side: Additional Details */}
        <div className="flex flex-col space-y-3 p-4 rounded-xl bg-muted/30 border md:min-w-64">
           {patient.phone && (
               <div className="flex items-center text-sm">
                   <Phone className="w-4 h-4 mr-3 text-primary" /> 
                   <span className="font-medium">{patient.phone}</span>
               </div>
           )}
           {patient.birth_date && (
               <div className="flex items-center text-sm">
                   <Calendar className="w-4 h-4 mr-3 text-primary" /> 
                   <span>{format(new Date(patient.birth_date), 'dd MMMM yyyy', { locale: tr })}</span>
               </div>
           )}
           {patient.institution && (
               <div className="flex items-center text-sm">
                   <Building2 className="w-4 h-4 mr-3 text-primary" />
                   <span>{patient.institution}</span>
               </div>
           )}
           <div className="flex items-center text-sm">
               <Activity className={`w-4 h-4 mr-3 ${patient.is_active ? 'text-emerald-500' : 'text-destructive'}`} /> 
               <span className={patient.is_active ? 'text-emerald-600' : 'text-destructive'}>
                   {patient.is_active ? 'Aktif Hasta' : 'Pasif Hasta'}
               </span>
           </div>
        </div>
      </div>

      {/* Tabs */}
      <PatientDetailTabs 
        patient={patient} 
        treatments={treatments || []} 
        notes={notes || []} 
      />

    </div>
  );
}
