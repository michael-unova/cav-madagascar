import { useEffect, useMemo, useState } from 'react'
import { Container } from '../components/ui/Container'
import { Card } from '../components/ui/Card'
import { useAuth } from '../features/auth'
import { listPublishedLibraryBooks } from '../features/library'
import { getDownloadURL, ref } from 'firebase/storage'
import { getFirebaseStorage } from '../lib/firebase/storage'
import type { LibraryBook } from '../types/library'

const CATEGORY_ALL = 'Toutes les catégories'

export function LibraryPage() {
  const { user } = useAuth()
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(CATEGORY_ALL)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfViewer, setPdfViewer] = useState<{ title: string; url: string } | null>(null)
  const [openingPdf, setOpeningPdf] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    void listPublishedLibraryBooks().then(setBooks).catch(err => {
      console.error(err)
      setError('Impossible de charger la librairie pour le moment.')
    }).finally(() => setLoading(false))
  }, [user])

  const categories = useMemo(() => [CATEGORY_ALL, ...Array.from(new Set(books.map(book => book.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'))], [books])
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr')
    return books.filter(book => {
      const matchesCategory = category === CATEGORY_ALL || book.category === category
      const haystack = [book.title, book.author, book.description, book.category, ...book.keywords].join(' ').toLocaleLowerCase('fr')
      return matchesCategory && (!term || haystack.includes(term))
    })
  }, [books, category, search])

  async function openBook(book: LibraryBook) {
    setError('')
    if (book.type === 'link') {
      window.open(book.resourceUrl, '_blank', 'noopener,noreferrer')
      return
    }
    if (!book.resourceUrl) {
      setError('Le fichier PDF de cette ressource est introuvable.')
      return
    }
    setOpeningPdf(book.id)
    try {
      // Use Firebase's authenticated download URL instead of getBlob().
      // This avoids browser CORS/blob-PDF issues and lets the native PDF viewer
      // render the document reliably on desktop and mobile.
      const url = await getDownloadURL(ref(getFirebaseStorage(), book.resourceUrl))
      setPdfViewer({ title: book.title, url })
    } catch (err) {
      console.error(err)
      setError('Impossible d’ouvrir ce PDF. Vérifiez votre connexion puis réessayez.')
    } finally {
      setOpeningPdf(null)
    }
  }

  return <Container className="page-container library-page">
    <section className="library-hero">
      <div className="library-hero-copy">
        <span className="library-kicker">RESSOURCES CAV</span>
        <h1>📚 Librairie</h1>
        <p>Retrouvez des ouvrages et ressources de référence pour enrichir votre préparation, au même endroit.</p>
      </div>
      <div className="library-hero-stat"><strong>{books.length}</strong><span>ressources disponibles</span></div>
    </section>

    <section className="library-toolbar" aria-label="Recherche dans la librairie">
      <div className="library-search"><span aria-hidden="true">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un livre, un auteur, un thème..." aria-label="Rechercher" /></div>
      <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Filtrer par catégorie">
        {categories.map(item => <option key={item}>{item}</option>)}
      </select>
    </section>

    {error && <div className="library-alert" role="alert">{error}</div>}
    {loading ? <div className="library-loading"><div className="library-skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div className="library-skeleton" key={i} />)}</div></div> : filtered.length === 0 ? <Card className="library-empty"><div className="library-empty-icon">⌕</div><h2>{books.length ? 'Aucun résultat' : 'La librairie arrive bientôt'}</h2><p>{books.length ? 'Essayez un autre mot-clé ou une autre catégorie.' : 'Les ressources publiées par CAV apparaîtront ici.'}</p>{search && <button className="ui-button ui-button-secondary" onClick={() => setSearch('')}>Effacer la recherche</button>}</Card> : <div className="library-grid">{filtered.map(book => <article className="library-book-card" key={book.id}>
      <button className="library-cover-button" onClick={() => void openBook(book)} aria-label={`Ouvrir ${book.title}`}>
        <div className="library-cover">{book.coverUrl ? <img src={book.coverUrl} alt={`Couverture de ${book.title}`} loading="lazy" /> : <div className="library-cover-fallback"><span>📚</span><strong>CAV</strong></div>}<span className={`library-type ${book.type}`}>{book.type === 'pdf' ? 'PDF' : 'LIEN'}</span></div>
      </button>
      <div className="library-book-body"><div className="library-book-category">{book.category}</div><h2>{book.title}</h2>{book.author && <p className="library-author">{book.author}</p>}{book.description && <p className="library-description">{book.description}</p>}<button className="library-open" onClick={() => void openBook(book)} disabled={openingPdf === book.id}>{openingPdf === book.id ? 'Ouverture…' : book.type === 'pdf' ? 'Lire le PDF' : 'Accéder au livre'} <span>↗</span></button></div>
    </article>)}</div>}
    {pdfViewer && <div className="library-pdf-overlay" role="dialog" aria-modal="true" aria-label={`Lecture de ${pdfViewer.title}`}>
      <div className="library-pdf-dialog">
        <div className="library-pdf-head">
          <div><span className="eyebrow">LECTURE</span><h2>{pdfViewer.title}</h2></div>
          <button className="ui-button ui-button-secondary" onClick={() => setPdfViewer(null)}>Fermer</button>
        </div>
        <iframe className="library-pdf-frame" src={pdfViewer.url} title={pdfViewer.title} />
      </div>
    </div>}
  </Container>
}
