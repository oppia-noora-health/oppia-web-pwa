# Noora Health Academy PWA

<div align="center">

**Enterprise-Grade Offline-First Progressive Web App for Healthcare Learning**

[Features](#features) • [Installation](#installation) • [Architecture](#architecture-overview) • [API Documentation](#api-routes--backend) • [Deployment](#deployment)

</div>

---

## Overview

Noora Health Academy is an enterprise-grade Progressive Web App (PWA) that delivers healthcare education through **OppiaMobile Moodle courses**. Built for healthcare workers, patients, and caregivers in low-connectivity environments across India, Indonesia, and Bangladesh, the platform enables **full offline access** to multimedia learning content including videos, quizzes, and interactive modules.

### Core Technology Foundation

- **Next.js 15.1.0** with App Router and React 19 Server Components
- **IndexedDB Storage** (100MB-2GB capacity) for complete course packages
- **Custom Service Worker** (v7) with network-first API + cache-first asset strategies
- **Streaming Downloads** with chunked ReadableStream processing
- **Zustand State Management** with selective localStorage persistence
- **Moodle .mbz Package** extraction and XML parsing (JSZip)

### Key Objectives

- **Offline-First Architecture**: Download complete Moodle course packages (.mbz format) with all HTML, CSS, JavaScript, videos, and assets stored in IndexedDB for 100% offline functionality
- **Healthcare Accessibility**: Deliver medical training to remote areas with unreliable internet connectivity through intelligent caching and background sync
- **Gamified Learning Engine**: Built-in points system (50 points per activity), badge milestones, and real-time leaderboards with server synchronization
- **Multi-Language Support**: UI translations for English, Hindi, Kannada, Telugu with dynamic content localization
- **PWA Installation**: Add-to-homescreen capability with standalone display mode, splash screens, and native OS integration

### Target Audience & Scale

- **50,000+ healthcare workers** across India's public healthcare system
- **Community Health Centers** with limited bandwidth (2G/3G networks)
- **Patients and caregivers** requiring post-discharge medical education
- **Training coordinators** managing multi-facility healthcare programs
- **Medical NGOs** (Noora Health, PATH, JSI) deploying evidence-based interventions

### Technical Achievements

- **Zero network dependency** for course playback after download
- **Streaming video** with IndexedDB blob storage (handles 100MB+ files)
- **Script execution engine** for interactive Moodle activities (replaces React dangerouslySetInnerHTML limitations)
- **Dual-mode content rendering**: Seamless switching between online/offline with identical UX
- **Atomic activity tracking** with optimistic UI updates and background synchronization

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Scripts](#scripts)
- [Routing](#routing)
- [API Routes & Backend](#api-routes--backend)
- [Authentication](#authentication)
- [Storage & Database](#storage--database)
- [Styling System](#styling-system)
- [State Management](#state-management)
- [Course Download System](#course-download-system)
- [Media Handling](#media-handling)
- [Error Handling](#error-handling)
- [PWA Features](#pwa-features)
- [Performance Optimization](#performance-optimization)
- [Security Practices](#security-practices)
- [Deployment](#deployment)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Team & Support](#team--support)

---

## Features

### Core Functionality

- **Full Offline Course Access**: Download Moodle course packages (.mbz) with all assets
- **Dual-Mode Content Delivery**: Seamless switching between online/offline modes
- **Video Streaming & Download**: Progressive media download with resume capability
- **Interactive Quizzes**: Multiple question types with immediate feedback
- **Course Progress Tracking**: Persistent activity completion state
- **Gamification System**: Points, badges, and competitive leaderboards
- **Tag-Based Course Discovery**: Organize courses by medical specialty/topic
- **Multi-Language UI**: English, Hindi, Kannada, Telugu support

### PWA Capabilities

- **App Installation**: Add to Home Screen on Android/iOS
- **Offline Page**: Custom offline experience with cached content access
- **Background Sync**: Update course content when connectivity restores
- **Push Notifications**: Course updates and achievement alerts (planned)
- **Analytics Tracking**: Countly integration for user behavior insights

### User Experience

- **Responsive Design**: Mobile-first with tablet/desktop optimization
- **Dark Mode Support**: System-aware theme switching
- **Accessibility**: WCAG AA compliant with keyboard navigation
- **Interactive Onboarding**: Driver.js guided tours for new users
- **Context Menu Actions**: Long-press shortcuts for power users

---

## Tech Stack

### Frontend Core

| Technology       | Version | Purpose                         |
| ---------------- | ------- | ------------------------------- |
| **Next.js**      | 15.1.0  | React framework with App Router |
| **React**        | 19.2.0  | UI library with React Compiler  |
| **TypeScript**   | 5.x     | Type-safe development           |
| **Tailwind CSS** | 4.x     | Utility-first styling           |
| **Radix UI**     | 2.x     | Accessible component primitives |

### State & Storage

| Tool                | Purpose                                      |
| ------------------- | -------------------------------------------- |
| **Zustand**         | Global state management with persistence     |
| **IndexedDB (idb)** | Client-side course storage (100MB+ capacity) |
| **localStorage**    | Settings and auth token cache                |

### PWA & Offline

| Tool          | Purpose                                         |
| ------------- | ----------------------------------------------- |
| **next-pwa**  | Service worker generation                       |
| **Custom SW** | Network-first API + cache-first assets strategy |
| **JSZip**     | Moodle course package extraction                |

### UI & Animation

| Library           | Purpose                                 |
| ----------------- | --------------------------------------- |
| **Framer Motion** | Page transitions and micro-interactions |
| **Driver.js**     | Feature tours and onboarding            |
| **Lucide React**  | Icon system                             |
| **Recharts**      | Analytics charts and visualizations     |

### Utilities

| Tool          | Purpose                                   |
| ------------- | ----------------------------------------- |
| **Axios**     | HTTP client with interceptors             |
| **Crypto-js** | Encrypted localStorage for sensitive data |
| **js-cookie** | Cookie management                         |
| **uuid**      | Unique identifier generation              |
| **Countly**   | Analytics and user tracking               |

---

## Architecture Overview

### Rendering Strategy

**Client-Side Rendering (CSR) with Offline Support**

- All pages use `"use client"` directive (no SSR)
- Auth-protected routes require client-side session checks
- Service worker handles offline page rendering
- Static assets pre-cached for instant navigation

**Why CSR-only?**

- Authentication state managed client-side (Zustand + localStorage)
- Offline-first requires browser APIs (IndexedDB, Service Workers)
- PWA features incompatible with SSR hydration patterns
- Faster deployment without server infrastructure

### App Router Architecture

```
src/app/
├── layout.tsx              # Root layout with providers
├── page.tsx                # Landing/home page
├── login/page.tsx          # OTP-based authentication
├── course-management/      # Tag-based course catalog
│   ├── page.tsx           # Tag listing
│   └── [tagId]/page.tsx   # Courses filtered by tag
├── course/[id]/
│   ├── view/page.tsx      # Dual-mode course viewer
│   └── activity/[activityId]/page.tsx
├── points/page.tsx         # Gamification dashboard
├── profile/page.tsx        # User settings
└── offline/page.tsx        # Offline fallback page
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interaction                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              React Components (Client-Side)                  │
│  • Authentication check via useAuthStore                     │
│  • UI state management via Zustand stores                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
         ┌─────────────┴─────────────┐
         ↓                           ↓
┌──────────────────┐      ┌──────────────────────┐
│  Online Mode     │      │   Offline Mode       │
│  • API fetch     │      │   • IndexedDB read   │
│  • Zustand cache │      │   • localStorage     │
│  • localStorage  │      │   • Service Worker   │
└────────┬─────────┘      └──────────┬───────────┘
         │                           │
         └─────────────┬─────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  Storage Persistence                         │
│  1. IndexedDB (courses, media, 100MB+)                      │
│  2. Zustand persist (auth, settings)                        │
│  3. localStorage (fallback, preferences)                     │
└─────────────────────────────────────────────────────────────┘
```

### Course Loading Priority

```typescript
// Priority chain for course content resolution
1. IndexedDB (downloaded courses)
   ↓ [if not found]
2. Zustand in-memory cache (recently viewed)
   ↓ [if not found]
3. localStorage (legacy backward compatibility)
   ↓ [if not found]
4. API fetch (new courses from server)
```

### Service Worker Strategy

```javascript
// Network patterns by resource type
API routes (/api/*):        Network-first (fallback to cache)
Static assets (/_next/*):   Cache-first (stale-while-revalidate)
Media files (/media/*):     Cache-first (long-term storage)
HTML pages:                 Network-first (offline page fallback)
```

---

## Project Structure

```
noora-health/
├── .github/
│   └── copilot-instructions.md    # AI development guidelines
├── amplify.yml                    # AWS Amplify deployment config
├── components.json                # shadcn/ui configuration
├── next.config.js                 # Next.js config + API rewrites
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
│
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw-custom.js               # Custom service worker
│   ├── offline.html               # Offline fallback page
│   └── [logo|audio|home|...]/     # Static assets
│
├── scripts/
│   └── generate-icons.js          # PWA icon generator
│
└── src/
    ├── app/                       # Next.js App Router pages
    │   ├── layout.tsx             # Root layout with providers
    │   ├── page.tsx               # Home page
    │   ├── globals.css            # Global Tailwind styles
    │   ├── login/                 # Authentication flow
    │   ├── course/                # Course viewer routes
    │   ├── course-management/     # Course catalog
    │   ├── points/                # Gamification
    │   ├── profile/               # User settings
    │   ├── scoreboard/            # Leaderboards
    │   └── offline/               # Offline page
    │
    ├── components/                # React components
    │   ├── ui/                    # Radix UI primitives (shadcn)
    │   ├── course/                # Course-specific components
    │   │   ├── CourseCard.tsx
    │   │   ├── ModuleList.tsx
    │   │   └── ActivityRenderer.tsx
    │   ├── HtmlContentRenderer.tsx  # Script execution engine
    │   ├── QuizRenderer.tsx       # Interactive quiz UI
    │   ├── CourseDownloadButton.tsx # Download management
    │   ├── PWAInstallPrompt.tsx   # Install banner
    │   └── PWAStatus.tsx          # Network status indicator
    │
    ├── hooks/                     # Custom React hooks (12 total)
    │   ├── useAuth.ts             # Authentication state
    │   ├── useCourseData.ts       # Course content loading
    │   ├── useCourseDownload.ts   # Download orchestration
    │   ├── useActivityNavigation.ts # Module navigation
    │   └── usePWA.ts              # PWA status management
    │
    ├── services/                  # API clients and business logic
    │   ├── authService.ts         # Login/logout
    │   ├── courseService.ts       # Course CRUD operations
    │   ├── courseDownloadService.ts # Download orchestration
    │   ├── mediaDownloadService.ts  # Video/audio handling
    │   ├── pointsService.ts       # Gamification API
    │   └── analyticsService.ts    # Countly integration
    │
    ├── store/                     # Zustand state management
    │   ├── useStore.ts            # Auth + Course store
    │   ├── useMenuStore.ts        # UI state (sidebar)
    │   └── useDownloadProgressStore.ts # Download tracking
    │
    ├── utils/                     # Utility functions
    │   ├── courseStorageIDB.ts    # IndexedDB operations
    │   ├── courseLoaderIDB.ts     # Offline course loading
    │   ├── htmlProcessor.ts       # CSS/JS inlining
    │   ├── apiClient.ts           # Axios instance
    │   └── apiPaths.ts            # API endpoint constants
    │
    ├── types/                     # TypeScript interfaces
    │   ├── course.ts              # Course data models
    │   ├── activity.ts            # Activity schemas
    │   ├── quiz.ts                # Quiz question types
    │   └── tag.ts                 # Tag taxonomy
    │
    └── config/                    # Configuration files
        ├── constants.ts           # App constants
        ├── tourSteps.ts           # Onboarding tours
        └── pageTours.ts           # Page-specific guides
```

### Key Directory Responsibilities

| Directory     | Purpose                             |
| ------------- | ----------------------------------- |
| `app/`        | Next.js pages and routing           |
| `components/` | Reusable React components           |
| `hooks/`      | Custom React hooks for shared logic |
| `services/`   | API integration and business logic  |
| `store/`      | Global state management (Zustand)   |
| `utils/`      | Pure functions and utilities        |
| `types/`      | TypeScript type definitions         |
| `config/`     | Application configuration           |

---

## Environment Variables

Create a `.env.local` file in the project root:

| Variable                      | Description              | Example                                           | Required |
| ----------------------------- | ------------------------ | ------------------------------------------------- | -------- |
| `NEXT_PUBLIC_API_URL`         | OppiaMobile API base URL | `https://academy.noorahealth.org/api/v2/` | Yes      |
| `NEXT_PUBLIC_MEDIA_URL`       | Media assets base URL    | `https://academy.noorahealth.org/media/`  | No       |
| `NEXT_PUBLIC_COUNTLY_APP_KEY` | Countly analytics key    | `abc123...`                                       | No       |
| `NEXT_PUBLIC_COUNTLY_URL`     | Countly server URL       | `https://analytics.example.com`                   | No       |
| `NODE_ENV`                    | Environment mode         | `development` / `production`                      | Yes      |

**Note**: API requests are proxied through Next.js rewrites (see `next.config.js`), so the frontend always calls `/api/*` relative paths.

### Production Environment

For production deployments, set these in your hosting provider:

```bash
NEXT_PUBLIC_API_URL=https://production.academy.noorahealth.org/api/v2/
NODE_ENV=production
```

---

## Installation

### Prerequisites

- **Node.js**: v20.x or higher ([Download](https://nodejs.org/))
- **npm**: v10.x or higher (bundled with Node.js)
- **Git**: For cloning the repository

### Clone Repository

```bash
git clone https://github.com/noora-health/academy-pwa.git
cd academy-pwa
```

### Install Dependencies

```bash
npm install
```

This installs all dependencies from `package.json` including:

- Next.js 15.1.0 framework
- React 19.2.0 with experimental compiler
- Zustand 5.0.8 for state management
- IndexedDB (idb) for offline storage
- Radix UI components
- Tailwind CSS 4.x

### SSL Certificate (Development)

For testing PWA features (Service Workers require HTTPS):

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

Then update `package.json` dev script:

```json
{
  "scripts": {
    "dev:https": "next dev --experimental-https"
  }
}
```

---

## Running the Project

### Development Mode

```bash
npm run dev
```

- Opens at `http://localhost:3000`
- Hot reload enabled
- React Strict Mode disabled (for better performance)
- Console logs enabled

### Production Build

```bash
npm run build
```

Optimizations applied:

- React Compiler optimizations
- Console.log removal
- Minification and tree-shaking
- Service worker generation
- Static asset optimization

### Start Production Server

```bash
npm run start
```

Serves the optimized production build at `http://localhost:3000`.

### HTTPS Development (PWA Testing)

```bash
# Requires certificate generation (see Installation)
npm run dev:https
```

Access at `https://localhost:3000` to test:

- Service Worker registration
- PWA installation prompts
- Offline functionality
- Push notifications

---

## Scripts

| Command                  | Description              | Use Case                          |
| ------------------------ | ------------------------ | --------------------------------- |
| `npm run dev`            | Start development server | Local development with hot reload |
| `npm run build`          | Create production build  | Pre-deployment build verification |
| `npm start`              | Serve production build   | Test production bundle locally    |
| `npm run lint`           | Run ESLint checks        | Code quality validation           |
| `npm run generate-icons` | Generate PWA icons       | Create all icon sizes from source |
| `npm run pwa:check`      | Lighthouse PWA audit     | Verify PWA compliance score       |

### Custom Script Details

#### PWA Icon Generation

```bash
npm run generate-icons
```

Generates all required PWA icon sizes (72x72 to 512x512) from a source image:

- Input: `public/logo/source-icon.png`
- Output: `public/logo/icon-{size}.png`
- Maskable icons for adaptive Android icons

#### Lighthouse PWA Audit

```bash
npm run pwa:check
```

Runs Google Lighthouse audit and opens report:

- PWA score
- Performance metrics
- Accessibility compliance
- Best practices validation
- SEO analysis

---

## Routing

### App Router Structure

**All routes use the App Router** (`src/app/`) with client-side rendering.

| Route                                | File Path                                        | Description                                          |
| ------------------------------------ | ------------------------------------------------ | ---------------------------------------------------- |
| `/`                                  | `app/page.tsx`                                   | Landing page (redirects to login if unauthenticated) |
| `/login`                             | `app/login/page.tsx`                             | OTP-based phone authentication                       |
| `/verify-otp`                        | `app/verify-otp/page.tsx`                        | OTP code verification                                |
| `/course-management`                 | `app/course-management/page.tsx`                 | Tag-based course catalog                             |
| `/course-management/[tagId]`         | `app/course-management/[tagId]/page.tsx`         | Courses filtered by tag                              |
| `/course/[id]`                       | `app/course/[id]/page.tsx`                       | Course overview                                      |
| `/course/[id]/view`                  | `app/course/[id]/view/page.tsx`                  | Course content viewer (dual-mode)                    |
| `/course/[id]/activity/[activityId]` | `app/course/[id]/activity/[activityId]/page.tsx` | Activity detail page                                 |
| `/points`                            | `app/points/page.tsx`                            | Gamification dashboard                               |
| `/scoreboard`                        | `app/scoreboard/page.tsx`                        | User leaderboards                                    |
| `/profile`                           | `app/profile/page.tsx`                           | User settings and profile                            |
| `/offline`                           | `app/offline/page.tsx`                           | Offline fallback page                                |

### Dynamic Routes

```typescript
// Course by ID
/course/123 /
  view /
  // Params: { id: "123" }

  // Tag-filtered courses
  course -
  management /
    5 /
    // Params: { tagId: "5" }

    // Activity within course
    course /
    123 /
    activity /
    45;
// Params: { id: "123", activityId: "45" }
```

### Protected Routes

All routes except `/login` and `/verify-otp` require authentication. Protection implemented in `AuthProvider` component:

```typescript
// src/components/AuthProvider.tsx
if (!user && !isLoginPage) {
  router.push("/login");
}
```

### Navigation Patterns

**Programmatic Navigation:**

```typescript
import { useRouter } from "next/navigation";

const router = useRouter();
router.push("/course/123/view");
router.back();
```

**Link Component:**

```typescript
import Link from 'next/link';

<Link href="/course-management">Browse Courses</Link>
```

---

## API Routes & Backend

### Base URL

All API requests proxy through Next.js rewrites to staging environment:

```
Frontend: /api/course/123
Backend:  https://academy.noorahealth.org/api/v2/course/123
```

Configured in `next.config.js`:

```javascript
async rewrites() {
  return [
    {
      source: "/api/:path*",
      destination: "https://academy.noorahealth.org/api/v2/:path*",
    },
  ];
}
```

### API Endpoints

#### Authentication

```http
POST /api/v2/user/
Content-Type: application/json

{
  "username": "+919876543210",
  "password": "api_key_here"
}

Response:
{
  "api_key": "abc123...",
  "username": "+919876543210",
  "points": 1234,
  "badges": 5,
  "course_points": [...]
}
```

#### Courses

```http
# List all courses
GET /api/v2/course/

# Get single course
GET /api/v2/course/{shortname}/

# Course structure (Moodle .mbz download)
GET /api/v2/course/{shortname}/structure/
```

#### Tags

```http
# List all tags with course counts
GET /api/v2/tag/

Response:
[
  {
    "id": 1,
    "name": "Maternal Health",
    "count": 12,
    "course_statuses": {
      "m1-maternal-health": "live",
      "m2-anc-training": "draft"
    }
  }
]
```

#### Points & Gamification

```http
# Award points for activity completion
POST /api/v2/points/

{
  "courseId": "123",
  "activityId": "45",
  "points": 50
}

# Get leaderboard
GET /api/v2/scoreboard/
```

### API Client Configuration

All requests use authenticated Axios client (`src/utils/apiClient.ts`):

```typescript
import apiClient from "@/utils/apiClient";

// Automatically includes api_key header
const response = await apiClient.get("/course/");
```

### Error Handling

```typescript
// Standard error response
{
  "error": "Not found",
  "status": 404,
  "message": "Course does not exist"
}
```

---

## Authentication

### Strategy: Username + API Key

**Stateless authentication** using phone number and API key:

1. User enters phone number (e.g., `+919876543210`)
2. Backend sends OTP via SMS
3. User enters OTP code
4. Backend validates and returns `api_key`
5. Client stores `api_key` in Zustand + encrypted localStorage
6. All API requests include `Authorization` header

### Authentication Flow

```typescript
// 1. Login with phone number
const response = await authService.loginWithOTP("+919876543210", otpCode);

// 2. Store credentials
useAuthStore.getState().setUser({
  username: response.username,
  apiKey: response.api_key,
  ...response,
});

// 3. Auto-inject in API calls
apiClient.interceptors.request.use((config) => {
  const apiKey = useAuthStore.getState().user?.apiKey;
  if (apiKey) {
    config.headers.Authorization = `ApiKey ${apiKey}`;
  }
  return config;
});
```

### Session Persistence

- **Zustand persist**: Saves only `username` + `apiKey` to localStorage
- **Full user data**: Fetched from API on app load (not persisted)
- **Session expiry**: No automatic expiry (API key remains valid until revoked)

### Logout

```typescript
const logout = () => {
  useAuthStore.getState().logout(); // Clears Zustand store
  localStorage.clear(); // Removes all local data
  router.push("/login");
};
```

### Security Considerations

- API keys encrypted in localStorage using `crypto-js`
- No sensitive data in URL parameters
- HTTPS required for production
- API keys rotatable server-side
- No password storage (OTP-only authentication)

---

## Storage & Database

### Architecture: Client-Side Only

No traditional database server. All data stored in browser:

```
┌─────────────────────────────────────────────────────┐
│                   Browser Storage                    │
├─────────────────────────────────────────────────────┤
│  IndexedDB (Primary)                                │
│  • Courses (structures, versions)                   │
│  • Media files (videos, audio as Uint8Array)        │
│  • Assets (CSS, JS, images)                         │
│  • Capacity: 100MB - 2GB (browser-dependent)        │
├─────────────────────────────────────────────────────┤
│  localStorage (Secondary)                           │
│  • Auth credentials (encrypted)                     │
│  • User preferences                                 │
│  • Zustand persist data                             │
│  • Capacity: 5-10MB                                 │
├─────────────────────────────────────────────────────┤
│  Zustand (Memory)                                   │
│  • In-memory course cache                           │
│  • UI state (sidebar, modals)                       │
│  • Download progress tracking                       │
└─────────────────────────────────────────────────────┘
```

### IndexedDB Schema

**Database Name**: `NooraHealthCourses`  
**Version**: 1  
**Library**: `idb` v8.0.3 (Promise-based IndexedDB wrapper)

**Object Stores**:

```typescript
// Store: "courses" (keyPath: "courseId")
interface CourseStore {
  courseId: string; // Primary key (e.g., "123")
  shortname: string; // Course identifier (e.g., "m1-maternal-health")
  version: string | number; // Version ID from Moodle (e.g., "20260122172021")
  downloadedAt: string; // ISO 8601 timestamp
  structure: CourseStructure; // Parsed module.xml data
  isDownloaded: boolean; // Distinguishes downloaded vs streaming cache
}

// Store: "files" (no keyPath - uses out-of-line keys)
interface FilesStore {
  key: string; // Format: "<courseId>_<filepath>"
  value: {
    courseId: string;
    filePath: string; // Relative path (e.g., "section0/page.html")
    content: Uint8Array; // Binary file data
    mimeType: string; // MIME type (e.g., "text/html", "video/mp4")
  };
}
```

**Implementation Details** (`src/utils/courseStorageIDB.ts`):

```typescript
import { openDB, DBSchema, IDBPDatabase } from "idb";

const DB_NAME = "NooraHealthCourses";
const DB_VERSION = 1;

// Singleton pattern with connection pooling
let dbInstance: IDBPDatabase<NooraHealthDB> | null = null;
let dbPromise: Promise<IDBPDatabase<NooraHealthDB>> | null = null;

export async function initDB(): Promise<IDBPDatabase<NooraHealthDB>> {
  // Return existing instance if database is open
  if (dbInstance && dbInstance.objectStoreNames.length > 0) {
    try {
      dbInstance.objectStoreNames.contains("courses");
      return dbInstance;
    } catch (e) {
      dbInstance = null; // Database closed, need to reopen
    }
  }

  // Prevent multiple simultaneous openings
  if (dbPromise) return dbPromise;

  dbPromise = openDB<NooraHealthDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("courses")) {
        db.createObjectStore("courses", { keyPath: "courseId" });
      }
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files"); // Out-of-line keys
      }
    },
    blocked() {
      console.warn("IndexedDB blocked - close other tabs");
    },
    blocking() {
      if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
      }
    },
    terminated() {
      dbInstance = null;
      dbPromise = null;
    },
  });

  try {
    dbInstance = await dbPromise;
    return dbInstance;
  } catch (error) {
    dbPromise = null;
    throw error;
  }
}

// Store complete course with ZIP extraction
export async function storeCourse(
  courseId: string,
  shortname: string,
  version: string | number,
  zipArrayBuffer: ArrayBuffer,
  structure: CourseStructure,
  isDownloaded: boolean = false,
): Promise<void> {
  const db = await initDB();
  const JSZip = (await import("jszip")).default;

  // Load ZIP file
  const zip = await JSZip.loadAsync(zipArrayBuffer);

  // Store course metadata
  const courseTx = db.transaction("courses", "readwrite");
  await courseTx.objectStore("courses").put({
    courseId,
    shortname,
    version,
    downloadedAt: new Date().toISOString(),
    structure,
    isDownloaded,
  });
  await courseTx.done;

  // Extract and store all files
  const fileEntries = Object.entries(zip.files);
  const batchSize = 50; // Process 50 files per transaction

  for (let i = 0; i < fileEntries.length; i += batchSize) {
    const batch = fileEntries.slice(i, i + batchSize);
    const filesTx = db.transaction("files", "readwrite");
    const filesStore = filesTx.objectStore("files");

    await Promise.all(
      batch.map(async ([path, zipEntry]) => {
        if (!zipEntry.dir) {
          const content = await zipEntry.async("uint8array");
          const mimeType = getMimeType(path);
          const key = `${courseId}_${path}`;

          await filesStore.put(
            { courseId, filePath: path, content, mimeType },
            key,
          );
        }
      }),
    );

    await filesTx.done;
  }
}

// Retrieve course structure
export async function getCourseFromIDB(
  courseId: string,
): Promise<CourseStructure | null> {
  const db = await initDB();
  const course = await db.get("courses", courseId);
  return course?.structure || null;
}

// Retrieve file content
export async function getFileFromIDB(
  courseId: string,
  filePath: string,
): Promise<Uint8Array | null> {
  const db = await initDB();
  const key = `${courseId}_${filePath}`;
  const file = await db.get("files", key);
  return file?.content || null;
}
```

**Storage Optimization**:

- **Batched Writes**: Process 50 files per transaction to avoid blocking UI
- **MIME Type Detection**: Automatic detection for HTML, CSS, JS, images, video
- **Blob URL Generation**: Convert Uint8Array to Blob URLs for media playback
- **Connection Pooling**: Singleton database instance prevents connection overhead

### Media Storage

Videos and audio stored separately in IndexedDB `files` store:

```typescript
// Key format: "{courseId}_{filename}"
key: "123_video_lecture.mp4"
content: Uint8Array([...])  // Binary video data
mimeType: "video/mp4"
```

Retrieved as Blob URLs for playback:

```typescript
const blob = new Blob([uint8Array], { type: mimeType });
const url = URL.createObjectURL(blob);
// <video src={url} />
```

### Storage Limits

| Browser | IndexedDB Limit   | localStorage Limit |
| ------- | ----------------- | ------------------ |
| Chrome  | 60% of disk space | 10MB               |
| Firefox | 50% of disk space | 10MB               |
| Safari  | 1GB               | 5MB                |
| Edge    | 60% of disk space | 10MB               |

### Data Cleanup

```typescript
// Clear all IndexedDB data
import { clearAllCourses } from "@/utils/courseStorageIDB";
await clearAllCourses();

// Remove specific course
import { deleteCourseFromIDB } from "@/utils/courseStorageIDB";
await deleteCourseFromIDB(123);
```

---

## Styling System

### Tailwind CSS 4.x

**Configuration**: `tailwind.config.js`

```javascript
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#667eea",
        secondary: "#764ba2",
      },
    },
  },
};
```

**Global Styles**: `src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --primary: 220 70% 50%;
    --radius: 0.5rem;
  }
}
```

### Component Architecture

**Radix UI + shadcn/ui**:

All UI primitives built on Radix UI primitives:

```
src/components/ui/
├── button.tsx          # Styled Radix Button
├── dialog.tsx          # Modal/Dialog
├── dropdown-menu.tsx   # Context menus
├── progress.tsx        # Progress bars
├── select.tsx          # Select dropdowns
├── switch.tsx          # Toggle switches
└── tooltip.tsx         # Tooltips
```

**Usage Example**:

```typescript
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

<Button variant="primary" size="lg">
  Download Course
</Button>
```

### Responsive Breakpoints

```css
/* Tailwind default breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

**Usage**:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Responsive grid */}
</div>
```

### CSS Modules

Not used. All styling via:

1. Tailwind utility classes (90%)
2. Global CSS custom properties (10%)

### Dark Mode

System-aware dark mode using Tailwind:

```typescript
<div className="bg-white dark:bg-gray-900">
  {/* Auto-switches based on system preference */}
</div>
```

---

## State Management

### Zustand Stores

**Architecture**: Three specialized stores

```typescript
// 1. Authentication & User State
useAuthStore (src/store/useStore.ts)
- user: User | null
- setUser(user: User)
- logout()
- Persisted: username + apiKey only

// 2. Course Cache
useCourseStore (src/store/useStore.ts)
- cachedCourses: Map<courseId, CachedCourse>
- getCachedCourse(id)
- setCachedCourse(id, course)
- Memory-only (not persisted)

// 3. Download Progress
useDownloadProgressStore (src/store/useDownloadProgressStore.ts)
- downloads: Record<courseId, DownloadProgress>
- setProgress(courseId, progress)
- Tracks two-phase download (0-50% download, 51-100% install)
```

### Usage Patterns

**Auth Store**:

```typescript
import { useAuthStore } from '@/store/useStore';

function Component() {
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);

  if (!user) return <LoginPrompt />;

  return <div>Welcome {user.firstName}</div>;
}
```

**Course Store**:

```typescript
import { useCourseStore } from '@/store/useStore';

function CourseViewer({ courseId }: Props) {
  const getCourse = useCourseStore(state => state.getCachedCourse);
  const course = getCourse(courseId);

  // If not in cache, load from IndexedDB or API
  if (!course) {
    fetchAndCacheCourse(courseId);
  }

  return <CourseContent course={course} />;
}
```

### Persist Middleware

```typescript
// Zustand persist configuration
persist(
  (set, get) => ({
    user: null,
    setUser: (user) => set({ user }),
  }),
  {
    name: "noora-auth-storage", // localStorage key
    partialize: (state) => ({
      username: state.user?.username,
      apiKey: state.user?.apiKey,
    }), // Only persist credentials
  },
);
```

### State Hydration

On app load:

```typescript
// 1. Hydrate from localStorage
const store = useAuthStore.getState();

// 2. Fetch full user data
if (store.user?.apiKey) {
  const fullUser = await authService.getUserData(store.user.apiKey);
  store.setUser(fullUser);
}
```

---

## Course Download System

### Two-Phase Download Process

**Phase 1: Download (0-50%)**

- Streaming fetch of Moodle .mbz file
- ReadableStream chunk processing
- Real-time progress updates

**Phase 2: Installation (51-100%)**

- 60%: Unzip .mbz package
- 70%: Parse XML structure
- 80%: Extract media files
- 90%: Save to IndexedDB
- 100%: Update course metadata

### Service Architecture

```typescript
// src/services/courseDownloadService.ts
export async function downloadCourseWithProgress(
  url: string,
  courseId: number,
  shortname: string,
  version: number,
  onProgress: (phase: string, percent: number) => void,
) {
  // Phase 1: Download
  const response = await fetch(url);
  const reader = response.body.getReader();
  let receivedLength = 0;
  const contentLength = response.headers.get("Content-Length");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedLength += value.length;
    const percent = (receivedLength / contentLength) * 50;
    onProgress("downloading", percent);
  }

  // Phase 2: Installation
  onProgress("extracting", 60);
  const zip = await JSZip.loadAsync(chunks);

  onProgress("parsing", 70);
  const structure = await parseModuleXML(zip);

  onProgress("saving", 80);
  await saveCourseToIDB(courseId, shortname, version, structure);

  onProgress("complete", 100);
}
```

### UI Component

```typescript
// src/components/CourseDownloadButton.tsx
<CourseDownloadButton
  courseId={course.id}
  downloadUrl={course.download_url}
  isDownloaded={false}
  onDownloadComplete={() => {
    toast.success('Course ready for offline use');
  }}
/>
```

**States**:

- Not Downloaded: Blue download icon
- Downloading: Progress bar (0-50%)
- Installing: Progress bar (51-100%)
- Downloaded: Green checkmark

### Cancel Download

```typescript
const { cancelDownload } = useCourseDownload();

<Button onClick={() => cancelDownload(courseId)}>
  Cancel Download
</Button>
```

### Resume Download

Not implemented. Cancelled downloads must restart from 0%.

---

## Media Handling

### Video System

**Architecture**: Inline video links in HTML converted to `<video>` elements

**Flow**:

```
1. Moodle HTML: <a href="/media/video.mp4">Watch Video</a>
2. Download: Fetch video as Uint8Array to IndexedDB
3. Storage: Key = "courseId_video.mp4", content = Uint8Array
4. Playback: Convert to Blob URL
5. Render: <video src="blob:http://localhost/..." controls />
```

### Media Download Service

```typescript
// src/services/mediaDownloadService.ts
export async function downloadMedia(
  url: string,
  courseId: number,
  filename: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const response = await fetch(url);
  const reader = response.body.getReader();
  const contentLength = response.headers.get("Content-Length");

  const chunks: Uint8Array[] = [];
  let receivedLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;
    onProgress((receivedLength / contentLength) * 100);
  }

  const allChunks = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, position);
    position += chunk.length;
  }

  await saveMediaToIDB(courseId, filename, allChunks);
}
```

### HTML Content Rendering

**CRITICAL**: React's `dangerouslySetInnerHTML` doesn't execute `<script>` tags.

**Solution**: `HtmlContentRenderer` component manually replaces scripts:

```typescript
// src/components/HtmlContentRenderer.tsx
useEffect(() => {
  const container = contentRef.current;
  if (!container) return;

  // Set HTML
  container.innerHTML = processedHtml;

  // Find and replace script tags to trigger execution
  const scripts = container.querySelectorAll("script");
  scripts.forEach((oldScript) => {
    const newScript = document.createElement("script");
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });

  // Replace video links with <video> elements
  const videoLinks = container.querySelectorAll('a[href*="/media/"]');
  videoLinks.forEach(async (link) => {
    const filename = link.href.split("/").pop();
    const blob = await getMediaBlobFromIDB(courseId, filename);
    const video = document.createElement("video");
    video.src = URL.createObjectURL(blob);
    video.controls = true;
    link.replaceWith(video);
  });
}, [processedHtml]);
```

### CSS/JS Inlining

Offline courses require inlining external assets:

```typescript
// src/utils/htmlProcessor.ts
export function inlineAssets(html: string, courseId: number): string {
  // Convert <link rel="stylesheet" href="style.css">
  // To:     <style>{/* CSS content */}</style>
  // Convert <script src="script.js"></script>
  // To:     <script>{/* JS content */}</script>
  // Convert url(/image.png)
  // To:     url(data:image/png;base64,...)
}
```

---

## Error Handling

### Boundary Components

```typescript
// src/app/error.tsx - Page-level errors
export default function Error({ error, reset }: ErrorProps) {
  return (
    <div>
      <h1>Something went wrong!</h1>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

// src/app/global-error.tsx - App-level errors
export default function GlobalError({ error }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <h1>Application Error</h1>
        <p>{error.message}</p>
      </body>
    </html>
  );
}
```

### Offline Error Component

```typescript
// src/components/OfflineError.tsx
export function OfflineError({ courseName }: Props) {
  return (
    <div>
      <h2>Course Not Available Offline</h2>
      <p>Download "{courseName}" to access it without internet.</p>
      <Button onClick={handleDownload}>Download Now</Button>
    </div>
  );
}
```

### API Error Handling

```typescript
// src/utils/apiClient.ts
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth
      useAuthStore.getState().logout();
      router.push("/login");
    } else if (error.response?.status === 404) {
      // Not found - show friendly message
      toast.error("Content not found");
    } else if (!navigator.onLine) {
      // Offline - redirect to offline page
      router.push("/offline");
    }
    return Promise.reject(error);
  },
);
```

### Try-Catch Patterns

```typescript
async function loadCourse(courseId: number) {
  try {
    // Priority 1: IndexedDB
    const course = await getCourseFromIDB(courseId);
    if (course) return course;

    // Priority 2: API
    if (navigator.onLine) {
      return await courseService.getCourse(courseId);
    }

    // No course available
    throw new Error("Course not available offline");
  } catch (error) {
    console.error("Course load failed:", error);
    toast.error("Failed to load course");
    return null;
  }
}
```

---

## PWA Features

### Service Worker

**Custom Worker**: `public/sw-custom.js`

```javascript
// Network-first for API calls
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
  }
});

// Cache-first for static assets
if (event.request.url.includes("/_next/")) {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    }),
  );
}
```

### Install Prompt

```typescript
// src/components/PWAInstallPrompt.tsx
const [deferredPrompt, setDeferredPrompt] = useState(null);

useEffect(() => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    setDeferredPrompt(e);
    setShowInstallPrompt(true);
  });
}, []);

const handleInstall = async () => {
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") {
    setShowInstallPrompt(false);
  }
};
```

### Offline Detection

```typescript
// src/components/PWAStatus.tsx
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

return (
  <div className={isOnline ? 'bg-green-500' : 'bg-red-500'}>
    {isOnline ? 'Online' : 'Offline'}
  </div>
);
```

### Update Notification

```typescript
// Detect new service worker
useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setShowUpdatePrompt(true);
          }
        });
      });
    });
  }
}, []);
```

### Manifest Configuration

```json
// public/manifest.json
{
  "name": "Noora Academy",
  "short_name": "Noora Academy",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#667eea",
  "icons": [
    {
      "src": "/logo/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/logo/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

## Performance Optimization

### Image Optimization

```typescript
import Image from 'next/image';

<Image
  src="/course/thumbnail.jpg"
  alt="Course thumbnail"
  width={300}
  height={200}
  loading="lazy"
  placeholder="blur"
/>
```

**Benefits**:

- Automatic WebP/AVIF conversion
- Responsive image sizes
- Lazy loading by default
- Blur-up placeholder

### Code Splitting

Automatic route-based splitting:

```typescript
// Each page is its own bundle
app/course/[id]/view/page.tsx → course-[id]-view.js
app/points/page.tsx            → points.js
```

Dynamic imports for large components:

```typescript
import dynamic from 'next/dynamic';

const QuizRenderer = dynamic(() => import('@/components/QuizRenderer'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### React Compiler

Enabled in `next.config.js`:

```javascript
experimental: {
  reactCompiler: true,
}
```

**Optimizations**:

- Automatic memoization
- Reduced re-renders
- Optimized hook dependencies

### Caching Strategy

```typescript
// API responses cached in Zustand (memory)
const course = useCourseStore(state => state.getCachedCourse(id));

// Static assets cached by service worker
Cache-Control: public, max-age=31536000, immutable

// Media files stored in IndexedDB (long-term)
```

### Bundle Analysis

```bash
npm run build
# Check .next/analyze/ for bundle sizes
```

**Target Sizes**:

- First Load JS: < 100KB
- Largest Page: < 200KB
- Total JS: < 500KB

---

## Security Practices

### API Key Protection

```typescript
// Encrypted storage
import CryptoJS from "crypto-js";

const encrypted = CryptoJS.AES.encrypt(apiKey, SECRET_KEY).toString();
localStorage.setItem("auth", encrypted);

const decrypted = CryptoJS.AES.decrypt(encrypted, SECRET_KEY).toString(
  CryptoJS.enc.Utf8,
);
```

### XSS Prevention

```typescript
// Sanitize user input
import DOMPurify from "dompurify";

const cleanHtml = DOMPurify.sanitize(userInput);
```

### HTTPS Enforcement

```javascript
// next.config.js - Production only
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ],
    },
  ];
}
```

### Content Security Policy

```javascript
// Restrict resource loading
headers: [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
  },
];
```

### Sensitive Data

- Never log API keys
- No credentials in URLs
- No user data in analytics
- Clear storage on logout
- Encrypted localStorage

---

## Deployment

### Vercel (Recommended)

**One-Click Deploy**:

**Manual Deployment**:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
```

**Configuration** (vercel.json):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sin1"]
}
```

### AWS Amplify

**Configuration**: `amplify.yml`

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - "**/*"
  cache:
    paths:
      - node_modules/**/*
```

**Deploy Steps**:

1. Connect GitHub repository
2. Set environment variables in Amplify Console
3. Configure build settings (use amplify.yml)
4. Deploy branch (auto-deploys on push)

### Docker

**Dockerfile**:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

**Build & Run**:

```bash
# Build image
docker build -t noora-academy .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=https://academy.noorahealth.org/api/v2/ \
  noora-academy
```

### Environment Configuration

**Production Checklist**:

- [ ] Set `NEXT_PUBLIC_API_URL` to production endpoint
- [ ] Enable HTTPS/SSL certificate
- [ ] Configure CORS on API server
- [ ] Set up CDN for static assets
- [ ] Enable analytics (Countly)
- [ ] Test PWA installation
- [ ] Verify offline functionality
- [ ] Run Lighthouse audit (score > 90)

---

## CI/CD

### GitHub Actions

**.github/workflows/deploy.yml**:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Build project
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: "--prod"
```

### AWS Amplify Auto-Deploy

Automatically deploys on push to connected branch:

1. Push to `main` branch
2. Amplify detects commit
3. Runs build (`amplify.yml`)
4. Deploys to staging/production URL
5. Sends notification on completion

### Pre-Deployment Checks

```bash
# Local validation before pushing
npm run lint           # Check code quality
npm run build          # Verify build succeeds
npm run pwa:check      # Run Lighthouse audit
```

---

## Troubleshooting

### Common Issues

#### Service Worker Not Registering

**Symptoms**: PWA features not working, offline mode fails

**Solutions**:

```bash
# 1. Check HTTPS (required for SW)
# Development: Use localhost or HTTPS
# Production: Ensure SSL certificate is valid

# 2. Clear service worker cache
# Chrome DevTools → Application → Service Workers → Unregister

# 3. Verify manifest.json
# Chrome DevTools → Application → Manifest → Check for errors

# 4. Check browser console for SW errors
```

#### IndexedDB Quota Exceeded

**Symptoms**: "QuotaExceededError" when downloading courses

**Solutions**:

```typescript
// 1. Check available storage
const estimate = await navigator.storage.estimate();
console.log(`Used: ${estimate.usage} / ${estimate.quota}`);

// 2. Clear old courses
import { clearAllCourses } from "@/utils/courseStorageIDB";
await clearAllCourses();

// 3. Request persistent storage (Chrome 52+)
await navigator.storage.persist();
```

#### Course Not Loading Offline

**Symptoms**: "Course not available" error when offline

**Solutions**:

1. Verify course was fully downloaded (check IndexedDB in DevTools)
2. Ensure service worker is active
3. Check network tab for failed requests
4. Clear browser cache and re-download course

#### Build Failures

**Symptoms**: `npm run build` errors

**Solutions**:

```bash
# 1. Clear Next.js cache
rm -rf .next

# 2. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Check TypeScript errors
npm run lint

# 4. Disable build checks temporarily (not recommended for production)
# In next.config.js:
typescript: { ignoreBuildErrors: true }
eslint: { ignoreDuringBuilds: true }
```

#### Videos Not Playing Offline

**Symptoms**: Video links don't work when offline

**Solutions**:

1. Verify video file is in IndexedDB (DevTools → Application → IndexedDB → files)
2. Check video key format: `{courseId}_{filename}`
3. Ensure `HtmlContentRenderer` component is used (not `dangerouslySetInnerHTML`)
4. Check browser console for Blob URL creation errors

### Debug Mode

Enable verbose logging:

```typescript
// src/utils/debugTools.ts
export const DEBUG = process.env.NODE_ENV === "development";

if (DEBUG) {
  console.log("Course loaded:", course);
  console.log("IndexedDB state:", await getCourseFromIDB(courseId));
}
```
