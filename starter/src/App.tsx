import { Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { LightboxProvider } from './components/Lightbox'
import { SelectionProvider, UiPrefsProvider } from './selection/SelectionContext'
import { Home } from './pages/Home'
import { Work } from './pages/Work'
import { Series } from './pages/Series'
import { Review } from './pages/Review'
import { Compare } from './pages/Compare'
import { About } from './pages/About'
import { Contact } from './pages/Contact'

export default function App() {
  return (
    <UiPrefsProvider>
      <SelectionProvider>
        <LightboxProvider>
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/work" element={<Work />} />
            <Route path="/work/:seriesId" element={<Series />} />
            <Route path="/review" element={<Review />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Home />} />
          </Routes>
          <Footer />
        </LightboxProvider>
      </SelectionProvider>
    </UiPrefsProvider>
  )
}
