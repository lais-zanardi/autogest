# 📦 Documentação da Entrega 3 (Integrações e Extras) — AutoGest

## 1. Identificação e Metadados
- **Escopo:** 11 User Stories (Sprints 7 a 9)
- **Carga Horária Estimada:** 92h
- **Status Geral:** **Planejada / Em Aberto** ⏳
- **Pré-requisitos:** Entregas 1 e 2 homologadas e concluídas.

---

## 2. Objetivo da Entrega
Ampliar o ecossistema do **AutoGest** por meio de integrações de mercado em tempo real, inteligência de localização por GPS, comparativos avançados entre veículos da frota e ferramentas de compartilhamento comunitário e patrimonial: monitoramento de preços da ANP correlacionados ao clima, radar de postos econômicos, alertas de preço limite, diretório e mapa de oficinas de confiança, simulador de viabilidade financeira (ex.: Etanol vs Gasolina), prontuário veicular compartilhado por QR Code e resumo mensal por e-mail.

---

## 3. Planejamento de Sprints e User Stories

### Sprint 7 — Preços de Combustível e Mercado (28h)

| US | Título | Esforço | Status | Escopo Planejado |
|---|---|---|---|---|
| **US17** | Monitoramento de Preços ANP e Clima | 12h | **Planejada** ⏳ | Integração periódica com a base de preços médios da ANP e dados climáticos do OpenWeatherMap. |
| **US34** | Postos Mais Baratos por GPS | 8h | **Planejada** ⏳ | Ordenação geolocalizada de postos de combustível a partir da posição atual do motorista. |
| **US35** | Histórico de Preços e Alerta de Preço-Limite | 8h | **Planejada** ⏳ | Notificação push quando um posto no trajeto habitual estiver abaixo do teto estipulado. |

---

### Sprint 8 — Oficinas, Mapa e Simulador (28h)

| US | Título | Esforço | Status | Escopo Planejado |
|---|---|---|---|---|
| **US12** | Diretório de Oficinas Favoritas | 6h | **Planejada** ⏳ | Cadastramento de oficinas mecânicas com contatos rápidos, endereço e avaliação de serviços. |
| **US36** | Mapa de Postos e Oficinas Visitados | 8h | **Planejada** ⏳ | Plotagem em mapa interativo dos locais físicos onde o veículo realizou abastecimentos ou revisões. |
| **US16** | Simulador Financeiro de Viabilidade | 10h | **Planejada** ⏳ | Calculadora de paridade entre combustíveis (regra dos 70% adaptada ao consumo real do carro) e viabilidade de troca. |
| **US31** | Lembretes de Inspeção Visual | 4h | **Planejada** ⏳ | Checklist e lembretes periódicos de conferência rápida (lâmpadas, palhetas, estepe e extintor). |

---

### Sprint 9 — Compartilhamento e Recursos Avançados (36h)

| US | Título | Esforço | Status | Escopo Planejado |
|---|---|---|---|---|
| **US20** | Perfil Compartilhável via QR Code | 6h | **Planejada** ⏳ | Geração de página web estática ou QR Code com histórico de revisões comprovadas para venda do seminovo. |
| **US28** | Comparativos entre Combustíveis e Veículos | 10h | **Planejada** ⏳ | Matriz comparativa de custo por quilômetro real entre os veículos da garagem e tipos de combustível. |
| **US29** | Perfil de Condução e Eficiência | 6h | **Planejada** ⏳ | Classificação do padrão de direção (econômico, agressivo ou moderado) com base na dispersão de consumo. |
| **US32** | Galeria de Fotos do Veículo | 6h | **Planejada** ⏳ | Álbum fotográfico para registro de vistorias, estado da lataria e documentação de sinistros. |
| **US37** | Resumo Mensal Consolidado por E-mail | 8h | **Planejada** ⏳ | Disparo automatizado no primeiro dia do mês com o demonstrativo financeiro e odômetro da frota. |

---

## 4. Próximos Passos para Início da Entrega 3
1. **Configuração de Chaves de API de Produção:** Obtenção de chaves ativas do Google Maps SDK e OpenWeatherMap API.
2. **Definição de Provedor de E-mail Transacional:** Configuração do SendGrid / AWS SES para a rotina de resumo mensal (US37).
3. **Spike de Geolocalização Contínua em Background:** Avaliar impacto no consumo de bateria ao consultar postos econômicos próximos.
