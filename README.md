# OmniFlow / Perfox Enterprise Platform — Frontend UI

A modern, high-performance web dashboard built with **React 18**, **TypeScript**, **Vite**, and **Tailwind CSS**. It serves as the primary administrative and operational portal for the OmniFlow / Perfox Enterprise Platform, featuring catalog management, AI conversation handling, dynamic business customization, live voice operator calling, knowledge base document indexing, appointment scheduling, and team management.

---

## 🚀 Features

- **🔐 Authentication & Session Management**:
  - Secure JWT authentication with persistent "Remember Me" sessions.
  - Role-based route guards and automatic session validation.
  
- **📊 Overview Dashboard**:
  - Key performance metrics, conversation throughput, active appointments, and catalog summaries.
  - Quick action shortcuts and recent operational activity.

- **💬 AI Conversations & Live Operator**:
  - Multi-channel thread viewer with AI dialogue tracking.
  - Interactive voice dialer and call panel powered by `@perfox/operator-react`.
  - Operator takeover and real-time conversation analysis.

- **📦 Catalog & Category Management**:
  - Rich product management with multi-image previews, variants, pricing, stock levels, and tags.
  - Category hierarchy management with dynamic sorting and item counts.

- **📚 Knowledge Base & Document Ingestion**:
  - Centralized repository for company resources and FAQ documents.
  - Client-side document parsing supporting **PDF** (`pdfjs-dist`) and **Word (.docx)** (`mammoth`) formats for AI vector ingestion.

- **📅 Scheduling & Appointments**:
  - Interactive calendar views for bookings, consultations, and staff allocations.
  - Status tracking (pending, confirmed, completed, cancelled).

- **👥 Team Management**:
  - Seat-enforced team administration (`TEAM_SEAT_LIMIT`).
  - Member role assignments, invitation workflows, and access controls.

- **⚙️ Dynamic Business Settings (White-Labeling)**:
  - Custom module naming (singular and plural customization for all navigation items).
  - Business profile, contact info, and branding management.

- **🛠️ Developer Portal & Integration**:
  - Perfox Operator widget embed script generator.
  - API endpoint documentation, token management, and MCP server connectivity.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React 18](https://react.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool** | [Vite 5](https://vitejs.dev/) |
| **Routing** | [React Router v7](https://reactrouter.com/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + PostCSS + `clsx` + `tailwind-merge` |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Document Parsers** | [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`), [Mammoth](https://github.com/mwilliamson/mammoth.js) (DOCX) |
| **Voice / Operator SDK** | `@perfox/operator-react` |

---

## 📂 Project Structure

```text
UI/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── call/           # Voice dialer & call panels
│   │   ├── common/         # Buttons, Cards, Modals, Tables, Badges, etc.
│   │   ├── developer/      # Widget embed cards & developer tools
│   │   └── layout/         # Header, Sidebar, and AppLayout shell
│   ├── context/            # React Context providers (Auth, Operator, SiteSettings)
│   ├── data/               # Mock data & fallback presets
│   ├── hooks/              # Custom React hooks (useAuth, useDialOut, etc.)
│   ├── pages/              # Route views
│   │   ├── AddEditProductPage.tsx
│   │   ├── CategoriesPage.tsx
│   │   ├── ConversationsPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── DeveloperPage.tsx
│   │   ├── KnowledgeBasePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── ProductDetailsPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── SchedulePage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── SignupPage.tsx
│   │   └── TeamsPage.tsx
│   ├── services/           # REST API client services (Auth, Products, Knowledge, etc.)
│   ├── types/              # TypeScript interfaces and data models
│   ├── utils/              # Helper utilities and formatters
│   ├── App.tsx             # Main routing configuration
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global Tailwind and font styles
├── vendor/                 # Local vendor package archives
├── .env.example            # Environment template
├── tailwind.config.js      # Tailwind CSS design system config
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build and plugin setup
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root of the `UI` directory based on `.env.example`:

```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL pointing to the backend REST API | `http://localhost:5050/api/v1` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Backend Service**: Ensure the Express backend is running (typically at `http://localhost:5050`)

### Installation

1. Navigate to the UI project directory:
   ```bash
   cd "d:/Skillmine_Projects/Enterprise Platform/UI"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your `.env` file:
   ```env
   VITE_API_URL=http://localhost:5050/api/v1
   ```

### Development Server

Start the local Vite development server:

```bash
npm run dev
```

The application will be accessible at: `http://localhost:5173` (or the port specified by Vite).

---

## 🏗️ Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | Compiles TypeScript and creates an optimized production bundle in `/dist`. |
| `npm run preview` | Runs a local static server to preview the production `/dist` build. |

---

## 🔗 Backend Connectivity

The UI interacts with the backend Express API via standard REST endpoints configured in [client.ts](file:///d:/Skillmine_Projects/Enterprise%20Platform/UI/src/services/client.ts). 

- **Auth Token Handling**: Automatically injects JWT Bearer tokens from `localStorage` (`session_token`) on all authenticated requests.
- **Auto-Logout on 401**: Automatically catches expired tokens and triggers redirection to the login view.
- **Dynamic Module Labels**: Fetches customizable section names at runtime via `/api/v1/settings/labels`.
