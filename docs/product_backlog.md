# 📋 Product Backlog — AutoGest

Este documento consolida o **Product Backlog** do sistema AutoGest, estruturado em **Épicos**, com requisitos funcionais/não-funcionais atendidos, prioridades, estimativas de esforço e detalhamento por Histórias de Usuário (US).

---

## 🧭 Visão Geral dos Épicos

| Épico | Nome | Descrição | Histórias de Usuário |
|---|---|---|---|
| **Épico 1** | **Fundação, Segurança e Onboarding** | Acesso ao aplicativo, proteção biométrica, gerenciamento de veículos, arquitetura offline-first e tour inicial. | US01, US02, US03, US04, US39 |
| **Épico 2** | **Abastecimento e Rodagem** | Registros de combustível, odômetro, consumo médio, detecção de anomalias e modo viagem com rotas. | US05, US06, US07, US25, US26 |
| **Épico 3** | **Manutenção Preventiva e Cuidados** | Histórico de serviços, regras de alerta por tempo/km, anexos, pneus, fluidos e agendamento futuro. | US09, US10, US11, US30, US31 |
| **Épico 4** | **Gestão Financeira, Custos e Auditoria** | Despesas operacionais, custos fixos, teto orçamentário mensal, trilha de auditoria e backup criptografado. | US13, US14, US15, US21, US22, US23, US24, US38 |
| **Épico 5** | **Inteligência, Mercado e Relatórios** | Metas de eficiência, consulta à Tabela FIPE, busca avançada com tags, notas de contexto e exportação em PDF/CSV. | US08, US18, US19, US27, US33 |
| **Épico 6** | **Integrações de Mercado e Extras** | Preços ANP e clima, postos baratos via GPS, histórico/alerta de preço limite, diretório de oficinas, mapa, comparativos e simulação. | US12, US16, US17, US20, US28, US29, US32, US34, US35, US36, US37 |

---

## 🏛️ Épico 1: Fundação, Segurança e Onboarding

### US01 — Autenticação Dupla (Firebase e Biometria)
- **Prioridade:** Alta | **Esforço:** 8h | **Entrega:** 1 (Sprint 1)
- **Descrição:** Como motorista, quero realizar login por biometria ou e-mail/senha para acessar a aplicação com rapidez e segurança.
- **Critérios de Aceite:**
  - Login e cadastro por e-mail e senha validados no Firebase Auth.
  - Oferta de biometria nativa após o primeiro login bem-sucedido.
  - Autenticação por sensor biométrico em menos de 2 segundos.
  - Sessão persistida de forma segura no aparelho.

### US02 — Sincronização em Nuvem Offline-First
- **Prioridade:** Alta | **Esforço:** 12h | **Entrega:** 1 (Sprint 2)
- **Descrição:** Como usuário em áreas sem sinal, quero salvar dados localmente para sincronizar automaticamente com a nuvem quando a conexão retornar.
- **Critérios de Aceite:**
  - Gravação local em SQLite antes de qualquer chamada de rede.
  - Fila persistente `fila_sync` com tentativas e backoff exponencial.
  - Endpoints idempotentes `PUT /api/v1/:recurso/:id` com IDs UUID gerados no cliente.
  - Indicador visual claro do status da sincronização (sincronizado, pendente ou erro).

### US03 — Tutorial Interativo de Primeiro Acesso
- **Prioridade:** Baixa | **Esforço:** 6h | **Entrega:** 1 (Sprint 3)
- **Descrição:** Como novo usuário, quero visualizar coach marks no primeiro acesso para conhecer as funções essenciais do app.
- **Critérios de Aceite:**
  - Apresentação de tour guiado destacando Garagem, Botão de Abastecimento e Métricas do Dashboard.
  - Opção para rever o tutorial a qualquer momento na aba Ajustes.

### US04 — Cadastro de Múltiplos Veículos
- **Prioridade:** Alta | **Esforço:** 8h | **Entrega:** 1 (Sprint 1)
- **Descrição:** Como gestor ou proprietário, quero cadastrar placa, modelo e capacidade do tanque de múltiplos veículos para gerenciar toda a minha frota.
- **Critérios de Aceite:**
  - CRUD completo com validação de placa (padrão antigo e Mercosul), ano e capacidade.
  - Seletor de veículo ativo integrado no topo das telas principais.
  - Exclusão lógica em cascata preservando a integridade referencial.

