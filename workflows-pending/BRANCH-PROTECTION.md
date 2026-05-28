# Branch protection — `main`

Para que el CI de `.github/workflows/ci.yml` realmente proteja `main`, hay que
configurar **Branch protection rules** desde la UI de GitHub (no se puede
hacer 100% por código).

## Cómo configurarlo (una sola vez)

1. Ir a **https://github.com/soyalantapia/misanpedro/settings/branches**
2. Click **"Add branch protection rule"**
3. Branch name pattern: `main`
4. Marcar:
   - ✅ **Require a pull request before merging**
     - ✅ Require approvals: 1 (si trabajás solo, podés saltearlo o marcar "allow self approval")
   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - **Status checks**: buscar y agregar `test` (el job del workflow `ci.yml`)
   - ✅ **Require conversation resolution before merging**
   - ❌ **Do not allow bypassing the above settings** (dejarlo OFF por ahora si trabajás solo y necesitás hotfixes urgentes; activarlo cuando haya equipo)
5. Click **"Create"** o **"Save changes"**

## Qué bloquea esto

- Push directo a `main` desde local (forzás PR)
- Merge de PR con CI rojo
- Merge sin revisión (si activaste el approval)

## Qué NO bloquea (intencional para solo-dev)

- Force push si sos admin del repo y desactivaste el bypass-prevention
- Skip de hooks locales (los CI checks son la red real)

## Si necesitás push directo de emergencia

Si workfloweás solo y tenés una emergencia productiva:

```bash
git push origin main --no-verify   # NO funciona si "Do not allow bypassing" está ON
```

Mejor patrón emergencia: crear PR rápido + auto-merge + ver CI verde antes de
que se note el bug en prod. Toma 3 minutos extra y te ahorra romper main.
