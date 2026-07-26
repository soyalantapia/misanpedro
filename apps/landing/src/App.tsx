import { useEffect } from 'react'
import { loadTenantConfig } from '@/lib/tenant'
import { Nav } from './sections/Nav'
import { MobileCTABar } from './components/MobileCTABar'
import { Hero } from './sections/Hero'
import { SocialProof } from './sections/SocialProof'
import { Problem } from './sections/Problem'
import { Agitate } from './sections/Agitate'
import { Solution } from './sections/Solution'
import { Features } from './sections/Features'
import { UseCase } from './sections/UseCase'
import { Pricing } from './sections/Pricing'
import { FAQ } from './sections/FAQ'
import { FinalCTA } from './sections/FinalCTA'
import { Footer } from './sections/Footer'

export function App() {
  // Resuelve el tenant (nombre/ciudad/precio/color) una sola vez al montar.
  useEffect(() => {
    loadTenantConfig()
  }, [])

  return (
    <div className="bg-white text-neutral-900">
      <Nav />
      <main>
        <Hero />
        <SocialProof />
        <Problem />
        <Agitate />
        <Solution />
        <Features />
        <UseCase />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <MobileCTABar />
    </div>
  )
}