### US39 — Configurações: Unidade de Consumo e Pausa de Notificações
- **Prioridade:** Média | **Esforço:** 6h | **Entrega:** 2 (Sprint 5)
- **Descrição:** Como motorista, quero alternar entre km/l e L/100 km e pausar alertas temporariamente para adaptar o aplicativo ao meu perfil de uso.
- **Critérios de Aceite:**
  - Conversão bidirecional consistente entre km/l e L/100 km em toda a UI.
  - Possibilidade de pausar alertas por período determinado (ex.: férias) com reativação automática.

---

## ⛽ Épico 2: Abastecimento e Rodagem

### US05 — Registro Completo de Abastecimento
- **Prioridade:** Alta | **Esforço:** 10h | **Entrega:** 1 (Sprint 1)
- **Descrição:** Como motorista, quero cadastrar litros, valor total, tipo de combustível, odômetro e GPS para calcular rendimento e custo.
- **Critérios de Aceite:**
  - Cálculo automático de consumo médio entre abastecimentos consecutivos com tanque cheio.
  - Validação estrita de odômetro crescente.
  - Captura opcional de coordenadas de geolocalização e posto.

### US06 — Atualização Rápida de Hodômetro
- **Prioridade:** Média | **Esforço:** 4h | **Entrega:** 1 (Sprint 1)
- **Descrição:** Como condutor, quero atualizar a quilometragem atual do veículo sem precisar registrar um abastecimento.
- **Critérios de Aceite:**
  - Modal rápido com atalhos (+50 km, +100 km, +250 km).
  - Recálculo imediato de alertas preventivos que dependem da quilometragem.

### US07 — Modo Viagem com Origem e Destino
- **Prioridade:** Média | **Esforço:** 6h | **Entrega:** 2 (Sprint 6)
- **Descrição:** Como viajante, quero cadastrar o início e fim de um trajeto para agrupar pedágios, despesas e apurar o custo total da rota.
- **Critérios de Aceite:**
  - Registro de origem, destino, km inicial e final.
  - Associação de abastecimentos e despesas vinculadas à viagem.
  - Banner dinâmico de viagem em andamento no topo da tela inicial.

### US25 — Gráfico de Consumo e Média Móvel
- **Prioridade:** Média | **Esforço:** 10h | **Entrega:** 2 (Sprint 5)
- **Descrição:** Como motorista, quero visualizar a evolução do consumo ao longo do tempo com média móvel para identificar variações de eficiência.
- **Critérios de Aceite:**
  - Gráfico temporal interativo exibindo consumo por abastecimento e curva de média móvel suavizada.

### US26 — Alerta de Anomalia de Consumo
- **Prioridade:** Média | **Esforço:** 6h | **Entrega:** 2 (Sprint 5)
- **Descrição:** Como proprietário, quero receber alerta se o consumo cair bruscamente para investigar problemas mecânicos ou combustível adulterado.
- **Critérios de Aceite:**
  - Identificação automática de desvios negativos superiores a 20% em relação à média histórica.

---

## 🔧 Épico 3: Manutenção Preventiva e Cuidados

### US09 — Histórico e Registro de Manutenções
- **Prioridade:** Alta | **Esforço:** 10h | **Entrega:** 1 (Sprint 2)
- **Descrição:** Como motorista, quero lançar manutenções preventivas e corretivas com peças trocadas, custos e anexos para controle de histórico.
- **Critérios de Aceite:**
  - Registro detalhado de oficina, mecânico, tempo de execução e valor.
  - Upload e visualização de anexos (ordens de serviço, notas fiscais) de até 1 MB.

### US10 — Regras de Alerta Preventivo de Revisão
- **Prioridade:** Alta | **Esforço:** 8h | **Entrega:** 1 (Sprint 2)
- **Descrição:** Como condutor, quero configurar regras de manutenção por quilometragem e dias para ser avisado antes do vencimento.
- **Critérios de Aceite:**
  - Regras com antecedência configurável (ex.: 500 km ou 30 dias antes).
  - Status visual claro no painel: Em dia, Próxima ou Vencida.

