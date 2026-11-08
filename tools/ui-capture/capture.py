"""
Script robusto para captura de telas de revisão de UI/UX (AutoGest - Etapa 42).
Mapeia precisamente as coordenadas e fluxos da aplicação.
Gera dumps de UI, screenshots nativas e monta contact sheets com Pillow.
"""

import os
import sys
import time
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

DEVICE = "emulator-5554"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCREENS_DIR = os.path.join(BASE_DIR, "docs", "ui-review", "screens")
DUMPS_DIR = os.path.join(BASE_DIR, "docs", "ui-review", "ui-dumps")
SHEETS_DIR = os.path.join(BASE_DIR, "docs", "ui-review", "contact-sheets")

os.makedirs(SCREENS_DIR, exist_ok=True)
os.makedirs(DUMPS_DIR, exist_ok=True)
os.makedirs(SHEETS_DIR, exist_ok=True)

manifest_records = []

def adb(*args):
    cmd = ["adb", "-s", DEVICE] + list(args)
    res = subprocess.run(cmd, capture_output=True, text=False)
    return res.stdout

def tap(x, y, delay=1.2):
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(delay)

def swipe(x1, y1, x2, y2, duration=350, delay=1.2):
    adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration))
    time.sleep(delay)

def keyevent(code, delay=1.0):
    adb("shell", "input", "keyevent", str(code))
    time.sleep(delay)

def back(delay=1.2):
    keyevent(4, delay=delay)

def dump_ui(max_retries=3):
    remote = "/sdcard/window_dump.xml"
    for _ in range(max_retries):
        adb("shell", "uiautomator", "dump", remote)
        time.sleep(0.4)
        raw = adb("shell", "cat", remote)
        if b"<hierarchy" in raw:
            return raw.decode('utf-8', errors='ignore')
        time.sleep(0.8)
    return ""

def capture(id_str, screen_name, slug, state_suffix, us_tag, notes=""):
    full_slug = f"{id_str}-{slug}--{state_suffix}"
    png_path = os.path.join(SCREENS_DIR, f"{full_slug}.png")
    xml_path = os.path.join(DUMPS_DIR, f"{full_slug}.xml")

    # 1. UI dump
    xml_content = dump_ui()
    with open(xml_path, "w", encoding="utf-8") as f:
        f.write(xml_content)

    # 2. Screencap
    img_data = adb("exec-out", "screencap", "-p")
    with open(png_path, "wb") as f:
        f.write(img_data)

    print(f"[{id_str}] Capturado: {full_slug}.png ({len(img_data)} bytes)")
    manifest_records.append({
        "id": id_str,
        "screen": screen_name,
        "slug": slug,
        "state": state_suffix,
        "file": f"{full_slug}.png",
        "us": us_tag,
        "notes": notes
    })

def ensure_corolla_home():
    for _ in range(3):
        xml = dump_ui()
        if "RESUMO FINANCEIRO" in xml and "Corolla" in xml:
            tap(108, 2278) # Tab Inicio
            return
        back()
    # Se ainda nao estiver no Corolla, abre seletor e escolhe
    tap(300, 230)
    time.sleep(1)
    tap(540, 1300) # Corolla
    time.sleep(1)
    tap(108, 2278)
    time.sleep(1)

