# 📦 Documentação da Entrega 1 (Core) — AutoGest

## 1. Identificação e Metadados
- **Escopo:** 13 User Stories (Sprints 1 a 3)
- **Carga Horária Estimada:** 112h
- **Status Geral:** **100% Concluída** ✅
- **Data de Homologação:** 08/11/2026

---

## 2. Objetivo da Entrega
Disponibilizar a fundação operacional e arquitetural do **AutoGest** em React Native (Android) com sincronização transparente offline-first e API RESTful em Node.js com PostgreSQL, permitindo autenticação segura, gestão de garagem com múltiplos veículos, registro de abastecimentos e hodômetro, despesas operacionais, custos fixos, controle de pneus e fluidos, manutenções preventivas com alertas inteligentes e painel em tempo real.

---

## 3. Histórico de User Stories e Status de Implementação

| US | Título | Esforço | Status | Critério Principal Atendido |
|---|---|---|---|---|
| **US01** | Autenticação Dupla (Firebase e Biometria) | 8h | **Concluída** ✅ | Login seguro e rápido por biometria e e-mail/senha com persistência de sessão. |
| **US02** | Sincronização em Nuvem Offline-First | 12h | **Concluída** ✅ | Fila local persistente `fila_sync` e upserts idempotentes via `PUT /:id`. |
| **US03** | Tutorial Interativo de Primeiro Acesso | 6h | **Concluída** ✅ | Coach marks demonstrando Garagem, FAB de lançamento e métricas. |
| **US04** | Cadastro de Múltiplos Veículos | 8h | **Concluída** ✅ | CRUD de veículos, placa Mercosul/antiga e exclusão lógica em cascata. |
| **US05** | Registro Completo de Abastecimento | 10h | **Concluída** ✅ | Cálculo de consumo médio entre tanques cheios e validação de odômetro. |
| **US06** | Atualização Rápida de Hodômetro | 4h | **Concluída** ✅ | Modal rápido com chips de incremento (+50, +100 km) e reavaliação de alertas. |
| **US09** | Histórico e Registro de Manutenções | 10h | **Concluída** ✅ | Lançamento com peças, oficina, mecânico e anexos via URL assinada GCS. |
| **US10** | Regras de Alerta Preventivo de Revisão | 8h | **Concluída** ✅ | Alertas automáticos por quilometragem e tempo com antecedência configurável. |
| **US11** | Controle de Pneus e Nível de Fluidos | 8h | **Concluída** ✅ | Registro de calibragem (PSI), sulcos (mm) e níveis de óleo e fluidos. |
| **US13** | Dashboard Principal em Tempo Real | 14h | **Concluída** ✅ | Painel executivo com gastos do mês, consumo, custo/km e hodômetro. |
| **US22** | Registro de Despesas Operacionais | 8h | **Concluída** ✅ | Lançamentos de lavagem, seguro, impostos, pedágio e estacionamento. |
| **US23** | Custos Fixos Recorrentes Mensais | 4h | **Concluída** ✅ | Cadastro de mensalidades integradas ao cálculo de custo por quilômetro. |
| **US24** | Indicadores de Uso e Custo/Km | 8h | **Concluída** ✅ | Ritmo de uso (km/dia, km/mês) e custo consolidado por km com fallback para ausência de rodagem. |

---

## 4. Evidências de Testes e Validação
- **Suíte de Testes Automatizados:** 50 suítes de teste de integração e unidade executando `npm test` cobrindo validações de formulário, cálculos de consumo, idempotência de API e sincronização offline.
- **Auditoria de UI:** Capturas de tela e dumps XML arquivados em `docs/ui-review/`.
- **Compilação e Tipagem:** TypeScript Strict com zero erros em `npx tsc --noEmit`.