### US11 — Controle de Pneus e Nível de Fluidos
- **Prioridade:** Média | **Esforço:** 8h | **Entrega:** 1 (Sprint 3)
- **Descrição:** Como motorista, quero registrar calibragem, desgaste de sulcos e nível de óleo/fluidos para manter a segurança do veículo.
- **Critérios de Aceite:**
  - Registro de calibragem (PSI) e profundidade de sulco (mm).
  - Monitoramento de óleo do motor, fluido de freio e líquido de arrefecimento com alerta em nível baixo.

### US30 — Agendamento de Manutenções Futuras
- **Prioridade:** Média | **Esforço:** 8h | **Entrega:** 2 (Sprint 6)
- **Descrição:** Como usuário, quero agendar revisões futuras com data e lembrete para não perder prazos da concessionária.
- **Critérios de Aceite:**
  - Cadastro de data, horário de lembrete e serviço.
  - Conversão de agendamento em manutenção realizada com 1 toque.

### US31 — Lembretes de Inspeção Visual
- **Prioridade:** Baixa | **Esforço:** 4h | **Entrega:** 3 (Sprint 8)
- **Descrição:** Como condutor, quero lembretes mensais para checar palhetas, lâmpadas e estepe.

---

## 💰 Épico 4: Gestão Financeira, Custos e Auditoria

### US13 — Dashboard Principal em Tempo Real
- **Prioridade:** Alta | **Esforço:** 14h | **Entrega:** 1 (Sprint 3)
- **Descrição:** Como usuário, quero ver um resumo executivo com gastos do mês, consumo médio, autonomia e alertas na tela inicial.
- **Critérios de Aceite:**
  - Card de destaque com consumo médio em km/l e L/100 km.
  - Grade com gasto total do mês, custo/km consolidado, autonomia estimada e hodômetro.

### US14 — Gráficos de Categorização de Gastos
- **Prioridade:** Média | **Esforço:** 12h | **Entrega:** 2 (Sprint 4)
- **Descrição:** Como gestor financeiro, quero ver a distribuição percentual das minhas despesas por categoria em gráficos interativos.
- **Critérios de Aceite:**
  - Visualização em setores e barras com divisão entre combustível, manutenção, impostos, seguros e lavagens.

### US15 — Alertas de Teto Orçamentário Mensal
- **Prioridade:** Média | **Esforço:** 8h | **Entrega:** 2 (Sprint 4)
- **Descrição:** Como motorista consciente, quero definir um limite mensal de gastos para ser avisado quando atingir 80% e 100% do teto.
- **Critérios de Aceite:**
  - Configuração de teto financeiro mensal por veículo.
  - Notificação única de aviso aos 80% e alerta crítico aos 100%.
  - Barra de progresso visual e chip discreto de status no cartão.

### US21 — Trilha de Auditoria e Backup Criptografado (.agbak)
- **Prioridade:** Alta | **Esforço:** 10h | **Entrega:** 2 (Sprint 4)
- **Descrição:** Como usuário zeloso com meus dados, quero exportar backup cifrado do banco e auditar alterações para ter soberania total sobre as informações.
- **Critérios de Aceite:**
  - Formato binário `.agbak` protegido por AES-256-GCM e chave derivada por PBKDF2.
  - Trilha append-only com diff `{ antes, depois }` de cada edição e exclusão.

### US22 — Registro de Despesas Operacionais
- **Prioridade:** Alta | **Esforço:** 8h | **Entrega:** 1 (Sprint 1)
- **Descrição:** Como motorista, quero cadastrar despesas de lavagem, seguro, estacionamento e impostos com categoria para apurar o custo total.

### US23 — Custos Fixos Recorrentes Mensais
- **Prioridade:** Média | **Esforço:** 4h | **Entrega:** 1 (Sprint 3)
- **Descrição:** Como proprietário, quero cadastrar despesas fixas recorrentes para que componham a média real de custo por quilômetro rodado.

### US24 — Indicadores de Ritmo de Uso e Custo/Km
- **Prioridade:** Alta | **Esforço:** 8h | **Entrega:** 1 (Sprint 3)
- **Descrição:** Como motorista, quero consultar a média de km rodados por dia e o custo consolidado por km em diferentes intervalos de tempo.
- **Critérios de Aceite:**
  - Retorno de `-- /km` quando não houver rodagem (evitando divisão por zero).
  - Filtro segmentado simplificado por período (Mês Atual, 30 Dias, 90 Dias, Ano Atual).

