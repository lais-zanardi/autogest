# 📦 Documentação da Entrega 2 (Controle Financeiro, Análise e Dados) — AutoGest

## 1. Identificação e Metadados
- **Escopo:** 14 User Stories (Sprints 4 a 6)
- **Carga Horária Estimada:** 112h
- **Status Geral:** **100% Concluída** ✅
- **Data de Homologação:** 08/11/2026

---

## 2. Objetivo da Entrega
Expandir a experiência do **AutoGest** com inteligência analítica, rigor financeiro, conformidade e ferramentas avançadas de dados: controle proativo de teto orçamentário mensal, geração e restauração de backups locais criptografados (`.agbak`), trilha de auditoria completa, gráficos de categorização e média móvel, suporte ao Modo Viagem, estabelecimento de metas de eficiência com dicas contextuais, cotação integrada à Tabela FIPE (com catálogo offline), busca avançada com tags e exportação de relatórios em PDF e planilhas CSV.

---

## 3. Histórico de User Stories e Status de Implementação

| US | Título | Esforço | Status | Critério Principal Atendido |
|---|---|---|---|---|
| **US15** | Alertas de Teto Orçamentário Mensal | 8h | **Concluída** ✅ | Definição de teto com aviso nos 80%, alerta crítico nos 100% e chip no card. |
| **US21** | Trilha de Auditoria e Backup Local (.agbak) | 10h | **Concluída** ✅ | Backup cifrado com AES-256-GCM + PBKDF2 e trilha append-only com diff JSON. |
| **US38** | Restauração de Backup (.agbak) | 8h | **Concluída** ✅ | Decodificação segura por senha e restauração completa em banco limpo. |
| **US14** | Gráficos de Categorização de Gastos | 12h | **Concluída** ✅ | Visualização interativa em setores e barras por categoria de despesas. |
| **US25** | Gráfico de Consumo e Média Móvel | 10h | **Concluída** ✅ | Gráfico temporal de rendimento (km/l) com linha de média móvel suavizada. |
| **US26** | Alerta de Anomalia de Consumo | 6h | **Concluída** ✅ | Detecção de queda brusca (> 20%) de eficiência no histórico do veículo. |
| **US27** | Contexto do Registro: Percurso, Etiquetas e Notas | 8h | **Concluída** ✅ | Tipo de percurso (urbano, rodoviário, misto), notas e etiquetas customizadas. |
| **US33** | Busca e Filtros Avançados | 8h | **Concluída** ✅ | Busca por texto livre, período, categoria e tags em modal com navegação rápida. |
| **US39** | Configurações: Unidade e Pausa de Notificações | 6h | **Concluída** ✅ | Alternância entre km/l e L/100 km e pausa programada de alertas. |
| **US07** | Modo Viagem com Origem e Destino | 6h | **Concluída** ✅ | Acompanhamento de viagem ativa com agregação de pedágios e rendimento. |
| **US08** | Metas de Eficiência e Recomendações | 8h | **Concluída** ✅ | Meta de km/l com catálogo de recomendações ecológicas direcionadas. |
| **US19** | Exportação de Relatórios em PDF e CSV | 6h | **Concluída** ✅ | Geração de relatórios mensais formatados para PDF e planilhas CSV. |
| **US18** | Consulta à Tabela FIPE e Depreciação | 8h | **Concluída** ✅ | Cotação venal FIPE com catálogo embutido offline e histórico de depreciação. |
| **US30** | Agendamento de Manutenções Futuras | 8h | **Concluída** ✅ | Cronograma de compromissos com hora de lembrete e conversão com 1 toque. |

---

## 4. Spikes e Decisões de Arquitetura Consolidadas
- **SPK.1 (Criptografia de Backup):** `react-native-quick-crypto` com AES-256-GCM + AAD e PBKDF2-HMAC-SHA256 (600.000 iterações), processado em ~210 ms.
- **SPK.2 (Biblioteca de Gráficos):** `react-native-gifted-charts` + `react-native-svg` com renderização responsiva em 60/120Hz.
- **SPK.3 (Catálogo FIPE Resiliente):** Catálogo estático embutido em `fipeCatalog.ts` permitindo consulta e cálculo de depreciação mesmo sem conexão à internet.

---

## 5. Evidências de Testes e Validação
- **Suíte de Testes Automatizados:** 336 testes passando (100% de sucesso) em `npm test`, cobrindo criptografia, restauração, cálculo de anomalias, limites de teto e agregações.
- **Base de Demonstração (Etapa 41):** Carga determinística de 5 meses de dados históricos para Corolla Altis e Gol Trendline (`DemoSection.tsx` e `demoSeedGenerator.ts`).
- **Verificações de Qualidade:** 0 erros no TypeScript (`npx tsc --noEmit`) e 0 erros no ESLint.
