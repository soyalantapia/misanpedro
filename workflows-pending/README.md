# `workflows-pending/` — Activar CI/CD manualmente

Este directorio contiene archivos que **vos** tenés que copiar manualmente a
`.github/workflows/` y `.github/`. La razón: el token OAuth que Claude usa
para hacer push no tiene el scope `workflow` (políticas de GitHub para
prevenir que automaciones modifiquen pipelines sin supervisión humana).

## Pasos para activar el CI (3 minutos)

```bash
mkdir -p .github/workflows
cp workflows-pending/ci.yml.template .github/workflows/ci.yml
cp workflows-pending/BRANCH-PROTECTION.md .github/BRANCH-PROTECTION.md
git add .github/
git commit -m "ci: activar GitHub Actions workflow (B3)"
git push origin main
```

Después de ese push:
1. Andá a https://github.com/soyalantapia/misanpedro/actions y verificá
   que el workflow corre (debería tardar ~2-3 min la primera vez).
2. Seguí las instrucciones de `BRANCH-PROTECTION.md` para activar la
   regla de protección de `main` en la UI de GitHub.

## Por qué Claude no puede hacer esto solo

GitHub bloquea por seguridad que cualquier OAuth App / GitHub App cree o
modifique archivos `.github/workflows/**` sin el scope `workflow` (que
permitiría a la app correr código arbitrario en los runners de GitHub Actions
en nombre de la cuenta del owner del repo). Es una buena política — pero
significa que este archivo lo tenés que mover vos a mano una sola vez.

## Una vez activado, podés borrar este directorio

```bash
rm -rf workflows-pending/
git commit -am "chore: cleanup workflows-pending (CI ya activo)"
```
