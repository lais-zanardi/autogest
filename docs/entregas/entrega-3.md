# 📦 Documentação da Entrega 3 (Integrações e Extras) — AutoGest

## 1. Identificação e Metadados
- **Escopo:** 12 User Stories (Sprints 7 a 9) + 3 Spikes (SPK.4, SPK.5 e SPK.6)
- **Carga Horária Estimada:** 92h
- **Status Geral:** **100% Concluída** ✅
- **Data de Conclusão:** 25/11/2026
- **Pré-requisitos:** Entregas 1 e 2 homologadas e concluídas.

---

## 2. Objetivo da Entrega
Ampliar o ecossistema do **AutoGest** por meio de integrações de mercado com cache resiliente, inteligência de localização por GPS em primeiro plano, simulador financeiro, comparativos avançados entre combustíveis e veículos, galeria fotográfica, perfil de condução, compartilhamento público revogável via QR Code e resumo mensal automatizado por e-mail com consentimento explícito.

---

## 3. Histórico de User Stories e Status de Implementação

### Sprint 7 — Preços de Combustível e Mercado (28h)

| US | Título | Esforço | Status | Critério Principal Atendido |
|---|---|---|---|---|
| **US17** | Monitoramento de Preços ANP e Clima | 12h | **Concluída** ✅ | Coleta diária de preços ANP com média municipal e aviso de granularidade, clima via Open-Meteo com cache persistido de 24h e exibição offline da última coleta. |
| **US34** | Postos Mais Baratos por GPS | 8h | **Concluída** ✅ | Tabela `postos` sincronizável somente leitura, ordenação pura por preço e distância (haversine), GPS exclusivamente em primeiro plano e fallback por município quando negado. |
| **US35** | Histórico de Preços e Alerta de Preço-Limite | 8h | **Concluída** ✅ | Gráfico de tendência (30 e 90 dias), avaliação `precoAtual ≤ precoLimite` com disparo único até o preço voltar a subir e respeito à pausa global (US39). |

---

### Sprint 8 — Oficinas, Mapa e Simulador (28h)

| US | Título | Esforço | Status | Critério Principal Atendido |
|---|---|---|---|---|
| **US12** | Diretório de Oficinas Favoritas | 6h | **Concluída** ✅ | CRUD de oficinas com validação de telefone e botão de ligar, favoritos, vínculo com manutenções gerando atendimentos e exclusão lógica preservando histórico e total gasto. |
| **US36** | Mapa de Postos e Oficinas Visitados | 8h | **Concluída** ✅ | Registro automático em `locais_visitados` apenas quando há coordenadas, agrupamento por proximidade (≤ 50 m) com contagem de visitas e legenda com ícones distintos. |
| **US16** | Simulador Financeiro de Viabilidade | 10h | **Concluída** ✅ | Regra dos 70% (`etanol ≤ 70% gasolina`), economia potencial mensal e custo previsto de viagem com preços pré-carregados da US17 e histórico salvo em `simulacoes`. |
| **US31** | Lembretes de Inspeção Visual | 4h | **Concluída** ✅ | Itens pré-definidos com periodicidade em dias, ciclos abertos em `ciclos_inspecao` com repetição diária limitada a 7 tentativas e reagendamento automático ao concluir. |

---

### Sprint 9 — Compartilhamento e Recursos Avançados (36h)

| US | Título | Esforço | Status | Critério Principal Atendido |
|---|---|---|---|---|
| **US32** | Galeria de Fotos do Veículo | 6h | **Concluída** ✅ | Captura/galeria com compressão, reuso do fluxo de URL assinada da US09, exibição cronológica com legenda e seleção de foto de capa (`veiculos.foto_capa_id`). |
| **US29** | Perfil de Condução e Eficiência | 6h | **Concluída** ✅ | Autoavaliação (`economico`, `normal`, `agressivo`) sem sensores, snapshot imutável no abastecimento sem reescrever histórico e gráfico de correlação de consumo. |
| **US28** | Comparativos entre Combustíveis e Veículos | 10h | **Concluída** ✅ | Comparação de consumo médio e custo/km entre combustíveis do mesmo veículo e entre veículos (período padrão 90 dias, alterável), com legenda textual e fallback `--`. |
| **US20** | Perfil Compartilhável via QR Code | 6h | **Concluída** ✅ | Token opaco de 32 bytes (armazenado apenas como hash SHA-256), validade de 30 dias revogável, allowlist estrita de campos públicos, rate limit próprio e leitor de QR no app. |
| **US37** | Resumo Mensal Consolidado por E-mail | 8h | **Concluída** ✅ | Consentimento explícito (`receber_resumo = false` por padrão), job mensal idempotente por `(usuario_id, mes_referencia)`, modelo texto/HTML pt-BR sem dados sensíveis e cancelamento por link. |

---

## 4. Spikes e Decisões de Arquitetura Consolidadas
- **SPK.4 (Preços ANP e Clima):** Fonte oficial CSV da ANP (média municipal com aviso de granularidade) + Open-Meteo para clima (gratuito, sem chave), com cache persistido de 24h em PostgreSQL/SQLite.
- **SPK.5 (Coordenadas de Postos):** Extração de postos pelo job diário da ANP combinada com geocodificação no backend (Nominatim/OSM), mantendo chaves e requisições externas isoladas na API.
- **SPK.6 (E-mail Transacional):** Provedor **Resend** atrás da interface `ProvedorEmail` (plano gratuito de 3.000 e-mails/mês e 100/dia, remetente `AutoGest <resumo@autogest.app>`), com timeout e 1 retentativa.

---

## 5. Evidências de Testes e Validação
- **Suíte de Testes da Entrega 3:** 16 arquivos de teste (38 suítes, **84 testes passando**, 0 falhas) cobrindo adaptadores ANP/clima/postos com fixtures gravadas, ordenação haversine, alertas de preço, oficinas, mapa por proximidade, simulador, inspeção visual, fotos, perfil de condução, comparativos, compartilhamento QR Code e job de resumo mensal por e-mail.
- **Verificações de Qualidade:** 0 erros de tipagem (`tsc --noEmit` em `apps/api` e `apps/mobile`) e 0 erros de lint (`eslint`).
