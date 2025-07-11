# Daily News

A modern, responsive dashboard built with Next.js 15, React 19, TypeScript, and Tailwind CSS.

## Features

- **Modern Tech Stack**: Next.js 15 with App Router, React 19, TypeScript 5
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **UI Components**: Comprehensive Shadcn/UI component library
- **Authentication**: Supabase Auth with magic link support
- **Database**: Supabase PostgreSQL with Row Level Security
- **Caching**: Upstash Redis for session management
- **Deployment**: Optimized for Vercel with CI/CD pipeline

## Project Structure

```
daily-news/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Dashboard pages
│   ├── auth/             # Authentication pages
│   └── api/              # API routes
├── components/            # React components
│   ├── ui/               # Shadcn/UI components
│   └── daily-news-dashboard.tsx # Main dashboard component
├── lib/                  # Utility functions
└── hooks/               # Custom React hooks
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm (recommended)

### Getting Started

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Run the development server**:

   ```bash
   pnpm dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## 🎨 UI Components

The project includes a comprehensive UI component library built with Shadcn/UI and Radix UI:

- **Form Controls**: Button, Input, Select, Checkbox, etc.
- **Layout**: Card, Sheet, Dialog, Tabs, etc.
- **Data Display**: Table, Badge, Avatar, etc.
- **Navigation**: Breadcrumb, Pagination, etc.
- **Feedback**: Alert, Toast, Progress, etc.

## 📊 Features

- Modern dashboard interface
- Responsive design
- Dark/light theme support
- Comprehensive UI component library
- TypeScript for type safety
- Optimized performance with Next.js

## 🔧 Configuration

- **TypeScript**: Configured with strict mode
- **Tailwind CSS**: Custom configuration with design system
- **ESLint**: Next.js recommended rules
- **PostCSS**: Autoprefixer and Tailwind processing

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a private project. Please follow the established patterns and conventions when making changes.
