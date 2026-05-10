-- Initial schema for Dental Clinic Patient Management System

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    tc_no TEXT,
    phone TEXT,
    birth_date DATE,
    institution TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    treatment_name TEXT NOT NULL,
    tooth_number TEXT,
    treatment_date DATE DEFAULT CURRENT_DATE,
    total_price NUMERIC(10,2) DEFAULT 0,
    agreed_price NUMERIC(10,2) DEFAULT 0,
    paid_amount NUMERIC(10,2) DEFAULT 0,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    note_text TEXT,
    note_type TEXT CHECK (note_type IN ('text', 'audio')),
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example: Set up a supabase storage bucket named 'audio-notes' manually 
-- or using Supabase Dashboard for voice notes.
-- insert into storage.buckets (id, name, public) values ('audio-notes', 'audio-notes', true);

-- Enable RLS (Row Level Security) - if desired, default allows all for authenticated keys.
-- For a full app, you should define granular policies.

