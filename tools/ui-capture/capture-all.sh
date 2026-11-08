#!/usr/bin/env bash
# tools/ui-capture/capture-all.sh
# Script unificado para execução e reprodução das capturas de telas de UI/UX do AutoGest

set -e

DEVICE="${1:-emulator-5554}"
echo "==> Iniciando captura de telas no dispositivo: $DEVICE"

# Ativa temporariamente o modo de demonstração da barra de status
adb -s "$DEVICE" shell settings put global sysui_demo_allowed 1
adb -s "$DEVICE" shell am broadcast -a com.android.systemui.demo -e command enter
adb -s "$DEVICE" shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1200
adb -s "$DEVICE" shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb -s "$DEVICE" shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 -e fully true

# Executa o script Python orquestrador
python tools/ui-capture/capture.py

# Restaura o estado original do SystemUI
adb -s "$DEVICE" shell am broadcast -a com.android.systemui.demo -e command exit
adb -s "$DEVICE" shell settings put global sysui_demo_allowed 0

echo "==> Capturas concluídas e ambiente restaurado com sucesso!"
