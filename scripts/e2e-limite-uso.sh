#!/bin/bash
# E2E real del LÍMITE DE USO POR PERSONA contra la API corriendo (dev).
# Recorre el camino de producción (HTTP + auth + tenant + Mongo + enforcement).
#
# Uso:  pnpm dev:api   (API en :3002)
#       bash scripts/e2e-limite-uso.sh
#
# Verifica: bloqueo en ACTIVAR y en CONFIRMAR, "sin límite" deja repetir,
# usoMax>1 permite N y bloquea N+1, y que la serialización expone usoVentana.
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
API="${API:-http://localhost:3002/api/v1}"
T="${TENANT:-sanpedro}"
S="lim$(date +%s)$RANDOM"; DNI=$(printf '%08d' $(( (RANDOM * RANDOM + RANDOM) % 100000000 )))
D=$(mktemp -d)
PASS=0; FAIL=0

exf(){ node -e 'let s=require("fs").readFileSync(process.argv[1],"utf8");let v="";try{v=eval("JSON.parse(s)"+process.argv[2])}catch(e){v=""}process.stdout.write(v==null?"":String(v))' "$1" "$2"; }
postA(){ curl -s -H "Content-Type: application/json" -H "X-Tenant-Slug: $T" -H "Authorization: Bearer $2" -X POST "$API$1" -d "$3" -o "$4" -w "%{http_code}"; }
post(){ curl -s -H "Content-Type: application/json" -H "X-Tenant-Slug: $T" -X POST "$API$1" -d "$2" -o "$3" -w "%{http_code}"; }
patchA(){ curl -s -H "Content-Type: application/json" -H "X-Tenant-Slug: $T" -H "Authorization: Bearer $2" -X PATCH "$API$1" -d "$3" -o "$4" -w "%{http_code}"; }
getp(){ curl -s -H "X-Tenant-Slug: $T" "$API$1" -o "$2" -w "%{http_code}"; }
check(){ if [ "$2" = "$3" ]; then echo "  ✅ $1 ($2)"; PASS=$((PASS+1)); else echo "  ❌ $1 — esperado [$3], fue [$2]"; FAIL=$((FAIL+1)); fi; }

CUP='"descripcion":"Cupon de prueba del limite de uso por persona E2E","condiciones":"-","porcentaje":20,"tipoOferta":"porcentaje","vigenciaHasta":"2026-12-31","estado":"activo"'

echo "== Setup: comercio (OTP-login) + vecino =="
# OTP-login a un comercio existente (signup es 3/hora). En dev el código viene en la respuesta.
# Pasá otro con: MEMAIL=tu-comercio@... bash scripts/e2e-limite-uso.sh
MEMAIL="${MEMAIL:-com-qa1780756196@test.local}"
post /merchant/auth/request-otp "{\"email\":\"$MEMAIL\"}" "$D/otp.json" >/dev/null
OCODE=$(exf "$D/otp.json" "._debugCode")
[ -z "$OCODE" ] && { echo "  ❌ request-otp comercio falló: $(head -c 160 "$D/otp.json")"; exit 1; }
post /merchant/auth/verify-otp "{\"email\":\"$MEMAIL\",\"code\":\"$OCODE\"}" "$D/m.json" >/dev/null
MT=$(exf "$D/m.json" ".accessToken")
[ -z "$MT" ] && { echo "  ❌ verify-otp comercio falló: $(head -c 160 "$D/m.json")"; exit 1; }
code=$(post /auth/register "{\"dni\":\"$DNI\",\"nombre\":\"QA Vecino\",\"email\":\"vlim-$S@test.local\",\"whatsapp\":\"549$DNI\",\"fechaNacimiento\":\"1990-01-01\",\"acceptedTc\":true}" "$D/u.json")
UT=$(exf "$D/u.json" ".accessToken")
[ -z "$UT" ] && { echo "  ❌ registro vecino falló ($code): $(head -c 160 "$D/u.json")"; exit 1; }
echo "  comercio + vecino OK"