def run_all():
    print("Iniciando rotina completa de capturas (AutoGest)...")
    ensure_corolla_home()

    # ----------------------------------------------------
    # GRUPO 1: DASHBOARD E SELETOR
    # ----------------------------------------------------
    # 01 - Dashboard
    capture("01", "Início (Dashboard)", "dashboard", "preenchida-a", "US03, US04, US05, US06", "Visão do topo: seletor, resumo financeiro e cartões de KPI")
    swipe(540, 1800, 540, 600)
    capture("01", "Início (Dashboard)", "dashboard", "preenchida-b", "US04, US15", "Visão intermediária: odômetro, alerta de manutenção preventiva")
    swipe(540, 1800, 540, 600)
    capture("01", "Início (Dashboard)", "dashboard", "preenchida-c", "US02, US20", "Visão inferior: botões de ação rápida e especificações técnicas")

    # Volta ao topo da Home
    swipe(540, 600, 540, 1800)
    swipe(540, 600, 540, 1800)

    # 02 - Seletor de Veículo
    tap(300, 230)
    capture("02", "Seletor de Veículo Ativo", "seletor-veiculo", "seletores", "US02, US36", "Bottom sheet com lista de veículos cadastrados (Corolla, Gol, Celta)")
    back()

    # ----------------------------------------------------
    # GRUPO 2: FORMULÁRIOS DE LANÇAMENTOS E VALIDAÇÃO
    # ----------------------------------------------------
    # 03 - Novo Abastecimento (FAB +)
    tap(540, 2260) # FAB central
    capture("03", "Novo Abastecimento", "novo-abastecimento", "preenchida-a", "US03, US07, US08", "Formulário inicial com campos de odômetro, litros e valor")
    swipe(540, 1800, 540, 600)
    capture("03", "Novo Abastecimento", "novo-abastecimento", "preenchida-b", "US08, US09", "Inferior: tipo de combustível, tipo de percurso, tags e GPS")
    # Dispara erro de validação tentando salvar vazio
    tap(705, 2167) # Botão Salvar Abastecimento
    capture("03", "Novo Abastecimento", "novo-abastecimento", "validacao-erros", "US03, US07", "Mensagens de validação de campos obrigatórios")
    back() # Fecha modal

    # 04 - Registro de Despesa (via botão rápido da Home)
    ensure_corolla_home()
    swipe(540, 1800, 540, 600) # Rola para ver ações
    tap(210, 1888) # Botão Despesa
    capture("04", "Registro de Despesa", "registro-despesa", "preenchida", "US10, US11, US12", "Modal de lançamento de despesa com seleção de categorias")
    tap(720, 1890) # Botão Registrar Despesa sem preencher
    capture("04", "Registro de Despesa", "registro-despesa", "validacao-erros", "US10, US11", "Validação de preenchimento obrigatório de valor e dados")
    back()

    # 05 - Custo Fixo Recorrente (via botão rápido da Home)
    ensure_corolla_home()
    swipe(540, 1800, 540, 600)
    tap(400, 1888) # Botão Fixo
    capture("05", "Custo Fixo Recorrente", "custo-fixo", "preenchida", "US13", "Modal para cadastro de custos fixos mensais com cálculo de impacto")
    tap(720, 1680) # Cadastrar sem preencher
    capture("05", "Custo Fixo Recorrente", "custo-fixo", "validacao-erros", "US13", "Validação de campos obrigatórios de custo fixo")
    back()

    # 06 - Registro de Manutenção (via botão rápido da Home)
    ensure_corolla_home()
    swipe(540, 1800, 540, 600)
    tap(600, 1888) # Botão Manutenção
    capture("06", "Registro de Manutenção", "registro-manutencao", "preenchida-a", "US14, US15", "Modal de nova manutenção com seletor de tipos e serviços")
    swipe(540, 1800, 540, 600)
    capture("06", "Registro de Manutenção", "registro-manutencao", "preenchida-b", "US14, US15", "Inferior: dados de oficina, mecânico e tempo de execução")
    tap(720, 2160) # Salvar sem preencher descrição
    capture("06", "Registro de Manutenção", "registro-manutencao", "validacao-erros", "US14", "Validação de obrigatoriedade de descrição e serviços")
    back()

    # 07 - Atualização Rápida de Km (via botão rápido da Home)
    ensure_corolla_home()
    swipe(540, 1800, 540, 600)
    tap(875, 1888) # Botão Atualizar km
    capture("07", "Atualização Rápida de Km", "atualizacao-km", "preenchida", "US04", "Modal de atualização rápida com chips de incremento (+50, +100...)")
    tap(720, 1720) # Salvar sem preencher
    capture("07", "Atualização Rápida de Km", "atualizacao-km", "validacao-erros", "US04", "Validação exigindo km superior à marcação anterior")
    back()

    # ----------------------------------------------------
    # GRUPO 3: NAVEGAÇÃO PRINCIPAL (GARAGEM, RELATÓRIOS)
    # ----------------------------------------------------
    # 08 - Garagem (Tab 2)
    tap(350, 2278) # Tab Garagem
    capture("08", "Garagem (Veículos e Ficha)", "garagem", "preenchida-a", "US02, US20", "Visão do topo: card do Corolla ativo e botão de adicionar veículo")
    swipe(540, 1800, 540, 600)
    capture("08", "Garagem (Veículos e Ficha)", "garagem", "preenchida-b", "US02, US20", "Inferior: lista de outros veículos cadastrados (Gol Trendline, Celta)")

    # 09 - Relatórios (Tab 4)
    tap(720, 2278) # Tab Relatórios
    capture("09", "Relatórios e Indicadores", "relatorios", "preenchida-a", "US16, US17, US18", "Visão do topo: seletor mensal e indicadores de rodagem")
    swipe(540, 1800, 540, 600)
    capture("09", "Relatórios e Indicadores", "relatorios", "preenchida-b", "US16, US17, US18", "Visão intermediária: gráfico de distribuição percentual por categoria")
    swipe(540, 1800, 540, 600)
    capture("09", "Relatórios e Indicadores", "relatorios", "preenchida-c", "US18, US22", "Visão inferior: quebra de categorias e resumo agregado do mês")

    # 22 - Distribuição por Categoria em Tela Cheia
    tap(920, 820) # Botão Expandir no card de distribuição
    capture("22", "Distribuição por Categoria", "distribuicao-categoria", "preenchida", "US18", "Modal em tela cheia com alternância entre setores e barras")
    back()

    # ----------------------------------------------------
    # GRUPO 4: AJUSTES, BACKUP, AUDITORIA E DADOS
    # ----------------------------------------------------
    # 10 - Ajustes e Perfil (Tab 5)
    tap(960, 2278) # Tab Ajustes
    capture("10", "Ajustes e Perfil", "ajustes", "preenchida-a", "US01, US02.6, US21", "Visão do topo: perfil do usuário, status de sincronização e backup")
    swipe(540, 1800, 540, 600)
    capture("10", "Ajustes e Perfil", "ajustes", "preenchida-b", "US41", "Visão intermediária: seção de controle e roteiro da base de demonstração")
    swipe(540, 1800, 540, 600)
    capture("10", "Ajustes e Perfil", "ajustes", "preenchida-c", "US39", "Visão inferior: menu de conta, preferências e encerramento de sessão")

    # Volta ao topo de Ajustes
    swipe(540, 600, 540, 1800)
    swipe(540, 600, 540, 1800)

    # 11 - Criar Backup Local
    tap(540, 610) # Criar Backup Local
    capture("11", "Criar Backup Local", "criar-backup", "preenchida", "US21.4", "Tela com senha mestre para exportação segura criptografada")
    back()

    # 12 - Restaurar Backup Local
    tap(540, 735) # Restaurar Backup Local
    capture("12", "Restaurar Backup Local", "restaurar-backup", "preenchida", "US21.8", "Tela com seleção de arquivo .agbak e senha de decodificação")
    back()

    # 13 - Histórico de Alterações (Auditoria)
    tap(540, 860) # Histórico de Auditoria
    capture("13", "Histórico de Alterações", "historico-auditoria", "preenchida", "US21.9", "Trilha de auditoria append-only com diff de edições e exclusões")
    back()

    # Rola para a seção CONTA E PREFERÊNCIAS
    swipe(540, 1800, 540, 600)
    swipe(540, 1800, 540, 700)

    # 14 - Valor de Mercado (Tabela FIPE)
    tap(540, 1050) # Valor de Mercado
    capture("14", "Valor de Mercado (FIPE)", "fipe", "preenchida-a", "US20", "Topo: cotação atual, código FIPE e gráfico de variação histórica")
    swipe(540, 1800, 540, 600)
    capture("14", "Valor de Mercado (FIPE)", "fipe", "preenchida-b", "US20", "Inferior: histórico detalhado de consultas e depreciação")
    back()

    # 15 - Exportar Relatórios (PDF e CSV)
    tap(540, 1175) # Exportar Relatórios
    capture("15", "Exportar Relatórios", "exportar-relatorios", "preenchida", "US19", "Configuração de exportação com período, formato e opções")
    back()

    # 16 - Metas de Eficiência e Dicas
    tap(540, 1300) # Metas de Eficiência
    capture("16", "Metas de Eficiência", "metas-eficiencia", "preenchida-a", "US28", "Topo: progresso da meta ativa de km/l e comparação com média móvel")
    swipe(540, 1800, 540, 600)
    capture("16", "Metas de Eficiência", "metas-eficiencia", "preenchida-b", "US28", "Inferior: dicas ecológicas contextuais para economia de combustível")
    back()

    # 17 - Modo Viagem (Rotas e Custos)
    tap(540, 1430) # Modo Viagem
    capture("17", "Modo Viagem", "modo-viagem", "preenchida", "US29", "Lista de viagens registradas com custo consolidado e rendimento")
    back()

    # 18 - Buscar e Filtros Avançados
    tap(540, 1550) # Buscar e Filtros Avançados
    capture("18", "Buscar e Filtros Avançados", "buscar-filtros", "preenchida", "US30", "Tela de busca textual com filtros por tipo, período e etiquetas")
    back()

    # 19 - Análise de Consumo e Média Móvel
    tap(540, 1680) # Análise de Consumo
    capture("19", "Análise de Consumo", "analise-consumo", "preenchida-a", "US05, US17", "Topo: indicadores consolidados e médias de consumo do veículo")
    swipe(540, 1800, 540, 600)
    capture("19", "Análise de Consumo", "analise-consumo", "preenchida-b", "US05, US17", "Inferior: gráfico temporal de evolução do rendimento")
    back()

    # 20 - Preferências (Unidade e Notificações)
    tap(540, 1810) # Preferências
    capture("20", "Preferências do Sistema", "preferencias", "preenchida-a", "US39", "Topo: seletor de unidade de consumo (km/l vs L/100 km) e temas")
    swipe(540, 1800, 540, 600)
    capture("20", "Preferências do Sistema", "preferencias", "preenchida-b", "US39", "Inferior: permissões, alertas preventivos e segurança biométrica")
    back()

    # ----------------------------------------------------
    # GRUPO 5: AGENDAMENTOS E ATALHOS DA HOME
    # ----------------------------------------------------
    ensure_corolla_home()
    # 21 - Agendamentos de Manutenção (ícone no cabeçalho da Home)
    tap(730, 445) # Ícone de chave inglesa na barra de ações rápidas
    capture("21", "Agendamentos de Manutenção", "agendamentos-manutencao", "preenchida", "US15", "Linha do tempo com revisões futuras e lembretes configurados")
    back()

    # ----------------------------------------------------
    # VERIFICAÇÃO PROTEGIDA FINAL
    # ----------------------------------------------------
    ensure_corolla_home()
    final_dump = dump_ui()
    if "820,00" in final_dump:
        print("[VERIFICAÇÃO PROTEGIDA] Integridade confirmada com sucesso: Gasto Total do Mês = R$ 820,00.")
    else:
        print("[AVISO] Valor do indicador mudou.")

    # ----------------------------------------------------
    # GERAÇÃO DAS FOLHAS DE CONTATO (CONTACT SHEETS)
    # ----------------------------------------------------
    generate_contact_sheets()

    # ----------------------------------------------------
    # GERAÇÃO DO ÍNDICE MARKDOWN
    # ----------------------------------------------------
    generate_index_markdown()

