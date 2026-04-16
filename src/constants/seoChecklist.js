// src/constants/seoChecklist.js
// Definiția completă a checklist-ului SEO — folosit în SeoPageDetail

export const SEO_CHECKLIST = [
  {
    id: 'research',
    title: '1. Cercetare și strategie',
    color: 'blue',
    items: [
      {
        text: 'Identifică cuvântul cheie principal',
        detail: 'Alege un cuvânt cheie cu volum decent și relevanță maximă pentru această pagină. Preferabil 2-3 cuvinte, nu prea generic.',
        widget: 'primary_kw'
      },
      {
        text: 'Validează volumul de căutări',
        detail: 'Folosește Google Keyword Planner, Ubersuggest sau Semrush. Volum minim recomandat: 100+/lună pentru produse nișate, 500+/lună pentru categorii.',
        widget: 'primary_volume'
      },
      {
        text: 'Analizează intenția de căutare',
        detail: 'Verifică primele 5 rezultate Google. Sunt pagini de produs, categorie sau blog? Pagina ta trebuie să fie același tip.',
        widget: 'search_intent'
      },
      {
        text: 'Identifică 3-5 cuvinte cheie secundare',
        detail: 'Sinonime, variante și termeni înrudiți. Ex: pentru „husă pat" → „husă matlasată", „protecție saltea", „husă impermeabilă".',
        widget: 'secondary_kws',
        minCount: 3
      },
      {
        text: 'Identifică 2-3 expresii long-tail',
        detail: 'Expresii de 4-6 cuvinte cu intenție de cumpărare clară. Ex: „husă impermeabilă pat 160x200" sau „husă pat pentru incontinență adulți".',
        widget: 'longtail_kws',
        minCount: 2
      },
      {
        text: 'Verifică competiția pe SERP',
        detail: 'Uită-te la domain authority, calitatea conținutului și numărul de backlink-uri ale top 10. Ai șanse realiste să intri pe prima pagină?'
      },
      {
        text: 'Verifică dacă există cannibalizare de cuvinte cheie',
        detail: 'Asigură-te că nu mai ai altă pagină pe același site care targetează același cuvânt cheie principal. Dacă există, consolidează sau diferențiază.'
      }
    ]
  },
  {
    id: 'onpage',
    title: '2. Optimizare On-Page',
    color: 'green',
    items: [
      {
        text: 'Title tag optimizat (max 60 caractere)',
        detail: 'Include cuvântul cheie principal, preferabil la început. Adaugă element diferențiator: preț, beneficiu, brand. Ex: „Huse Pat Impermeabile | Calitate Premium | Pernador.ro".',
        widget: 'meta_title'
      },
      {
        text: 'Meta description convingătoare (max 155 caractere)',
        detail: 'Include cuvântul cheie, un beneficiu clar și call-to-action. Ex: „Descoperă husele impermeabile pentru pat ✓ Lavabile la 60°C ✓ Livrare rapidă ✓ Garanție 2 ani. Comandă acum!"',
        widget: 'meta_desc'
      },
      {
        text: 'H1 unic și optimizat',
        detail: 'Un singur H1 per pagină, diferit de title tag dar complementar. Include cuvântul cheie principal. Ex: title = „Huse Pat Impermeabile | Pernador.ro", H1 = „Huse de Pat Impermeabile — Protecție Totală".'
      },
      {
        text: 'URL slug curat și scurt',
        detail: 'Folosește liniuțe între cuvinte. Include cuvântul cheie. Fără diacritice, spații sau caractere speciale. Ex: /huse-pat-impermeabile nu /huse_pat_impermeabile sau /p?id=123.',
        widget: 'url_slug'
      },
      {
        text: 'Structură heading-uri logică (H2, H3)',
        detail: 'Organizează descrierea cu H2-uri tematice. Include cuvintele secundare în H2-uri. Ex: H2: „Caracteristici Tehnice", H2: „De ce să alegi husele noastre impermeabile?", H2: „Întrebări Frecvente".'
      },
      {
        text: 'Cuvânt cheie menționat în primele 100 cuvinte',
        detail: 'Google acordă mai multă greutate primului paragraf. Menționează cuvântul cheie principal natural în prima frază sau al doilea paragraf.'
      },
      {
        text: 'Descriere de minim 300 cuvinte',
        detail: 'Produsele simple: 300-500 cuvinte. Produse complexe sau categorii importante: 800-1200 cuvinte. Conținut suficient pentru a acoperi subiectul complet.'
      },
      {
        text: 'Imagini cu alt text optimizat',
        detail: 'Fiecare imagine principală: alt text descriptiv care include cuvântul cheie. Ex: alt="husă pat impermeabilă 160x200 albă" în loc de alt="imagine1".'
      },
      {
        text: 'Densitate cuvânt cheie naturală (1-3%)',
        detail: 'Evită keyword stuffing. Cuvântul cheie principal trebuie să apară de 3-5 ori în 300 cuvinte, natural integrat în text.'
      }
    ]
  },
  {
    id: 'tech',
    title: '3. SEO Tehnic',
    color: 'purple',
    items: [
      {
        text: 'Pagina este indexabilă (verifică robots)',
        detail: 'Asigură-te că meta robots NU conține „noindex". Verifică în Google Search Console sau cu un crawler. Dacă e în noindex din greșeală, pierzi tot traficul organic.'
      },
      {
        text: 'Viteză de încărcare < 3 secunde',
        detail: 'Testează cu Google PageSpeed Insights (pagespeed.web.dev). Scor minim acceptabil: 50+ pe mobil. Optimizează: imagini WebP, lazy loading, compresie Gzip, minificare CSS/JS.'
      },
      {
        text: 'Pagina este mobile-friendly',
        detail: 'Testează cu Google Mobile-Friendly Test (search.google.com/test/mobile-friendly). Fonturi lizibile fără zoom, butoane suficient de mari, fără scroll orizontal.'
      },
      {
        text: 'Date structurate Schema.org implementate',
        detail: 'Produse: Product schema cu preț, disponibilitate, rating. Categorii: BreadcrumbList. Blog: Article schema. Testează cu Rich Results Test de la Google.'
      },
      {
        text: 'Canonical URL setat corect',
        detail: 'Dacă pagina apare la mai multe URL-uri (cu și fără www, cu parametri de filtrare), setează canonical la URL-ul principal pentru a evita conținutul duplicat.'
      },
      {
        text: 'Link-uri interne relevante adăugate',
        detail: 'Adaugă 2-5 link-uri interne de pe alte pagini relevante (alte produse, categorie parinte, blog posts) cu anchor text descriptiv, nu „click aici".'
      },
      {
        text: 'Pagina include breadcrumbs',
        detail: 'Breadcrumbs ajută la navigare și la crawling. Implementează atât vizual cât și ca Schema.org BreadcrumbList pentru a apărea în SERP.'
      }
    ]
  },
  {
    id: 'content',
    title: '4. Calitatea conținutului',
    color: 'orange',
    items: [
      {
        text: 'Beneficii clar prezentate (nu doar caracteristici)',
        detail: 'Nu lista: „Material: poliester". Scrie: „Fabricat din poliester de înaltă densitate — rezistent la umezeală și lavabil la 60°C pentru igienă maximă".'
      },
      {
        text: 'Specificații tehnice complete',
        detail: 'Dimensiuni, materiale, compatibilități, greutate, culori disponibile, garanție, certificări. Tot ce are nevoie clientul pentru a lua decizia de cumpărare fără să te sune.'
      },
      {
        text: 'Secțiune FAQ cu minim 3 întrebări',
        detail: 'Răspunde la întrebările reale ale clienților. Ajută la voice search și featured snippets. Ex: „Husa este compatibilă cu saltelele cu memorie?" „La câte grade se spală?"'
      },
      {
        text: 'Recenzii și social proof vizibile',
        detail: 'Activează și afișează recenziile de clienți. Un produs cu 10+ recenzii convertește cu 30-40% mai bine. Asigură-te că rating-ul apare și în Schema.org.'
      },
      {
        text: 'Conținut 100% unic, nu copiat',
        detail: 'Verifică cu Copyscape sau Plagiarisma că descrierea nu este identică cu furnizorul sau alte site-uri. Google penalizează conținutul duplicat.'
      },
      {
        text: 'Call-to-action clar și vizibil',
        detail: 'Butonul „Adaugă în coș" sau „Cumpără acum" trebuie vizibil fără scroll pe desktop și mobil. Culoare contrastantă, text acțional.'
      }
    ]
  },
  {
    id: 'monitoring',
    title: '5. Monitorizare și urmărire',
    color: 'red',
    items: [
      {
        text: 'Pagina trimisă spre indexare în Google Search Console',
        detail: 'Submit URL în GSC (Inspecție URL → Solicită indexare). Verifică după 48-72 ore că este indexat. Dacă nu, verifică robots.txt și sitemap.'
      },
      {
        text: 'Pagina inclusă în sitemap.xml',
        detail: 'Asigură-te că URL-ul apare în sitemap. Dacă folosești WooCommerce, plugin-ul Yoast SEO generează automat sitemapul. Verifică la /sitemap.xml sau /sitemap_index.xml.'
      },
      {
        text: 'Urmărire conversii setată în Analytics',
        detail: 'Configurează goals/conversii pentru: Add to Cart, Checkout Initiated, Purchase Completed. Astfel poți vedea câte vânzări aduce organic această pagină.'
      },
      {
        text: 'Poziție inițială înregistrată',
        detail: 'Notează poziția și impresiile în prima săptămână în GSC. Vei putea măsura progresul după optimizări. Keyword-ul principal ar trebui să apară în primele 100.'
      },
      {
        text: 'Plan de link building creat',
        detail: 'Identifică 3-5 oportunități de backlinkuri: articole pe blog propriu, parteneri, forumuri de nișă, guest posts, comunități online relevante.'
      }
    ]
  }
]

// Calculează numărul total de itemi
export const TOTAL_CHECKLIST_ITEMS = SEO_CHECKLIST.reduce(
  (total, phase) => total + phase.items.length, 0
)

// Calculează procentul de completare din progresul salvat
export function calculateProgress(savedProgress) {
  if (!savedProgress || savedProgress.length === 0) return 0
  const completed = savedProgress.filter(p => p.completed).length
  return Math.round((completed / TOTAL_CHECKLIST_ITEMS) * 100)
}

export const PHASE_COLORS = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   check: 'text-blue-600' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  check: 'text-green-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', check: 'text-purple-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', check: 'text-orange-600' },
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    check: 'text-red-600' },
}
