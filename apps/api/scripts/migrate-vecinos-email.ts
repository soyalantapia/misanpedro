/**
 * Migración one-off: borra las cuentas de vecino SIN email.
 *
 * Con la identidad movida al email (cazabug S1-01), una cuenta sin email no
 * puede entrar nunca más — el índice {appId,email} único la deja huérfana y
 * `User.syncIndexes()` (que corre al bootear el API) falla si hay más de una
 * con email null/"" (clave duplicada). Verificado contra la base real el
 * 2026-07-27: las 4 cuentas en esa situación son datos de prueba ("Vecino
 * Uno", "Ana", "Beto", "Cami"), creadas el mismo minuto y con CERO canjes.
 *
 * Corre en SIMULACIÓN por defecto (no borra nada). Para ejecutar de verdad
 * hay que pasar --apply explícito:
 *
 *   node --env-file=.env --import tsx scripts/migrate-vecinos-email.ts
 *   node --env-file=.env --import tsx scripts/migrate-vecinos-email.ts --apply
 *
 * 🔴 Guardrail (no decorativo): si CUALQUIER cuenta sin email tiene canjes
 * reales (Redemption), el script frena con exit 1 y no borra NADA — ni
 * siquiera las otras cuentas sin canjes. El supuesto de esta migración es
 * "las cuentas sin email son todas de prueba"; un solo canje real lo tumba,
 * y a partir de ahí el borrado deja de ser seguro y hay que revisar a mano
 * cuál es la cuenta real antes de decidir qué hacer con ella.
 */
import mongoose from 'mongoose'
import { env } from '../src/env'
import { User, Activation, Redemption } from '../src/models'

const APPLY = process.argv.includes('--apply')

async function main() {
  // Mismo dbName que usa el API en src/db/connection.ts — si no, sincroniza
  // (o peor, borra) una base distinta de la que sirve producción.
  await mongoose.connect(env.MONGODB_URI, { dbName: 'misanpedro' })

  const sinEmail = await User.find({
    $or: [{ email: { $exists: false } }, { email: null }, { email: '' }],
  }).lean()

  console.log(`Cuentas sin email: ${sinEmail.length}`)

  if (sinEmail.length === 0) {
    console.log('\nNada para migrar — no hay cuentas sin email.')
    await mongoose.disconnect()
    return
  }

  for (const u of sinEmail) {
    const [canjes, activaciones] = await Promise.all([
      Redemption.countDocuments({ userId: u._id }),
      Activation.countDocuments({ userId: u._id }),
    ])
    console.log(`  · ${u.nombre} — ${canjes} canjes, ${activaciones} activaciones`)

    // Guardrail: si aparece una cuenta CON canjes, frenamos ANTES de borrar
    // ninguna. El supuesto de la migración (son todas de prueba) dejó de
    // valer y hay que revisar a mano — no es una cuenta de test más.
    if (canjes > 0) {
      console.error(
        `\n🔴 FRENO: "${u.nombre}" (${u._id}) tiene ${canjes} canje(s) reales. ` +
          'Revisar a mano antes de borrar — no se tocó nada.',
      )
      await mongoose.disconnect()
      process.exit(1)
    }
  }

  if (!APPLY) {
    console.log('\n(simulación — nada se borró. Volvé a correr con --apply para aplicar)')
    await mongoose.disconnect()
    return
  }

  const ids = sinEmail.map((u) => u._id)
  // Las activaciones de estas cuentas no tienen canje asociado (ya lo probó
  // el guardrail de arriba), así que no queda Redemption huérfana al borrar.
  await Activation.deleteMany({ userId: { $in: ids } })
  const res = await User.deleteMany({ _id: { $in: ids } })
  console.log(`\n✅ ${res.deletedCount} cuenta(s) borrada(s).`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
