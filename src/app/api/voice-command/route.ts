import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'placeholder',
});

export async function POST(request: Request) {
  try {
    const { command } = await request.json();

    if (!command) {
      return NextResponse.json({ error: 'Komut bulunamadı' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Sen bir diş kliniği asistanısın. Kullanıcı Türkçe sesli komut verdi.
Komutu analiz et ve SADECE aşağıdaki JSON formatında yanıt ver. Başka hiçbir şey yazma.

ÖNEMLİ: Birden fazla tedavi söz konusu olabilir. Her tedaviyi ayrı bir obje olarak "treatments" dizisine ekle.
Örnek: "dolgu yaptık, dişini çektik ve kanal tedavisi yaptık" → treatments dizisinde 3 ayrı obje olmalı.

Olası action değerleri:
- "new_patient" → yeni hasta ekle
- "add_treatment" → mevcut hastaya tedavi ekle
- "add_note" → mevcut hastaya not ekle
- "search_patient" → hasta ara

JSON formatı:
{
  "action": "new_patient",
  "patient": { "full_name": null, "tc_no": null, "phone": null, "birth_date": null, "institution": null },
  "treatments": [
    { "treatment_name": null, "tooth_number": null, "total_price": null, "agreed_price": null, "paid_amount": null, "payment_method": null }
  ],
  "note": { "note_text": null },
  "search_query": null
}

ÇOKLU TEDAVİ KURALLARI:
- Kullanıcı birden fazla işlem söylediyse (dolgu, çekim, kanal vs.) her birini ayrı obje olarak treatments dizisine ekle
- Her tedavi için diş numarası ayrıca belirtildiyse ilgili tedaviye yaz, belirtilmediyse null bırak
- Örnek: "9 numaralı dişine dolgu yaptık ve 21 numaralı dişini çektik" →
  treatments: [
    { treatment_name: "Dolgu", tooth_number: "9", ... },
    { treatment_name: "Diş Çekimi", tooth_number: "21", ... }
  ]

SAYILAR:
- Türkçe sayıları rakama çevir: "beş bin" → 5000, "iki bin beş yüz" → 2500
- "5000 bin tl" gibi tekrarlı ifadelerde sadece ilk sayıyı al → 5000
- "X tl ödeme yapılacak" veya "X tl anlaşıldı" → total_price ve agreed_price = X
- "X tl alındı" veya "X tl ödedi" → paid_amount = X
- agreed_price boşsa total_price değerini kullan

TARİH:
- DD.MM.YYYY veya DD/MM/YYYY → YYYY-MM-DD
- "yirmi kasım doksan dokuz" → 1999-11-20

DİŞ NUMARASI:
- "20 lik diş" veya "yirmilik diş" → tooth_number: "20"
- "16 numara diş" veya "on altı numara" → tooth_number: "16"
- "sağ alt 6" → tooth_number: "46"

TEDAVİ ADI:
- "çekildi" veya "çekim" → "Diş Çekimi"
- "dolgu" → "Dolgu"
- "kanal" → "Kanal Tedavisi"
- "implant" → "İmplant"
- "zirkonyum" → "Zirkonyum Kaplama"
- "köprü" → "Köprü"
- "protez" → "Protez"

İSİM: full_name her zaman düzgün capitalize edilmeli (örn: "sude yalçın" → "Sude Yalçın")

Bilinmeyen alanlar null olsun.`,
        },
        {
          role: 'user',
          content: command,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const result = completion.choices[0].message.content;
    if (!result) throw new Error('Yapay zeka yanıt vermedi.');

    let parsedResult: any;
    try {
      parsedResult = JSON.parse(result);
    } catch {
      throw new Error(`JSON hatası. Ham yanıt: ${result}`);
    }

    const action = (parsedResult.action || '').toString().trim().toLowerCase();
    const { patient, note, search_query } = parsedResult;

    // Hem "treatments" (dizi) hem eski "treatment" (tekil) formatını destekle
    let treatments: any[] = [];
    if (Array.isArray(parsedResult.treatments) && parsedResult.treatments.length > 0) {
      treatments = parsedResult.treatments;
    } else if (parsedResult.treatment && parsedResult.treatment.treatment_name) {
      treatments = [parsedResult.treatment];
    }

    // agreed_price → total_price fallback her tedavi için
    treatments = treatments.map(t => {
      if (t.total_price != null && !t.agreed_price) {
        return { ...t, agreed_price: t.total_price };
      }
      return t;
    });

    // Geçerli tedavileri filtrele
    const validTreatments = treatments.filter(
      t => t?.treatment_name && t.treatment_name !== 'null'
    );

    console.log('[VoiceCommand] action:', action, '| patient:', JSON.stringify(patient), '| treatments:', JSON.stringify(validTreatments));

    let message = 'İşlem tamamlandı.';

    // Hasta arama yardımcı - Türkçe karakter uyumlu çoklu strateji
    const findPatient = async (nameQuery: string) => {
      // 1. Önce direkt ilike dene
      const { data: d1 } = await supabase
        .from('patients').select('id, full_name')
        .ilike('full_name', `%${nameQuery}%`).limit(1);
      if (d1 && d1.length > 0) return d1[0];

      // 2. Türkçe büyük harf dönüşümü ile dene
      const upperQuery = nameQuery.toLocaleUpperCase('tr-TR');
      const { data: d2 } = await supabase
        .from('patients').select('id, full_name')
        .ilike('full_name', `%${upperQuery}%`).limit(1);
      if (d2 && d2.length > 0) return d2[0];

      // 3. Kelimeleri ayrı ayrı ara (en az bir kelime eşleşsin)
      const words = nameQuery.split(' ').filter(w => w.length > 2);
      for (const word of words) {
        const upperWord = word.toLocaleUpperCase('tr-TR');
        const { data: d3 } = await supabase
          .from('patients').select('id, full_name')
          .or(`full_name.ilike.%${word}%,full_name.ilike.%${upperWord}%`).limit(1);
        if (d3 && d3.length > 0) return d3[0];
      }
      return null;
    };

    // Tedavi kayıt yardımcı fonksiyonu
    const insertTreatments = async (patientId: string): Promise<string[]> => {
      const savedLabels: string[] = [];
      for (const t of validTreatments) {
        const { error } = await supabase.from('treatments').insert({
          patient_id: patientId,
          treatment_name: t.treatment_name,
          tooth_number: t.tooth_number && t.tooth_number !== 'null' ? t.tooth_number : null,
          total_price: Number(t.total_price) || 0,
          agreed_price: Number(t.agreed_price) || Number(t.total_price) || 0,
          paid_amount: Number(t.paid_amount) || 0,
          payment_method: t.payment_method && t.payment_method !== 'null' ? t.payment_method : null,
        });
        if (error) throw error;
        const toothText = t.tooth_number && t.tooth_number !== 'null' ? `${t.tooth_number} no'lu dişe ` : '';
        savedLabels.push(`${toothText}${t.treatment_name}`);
      }
      return savedLabels;
    };

    switch (action) {
      case 'new_patient': {
        if (!patient?.full_name || patient.full_name === 'null') {
          throw new Error(`Hasta adı anlaşılamadı. Gelen veri: ${JSON.stringify(patient)}`);
        }

        let birthStr = patient.birth_date;
        if (!birthStr || birthStr === 'null') birthStr = null;

        const { data: newPatient, error: pError } = await supabase
          .from('patients')
          .insert({
            full_name: patient.full_name,
            tc_no: patient.tc_no !== 'null' ? patient.tc_no : null,
            phone: patient.phone !== 'null' ? patient.phone : null,
            birth_date: birthStr,
            institution: patient.institution !== 'null' ? patient.institution : null,
          })
          .select()
          .single();

        if (pError) throw pError;
        message = `${patient.full_name} hastası eklendi.`;

        if (validTreatments.length > 0) {
          const labels = await insertTreatments(newPatient.id);
          message += ` Tedaviler: ${labels.join(', ')}.`;
        }
        break;
      }

      case 'add_treatment': {
        const nameQuery = (search_query && search_query !== 'null') ? search_query : patient?.full_name;
        if (!nameQuery || nameQuery === 'null') throw new Error('Hangi hastaya tedavi ekleneceği anlaşılamadı.');

        const pt = await findPatient(nameQuery);
        if (!pt) throw new Error(`"${nameQuery}" isimli hasta bulunamadı. Lütfen tam ismi söyleyin.`);

        if (validTreatments.length === 0)
          throw new Error('Tedavi detayları anlaşılamadı.');

        const labels = await insertTreatments(pt.id);
        message = `${pt.full_name} isimli hastaya ${labels.join(', ')} kaydedildi.`;
        break;
      }

      case 'add_note': {
        const noteNameQuery = (search_query && search_query !== 'null') ? search_query : patient?.full_name;
        if (!noteNameQuery || noteNameQuery === 'null') throw new Error('Hangi hastaya not ekleneceği anlaşılamadı.');

        const notePatient = await findPatient(noteNameQuery);
        if (!notePatient) throw new Error(`"${noteNameQuery}" isimli hasta bulunamadı.`);

        if (!note?.note_text || note.note_text === 'null') throw new Error('Not içeriği anlaşılamadı.');

        const { error: noteErr } = await supabase.from('notes').insert({
          patient_id: notePatient.id,
          note_text: note.note_text,
          note_type: 'text',
        });
        if (noteErr) throw noteErr;
        message = `${notePatient.full_name} için not kaydedildi.`;
        break;
      }

      case 'search_patient':
        message = `Hasta aranıyor...`;
        break;

      default:
        throw new Error(`Komut anlaşılamadı. (action: "${action}")`);
    }

    return NextResponse.json({ message, data: parsedResult });
  } catch (error: any) {
    console.error('[VoiceCommand] Error:', error);
    return NextResponse.json({ error: error.message || 'Bir hata oluştu.' }, { status: 500 });
  }
}
