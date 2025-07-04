# Yum Dashboard

A modern Next.js dashboard application built with React 19, TypeScript, and Tailwind CSS.

## 🚀 Tech Stack

- **Framework**: Next.js 15.2.4 with App Router
- **Frontend**: React 19, TypeScript 5
- **Styling**: Tailwind CSS 3.4.17
- **UI Components**: Shadcn/UI + Radix UI
- **Icons**: Lucide React
- **Package Manager**: pnpm

## 📁 Project Structure

```
yum-dashboard/
├── app/                    # Next.js App Router pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # React components
│   ├── ui/               # Shadcn/UI component library (43 components)
│   ├── icons.tsx         # Custom icons
│   ├── theme-provider.tsx # Theme management
│   └── yum-dashboard.tsx # Main dashboard component
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── public/               # Static assets
├── styles/               # Additional styles
└── scripts/              # Build scripts and documentation
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