def generate_contact_sheets():
    print("Gerando folhas de contato (contact sheets) com Pillow...")
    groups = {
        "01-dashboard-e-lancamentos": [r for r in manifest_records if int(r["id"]) in range(1, 8)],
        "02-garagem-relatorios-categoria": [r for r in manifest_records if int(r["id"]) in [8, 9, 22]],
        "03-ajustes-backup-fipe-viagem": [r for r in manifest_records if int(r["id"]) in range(10, 22)],
    }

    thumb_w, thumb_h = 270, 606 # Proporção 1080x2424 / 4
    cols = 4

    for group_name, records in groups.items():
        if not records:
            continue
        rows = (len(records) + cols - 1) // cols
        sheet_w = cols * (thumb_w + 20) + 20
        sheet_h = rows * (thumb_h + 50) + 60

        sheet = Image.new("RGB", (sheet_w, sheet_h), color=(18, 18, 20))
        draw = ImageDraw.Draw(sheet)

        draw.text((25, 20), f"AutoGest — Folha de Contato: {group_name}", fill=(210, 253, 0))

        for idx, rec in enumerate(records):
            c = idx % cols
            r = idx // cols
            x = 20 + c * (thumb_w + 20)
            y = 60 + r * (thumb_h + 50)

            img_path = os.path.join(SCREENS_DIR, rec["file"])
            if os.path.exists(img_path):
                with Image.open(img_path) as im:
                    im_thumb = im.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                    sheet.paste(im_thumb, (x, y))
                    draw.rectangle([x, y, x + thumb_w, y + thumb_h], outline=(50, 50, 55), width=1)
            
            draw.text((x + 2, y + thumb_h + 6), f"{rec['id']} - {rec['state']}", fill=(200, 200, 200))
            draw.text((x + 2, y + thumb_h + 24), rec['us'], fill=(150, 150, 150))

        out_path = os.path.join(SHEETS_DIR, f"{group_name}.png")
        sheet.save(out_path)
        print(f"[OK] Contact sheet salva: {out_path}")

