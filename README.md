# 🚗 AutoGest - Gestão Inteligente de Veículos e Abastecimentos

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)](https://nodejs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.72%2B-61dafb)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-336791)](https://www.postgresql.org/)

**AutoGest** é um sistema completo para controle de custos, economia de combustível, histórico de manutenção e autonomia de veículos. Desenvolvido como um monorepo modular em TypeScript, ele conta com um aplicativo mobile (React Native) com modo offline e sincronização inteligente, integrado a uma API RESTful em Node.js com PostgreSQL, suporte a OCR de cupons fiscais e APIs externas de cotação de mercado (FIPE, ANP e OpenWeatherMap).

---

## 📐 Estrutura do Repositório

```text
autogest/
├── apps/
│   ├── mobile/                       # Frontend Mobile (React Native + TypeScript)
│   │   ├── android/                  # Arquivos nativos de compilação exclusiva para Android
│   │   ├── src/
│   │   │   ├── components/           # Componentes de UI (Bottom Bar, FAB centralizado, modais)
│   │   │   ├── screens/              # Telas (Dashboard, Formulários, Relatórios, Garagem)
│   │   │   ├── services/             # Comunicação com a API Node.js e APIs nativas (GPS, Câmera/Galeria)
│   │   │   ├── store/                # Gerenciamento de estado global e modo offline
│   │   │   └── utils/                # Máscaras, formatação de dados numéricos (decimais)
│   │   └── package.json              # Dependências React Native
│   │
│   └── api/                          # Backend em Node.js (API RESTful + Express)
│       ├── src/
│       │   ├── controllers/          # Controladores dos endpoints (ex: /api/v1/vehicles)
│       │   ├── models/               # Modelos e interação com o PostgreSQL
│       │   ├── routes/               # Definição das rotas (GET, POST, etc.)
│       │   ├── services/             # Lógica de negócio, OCR, integrações (ANP, OWM, FIPE, Firebase Auth)
│       │   └── utils/                # Cálculos de consumo médio, autonomia e relatórios
│       ├── database/                 # Scripts SQL, migrations e schemas
│       └── package.json              # Dependências Node.js
│
├── packages/                         # Bibliotecas e códigos compartilhados entre front e back
│   ├── shared-types/                 # Tipagens (TypeScript), interfaces e DTOs
│   └── eslint-config/                # Configurações globais de linting e padronização
│
├── docs/                             # Documentação do Projeto
│   ├── product_backlog.md            # Backlog com as Histórias de Usuário (US-01 a US-09)
│   ├── arquitetura.md                # Diagramas Mermaid da arquitetura e especificações
│   └── banco_de_dados.md             # Diagramas ER e dicionário de dados do PostgreSQL
│
├── package.json                      # Configuração raiz do monorepo
└── README.md                         # Visão geral do repositório AutoGest
```

---

## ⚡ Principais Funcionalidades

- **📱 App Mobile (React Native)**
  - **Garagem Digital:** Cadastro e acompanhamento de múltiplos veículos.
  - **Lançamento Rápido:** FAB centralizado na Bottom Bar para inserção ágil de abastecimentos.
  - **Scanner de Cupom Fiscal (OCR):** Leitura da nota fiscal via foto da câmera ou arquivo da galeria.
  - **Suporte Offline First:** Armazenamento local temporário de lançamentos e sincronização automática ao reestabelecer conexão.
  - **Relatórios Visuais:** Gráficos interativos de consumo médio (km/L), custo por quilômetro e gastos por tipo de combustível.

- **🚀 Backend RESTful (Node.js + PostgreSQL)**
  - **Autenticação:** Validação de tokens JWT via Firebase Auth.
  - **Cálculo Automático de Indicadores:** Autonomia estimada, consumo médio entre abastecimentos com tanque cheio.
  - **Integração FIPE:** Consulta de valor de mercado atualizado para veículos cadastrados.
  - **Integração ANP:** Monitoramento e comparação do preço pago x média regional da ANP.
  - **Integração Climatológica (OpenWeatherMap):** Registro de temperatura e clima no momento e local do abastecimento.

---

## 🛠️ Tecnologias Utilizadas

- **Monorepo:** npm Workspaces
- **Linguagem:** TypeScript
- **Backend:** Node.js, Express, PostgreSQL (`pg`)
- **Frontend Mobile:** React Native, Zustand / Redux Toolkit, AsyncStorage, Axios
- **Qualidade & Padrões:** ESLint, Prettier
- **Documentação:** Markdown com Diagramas Mermaid

---

## 🚦 Como Executar o Projeto

### Pré-requisitos

- **Node.js** `>= 18.x`
- **npm** `>= 9.x`
- **PostgreSQL** `>= 15` (ou container Docker)
- **Android Studio / SDK Android** (para emulador ou dispositivo físico)

### 1. Clonar o Repositório e Instalar Dependências

```bash
git clone https://github.com/lais-zanardi/autogest.git
cd autogest
npm install
```

### 2. Configurar o Banco de Dados

Crie um banco de dados PostgreSQL chamado `autogest` e execute as migrations:

```bash
cd apps/api
# Execute os scripts localizados em apps/api/database/schema.sql
```

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` em `apps/api/`:

```env
PORT=3000
DATABASE_URL=postgres://usuario:senha@localhost:5432/autogest
FIREBASE_PROJECT_ID=seu-firebase-project-id
OWM_API_KEY=sua_chave_open_weather_map
FIPE_API_URL=https://parallelum.com.br/fipe/api/v1
```

### 4. Executar os Serviços

- **Iniciar Backend (API):**
  ```bash
  npm run dev:api
  ```
- **Iniciar Mobile (React Native):**
  ```bash
  npm run dev:mobile
  ```

---

## 📚 Documentação Adicional

- 📄 [Backlog do Produto e User Stories](docs/product_backlog.md)
- 🏗️ [Arquitetura do Sistema e Fluxos Diagramados](docs/arquitetura.md)
- 🗄️ [Modelo de Banco de Dados e Dicionário de Dados](docs/banco_de_dados.md)

---

## 📝 Licença

Este projeto está sob a licença [MIT](LICENSE).