### US38 — Restauração de Backup (.agbak)
- **Prioridade:** Alta | **Esforço:** 8h | **Entrega:** 2 (Sprint 4)
- **Descrição:** Como usuário trocando de aparelho, quero importar meu arquivo `.agbak` com senha para restaurar todos os veículos e históricos.

---

## 📊 Épico 5: Inteligência, Mercado e Relatórios

### US08 — Metas de Eficiência e Recomendações Ecológicas
- **Prioridade:** Média | **Esforço:** 8h | **Entrega:** 2 (Sprint 6)
- **Descrição:** Como condutor ecológico, quero estabelecer metas de rendimento e receber dicas práticas para economizar combustível.
- **Critérios de Aceite:**
  - Definição de meta de km/l com comparação frente à média consolidada do veículo.
  - Catálogo de recomendações personalizadas com base no perfil de rodagem.

### US18 — Consulta e Histórico da Tabela FIPE
- **Prioridade:** Média | **Esforço:** 8h | **Entrega:** 2 (Sprint 6)
- **Descrição:** Como proprietário, quero consultar o valor venal do veículo pela Tabela FIPE para monitorar a depreciação patrimonial.
- **Critérios de Aceite:**
  - Integração com API FIPE e catálogo local embutido para funcionamento offline.
  - Gráfico e histórico de depreciação mensal.

### US19 — Exportação de Relatórios em PDF e Planilhas CSV
- **Prioridade:** Média | **Esforço:** 6h | **Entrega:** 2 (Sprint 6)
- **Descrição:** Como gestor ou condutor, quero exportar relatórios mensais em PDF diagramado e planilhas CSV para prestação de contas.

### US27 — Contexto de Lançamento: Percurso, Etiquetas e Notas
- **Prioridade:** Média | **Esforço:** 8h | **Entrega:** 2 (Sprint 5)
- **Descrição:** Como motorista, quero etiquetar abastecimentos e despesas (ex.: `#trabalho`, `#ferias`) e registrar o tipo de percurso para análises segmentadas.

### US33 — Busca e Filtros Avançados
- **Prioridade:** Média | **Esforço:** 8h | **Entrega:** 2 (Sprint 5)
- **Descrição:** Como usuário, quero pesquisar registros por texto livre, período, categoria e etiquetas para encontrar despesas passadas instantaneamente.

---

## 🌐 Épico 6: Integrações de Mercado e Extras (Entrega 3)

| US | Título | Esforço | Prioridade | Resumo |
|---|---|---|---|---|
| **US17** | Monitoramento de Preços ANP e Clima | 12h | Média | Comparação dos valores pagos com a média regional da ANP e clima local via OpenWeatherMap. |
| **US34** | Postos Mais Baratos por GPS | 8h | Média | Localização dos postos com menor preço nas imediações do motorista. |
| **US35** | Histórico de Preços e Alerta de Preço-Limite | 8h | Média | Alerta quando postos favoritos atingirem valor abaixo da meta cadastrada. |
| **US12** | Diretório de Oficinas Favoritas | 6h | Baixa | Cadastro e avaliação de oficinas mecânicas e autoelétricas de confiança. |
| **US36** | Mapa de Postos e Oficinas Visitados | 8h | Baixa | Visualização em mapa geográfico de todos os locais de abastecimento e manutenção. |
| **US16** | Simulador de Viabilidade e Economia | 10h | Baixa | Comparador financeiro de viabilidade: Gasolina vs Etanol vs GNV ou troca de veículo. |
| **US20** | Perfil Compartilhável via QR Code | 6h | Baixa | Compartilhamento do prontuário do veículo para valorização em venda de seminovos. |
| **US28** | Comparativos entre Combustíveis e Veículos | 10h | Baixa | Cruzamento estatístico de rendimento real entre veículos da frota e combustíveis. |
| **US29** | Perfil de Condução e Eficiência | 6h | Baixa | Diagnóstico do estilo de direção (agressivo, moderado, econômico). |
| **US32** | Galeria de Fotos do Veículo | 6h | Baixa | Armazenamento de fotos do veículo em diferentes ângulos e vistorias. |
| **US37** | Resumo Mensal Consolidado por E-mail | 8h | Baixa | Envio programado de relatório financeiro e de saúde do veículo para o e-mail do titular. |
