#!/usr/bin/env bash
# Produce un episodio completo. Uso: ./producir.sh ep03_957_1015 [--texto extracto_infoleg.txt]
set -euo pipefail
cd "$(dirname "$0")"
SLUG="$1"; shift || true
python3 pipeline/00_verificar_ley.py "$SLUG" "$@"
python3 pipeline/01_planos_floot.py "$SLUG" --control
if [ -d voces/moldes ]; then python3 pipeline/03_voces.py "$SLUG"; else echo "Sin moldes de voz: se renderiza con duraciones estimadas."; fi
python3 pipeline/05_componer.py "$SLUG"
python3 pipeline/06_hoja_contacto.py "$SLUG"
python3 pipeline/07_textos.py "$SLUG"
echo "Listo para revisión de Andrés (no se publicó nada)."
