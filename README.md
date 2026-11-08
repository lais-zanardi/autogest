# AutoGest

Aplicativo Android (React Native) e API (Node.js/PostgreSQL) para gestão inteligente de veículos, abastecimentos, despesas e manutenções com arquitetura offline-first.

---

## Status das Entregas

| Entrega | Escopo | Horas | Status |
|---|---|---|---|
| **Entrega 1 (Core)** | Autenticação, Garagem, Abastecimentos, Hodômetro, Manutenções, Alertas, Despesas, Custos Fixos, Pneus/Fluidos, Dashboard e Sync Offline | 112h | **Concluída** (100%) |
| **Entrega 2 (Financeiro e Dados)** | Teto Orçamentário, Trilha de Auditoria, Backup/Restauração Criptografados (.agbak), Gráficos, Modo Viagem, Metas de Eficiência, FIPE, Busca e Exportação PDF/CSV | 112h | **Concluída** (100%) |
| **Entrega 3 (Integrações e Extras)** | Preços ANP e Clima, Postos via GPS, Histórico/Alerta de Preço, Oficinas, Mapa, Simulador e Compartilhamento | 92h | **Planejada** |

---

## Estrutura do Projeto

```text
autogest/
├── apps/
│   ├── mobile/         # Frontend React Native (Android) Offline-First
│   └── api/            # Backend RESTful (Node.js, Express, PostgreSQL)
├── packages/
│   ├── shared-types/   # Tipagens e DTOs compartilhados (TypeScript)
│   └── eslint-config/  # Configuração de linting
├── docs/               # Documentação técnica detalhada
│   ├── product_backlog.md  # Backlog do produto organizado por épicos
│   ├── banco_de_dados.md   # Diagrama ER e dicionário de dados
│   └── entregas/           # Detalhamento e status das entregas (1, 2 e 3)
└── README.md
```

---

## Como Executar

### Pré-requisitos
- Node.js >= 18 e npm >= 9
- PostgreSQL >= 15
- Android SDK configurado

### Instalação e Testes
```bash
# Instalar dependências
npm install

# Executar suíte de testes (336 testes)
npm test

# Validação de tipos TypeScript
npx tsc --noEmit -p apps/mobile/tsconfig.json
npx tsc --noEmit -p apps/api/tsconfig.json
```

### Inicialização
```bash
# Iniciar API
npm run dev:api

# Iniciar Mobile (Metro Bundler)
npm run dev:mobile
```

---

## Documentação

- [Product Backlog por Épicos](docs/product_backlog.md)
- [Diagrama ER e Dicionário de Dados](docs/banco_de_dados.md)
- [Entrega 1 (Core)](docs/entregas/entrega-1.md)
- [Entrega 2 (Financeiro e Dados)](docs/entregas/entrega-2.md)
- [Entrega 3 (Integrações e Extras)](docs/entregas/entrega-3.md)

---

## Licença

MIT
