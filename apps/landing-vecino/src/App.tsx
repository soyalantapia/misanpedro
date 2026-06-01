import { Nav } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Problema } from './sections/Problema'
import { Giro } from './sections/Giro'
import { HowItWorks } from './sections/HowItWorks'
import { AhorroTangible } from './sections/AhorroTangible'
import { Categorias } from './sections/Categorias'
import { PorQue } from './sections/PorQue'
import { Comercios } from './sections/Comercios'
import { FinalCTA } from './sections/FinalCTA'
import { Footer } from './sections/Footer'
import { StickyCTA } from './sections/StickyCTA'

export function App() {
  return (
    <div className="overflow-x-clip bg-white text-neutral-900">
      <Nav />
      <main>
        <Hero />
        <Problema />
        <Giro />
        <HowItWorks />
        <AhorroTangible />
        <Categorias />
        <PorQue />
        <Comercios />
        <FinalCTA />
      </main>
      <Footer />
      <StickyCTA />
    </div>
  )
}
