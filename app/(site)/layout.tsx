import { SearchConfig } from 'pliny/search'
import SearchProviderWithFallback from '@/components/SearchProviderWithFallback'
import Header from '@/components/Header'
import SectionContainer from '@/components/SectionContainer'
import Footer from '@/components/Footer'
import siteMetadata from '@/data/siteMetadata'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionContainer>
      <SearchProviderWithFallback searchConfig={siteMetadata.search as SearchConfig}>
        <Header />
        <main className="mb-auto">{children}</main>
      </SearchProviderWithFallback>
      <Footer />
    </SectionContainer>
  )
}
