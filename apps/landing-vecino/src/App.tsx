import { useEffect } from 'react'
import { loadTenantConfig } from '@/lib/tenant'
import { Nav } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Problema } from './sections/Problema'
import { Giro } from './sections/Giro'
import { HowItWorks } from './sections/HowItWorks'
import { AhorroTangible } from './sections/AhorroTangible'
import { PorQue } from './sections/PorQue'
import { Comercios } from './sections/Comercios'
import { FAQ } from './sections/FAQ'
import { WhatsApp } from './sections/WhatsApp'
import { Reaseguro } from './sections/Reaseguro'
import { FinalCTA } from './sections/FinalCTA'
import { Footer } from './sections/Footer'
import { StickyCTA } from './sections/StickyCTA'

export function App() {
  // Carga la config del tenant (nombre/ciudad/color) una vez al montar.
  useEffect(() => {
    void loadTenantConfig()
  }, [])

  return (
    <div className="overflow-x-clip bg-white text-neutral-900">
      <Nav />
      <main>
        <Hero />
        <Problema />
        <Giro />
        <HowItWorks />
        <AhorroTangible />
        <PorQue />
        <Comercios />
        <FAQ />
        <WhatsApp />
        <Reaseguro />
        <FinalCTA />
      </main>
      <Footer />
      <StickyCTA />
    </div>
  )
}