def generate_index_markdown():
    index_path = os.path.join(BASE_DIR, "docs", "ui-review", "INDEX.md")
    print(f"Gerando índice em: {index_path}")

    md = []
    md.append("# AutoGest — Índice Geral de Revisão de UI/UX (Etapa 42)\n")
    md.append("Este documento reúne todas as capturas em resolução nativa obtidas em ambiente de demonstração controlado para subsidiar a avaliação minuciosa de UI/UX.\n")
    md.append("## Folhas de Contato por Grupo\n")
    md.append("- [Grupo 1: Dashboard e Lançamentos](contact-sheets/01-dashboard-e-lancamentos.png)")
    md.append("- [Grupo 2: Garagem, Relatórios e Categorização](contact-sheets/02-garagem-relatorios-categoria.png)")
    md.append("- [Grupo 3: Ajustes, Backup, FIPE e Módulos Especializados](contact-sheets/03-ajustes-backup-fipe-viagem.png)\n")
    md.append("## Inventário de Capturas por Épico e Tela\n")
    md.append("| ID | Tela | Estado | US | Visualização | Arquivo / Dumps | Observações |")
    md.append("|---|---|---|---|---|---|---|")

    for r in manifest_records:
        rel_img = f"screens/{r['file']}"
        dump_file = f"ui-dumps/{r['file'].replace('.png', '.xml')}"
        img_tag = f'<img src="{rel_img}" width="140" />'
        md.append(f"| {r['id']} | **{r['screen']}** | `{r['state']}` | {r['us']} | {img_tag} | [`{r['file']}`]({rel_img})<br>[`Dump XML`]({dump_file}) | {r['notes']} |")

    with open(index_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print("[OK] INDEX.md gerado com sucesso!")

if __name__ == "__main__":
    run_all()