echo "== 1) 'una sola vez' (devida, max 1): bloqueo en ACTIVAR =="
postA /coupons "$MT" "{\"titulo\":\"Una sola vez E2E\",$CUP,\"usoMaxPorPersona\":1,\"usoVentana\":\"devida\"}" "$D/c1.json" >/dev/null
C1=$(exf "$D/c1.json" ".coupon.id")
getp "/coupons/$C1" "$D/c1pub.json" >/dev/null
check "serializa usoVentana=devida" "$(exf "$D/c1pub.json" ".coupon.usoVentana")" "devida"
postA /activations "$UT" "{\"couponId\":\"$C1\"}" "$D/a1.json" >/dev/null
A1=$(exf "$D/a1.json" ".activation.id")
postA /redemptions/confirm "$MT" "{\"activationId\":\"$A1\",\"montoTicket\":1000}" "$D/r1.json" >/dev/null
check "1er canje OK" "$(exf "$D/r1.json" ".ok")" "true"
code=$(postA /activations "$UT" "{\"couponId\":\"$C1\"}" "$D/a1b.json")
check "2da activacion bloqueada (HTTP 409)" "$code" "409"
check "motivo = limite_por_persona" "$(exf "$D/a1b.json" ".motivo")" "limite_por_persona"

echo "== 2) 'sin límite' (ilimitado): deja repetir =="
postA /coupons "$MT" "{\"titulo\":\"Sin limite E2E\",$CUP,\"usoVentana\":\"ilimitado\"}" "$D/c2.json" >/dev/null
C2=$(exf "$D/c2.json" ".coupon.id")
postA /activations "$UT" "{\"couponId\":\"$C2\"}" "$D/a2.json" >/dev/null
postA /redemptions/confirm "$MT" "{\"activationId\":\"$(exf "$D/a2.json" ".activation.id")\",\"montoTicket\":1000}" "$D/r2.json" >/dev/null
code=$(postA /activations "$UT" "{\"couponId\":\"$C2\"}" "$D/a2b.json")
check "2da activacion permitida (HTTP 201)" "$code" "201"
postA /redemptions/confirm "$MT" "{\"activationId\":\"$(exf "$D/a2b.json" ".activation.id")\",\"montoTicket\":1000}" "$D/r2b.json" >/dev/null
check "2do canje permitido" "$(exf "$D/r2b.json" ".ok")" "true"

echo "== 3) usoMax 2 + bloqueo en CONFIRMAR (config cambia con código activo) =="
postA /coupons "$MT" "{\"titulo\":\"Dos por persona E2E\",$CUP,\"usoMaxPorPersona\":2,\"usoVentana\":\"devida\"}" "$D/c3.json" >/dev/null
C3=$(exf "$D/c3.json" ".coupon.id")
postA /activations "$UT" "{\"couponId\":\"$C3\"}" "$D/a3.json" >/dev/null
postA /redemptions/confirm "$MT" "{\"activationId\":\"$(exf "$D/a3.json" ".activation.id")\",\"montoTicket\":1000}" "$D/r3.json" >/dev/null
check "max2: 1er canje OK" "$(exf "$D/r3.json" ".ok")" "true"
code=$(postA /activations "$UT" "{\"couponId\":\"$C3\"}" "$D/a3b.json")
check "max2: 2da activacion permitida (usos 1<2)" "$code" "201"
A3B=$(exf "$D/a3b.json" ".activation.id")
# El comercio baja el tope a 1 mientras el vecino tiene el código B activo:
patchA "/coupons/$C3" "$MT" "{\"usoMaxPorPersona\":1}" "$D/p3.json" >/dev/null
code=$(postA /redemptions/confirm "$MT" "{\"activationId\":\"$A3B\",\"montoTicket\":1000}" "$D/r3b.json")
check "CONFIRMAR bloqueado tras bajar el tope (HTTP 409)" "$code" "409"
check "motivo confirm = limite_por_persona" "$(exf "$D/r3b.json" ".motivo")" "limite_por_persona"

echo ""
echo "RESULTADO: $PASS OK · $FAIL fallos"
rm -rf "$D"
[ "$FAIL" -eq 0 ]
