# Artdent Klinik Yönetimi

Bu proje, bir diş kliniği için modern, yapay zeka destekli bir hasta yönetim sistemidir. Next.js 14 (App Router) ile geliştirilmiş olup, Supabase altyapısı ve sesli komut sistemi içerir. Özel olarak Vercel üzerinde doğrudan çalıştırılmaya tamamen uyumludur.

## Teknolojiler
- **Framework:** Next.js 14, React
- **Veritabanı:** Supabase (PostgreSQL)
- **Stil & Tasarım:** Tailwind CSS, Lucide React (İkonlar), Sonner (Bildirimler)
- **Yapay Zeka (Sesli Komut):** Web Speech API, OpenAI (`gpt-4o-mini`)

## Özellikler
- **Hasta ve Tedavi Yönetimi:** Hasta kayıtları, diş tedavisi kayıtları ve kalan ödemelerin takibi.
- **Sesli Komut Asistanı:** Ekranın sağ alt köşesindeki mikrofon ikonuna basılı tutularak sesle komut verilebilir. Örneğin: *"Ahmet Yılmaz adında yeni hasta ekle. Telefon numarası 0555 555 5555. Bugün için yirmilik diş çekimi tedavisi eklensin, anlaşılan tutar 3000 TL."*
- **Sıfır Yapılandırma Gerekli Mobil Uyumlu Tasarım:** Responsive, tamamen modern cam efekti (glassmorphism) ve minimalist temiz bir arayüz barındırır. Vercel ortamında `npm run build` sorunu olmaksızın çalışır.

## Kurulum ve Dağıtım (Vercel)

1. Projeyi Github'a / Vercel'e yükleyin.
2. Vercel paneline gidin ortam değişkenlerini (`Environment Variables`) ekleyin:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
OPENAI_API_KEY=your-openai-api-key
```

3. Supabase üzerinde gerekli tabloları açmak için `supabase/migrations/initial_schema.sql` dosyasındaki SQL sorgularını Supabase SQL Editor'de çalıştırın.
4. Supabase Storage menüsüne gidip *isteğe bağlı olarak* "audio-notes" isimli Public bir bucket oluşturarak ses dosyalarını da barındırabilirsiniz.

Uygulamanız kullanıma hazırdır.
