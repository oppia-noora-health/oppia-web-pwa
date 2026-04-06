# Noora Health PWA - AI Agent Instructions

## Project Overview

Progressive Web App for healthcare learning platform serving OppiaMobile Moodle courses. Built with Next.js 16, React 19, TypeScript. Core architecture: **offline-first with IndexedDB storage**, dual-mode course delivery (online/offline), and full Moodle content support including CSS/JS execution.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Compiler enabled), React 19
- **State**: Zustand with persist middleware (`src/store/`)
- **Styling**: Tailwind CSS 4, Radix UI components
- **Storage**: IndexedDB via `idb` library, localStorage fallback
- **PWA**: `next-pwa` with custom service worker
- **API**: Axios client with staging proxy (`next.config.js` rewrites)

## Critical Architecture Patterns

### 1. Course Loading Strategy (Priority Order)

```typescript
// src/hooks/useCourseData.ts + src/app/course/[id]/view/page.tsx
1. IndexedDB (downloaded courses) → loadPageContentFromIDB()
2. Zustand cache (recently viewed) → useCourseStore.getCachedCourse()
3. localStorage (backward compat) → rarely used
4. API fetch (new courses) → courseService.ts
```

### 2. Tag-Based Course Organization

```typescript
// Course Management Flow:
1. /course-management → Display tags from /api/v2/tag/ endpoint
2. Click tag → Navigate to /course-management/[tagId] with courses filtered by tag
3. Tag response includes course_statuses object mapping course shortnames to status

// src/types/tag.ts - Tag interface
interface Tag {
  id: number;
  name: string;
  count: number; // Total courses in tag
  course_statuses: Record<string, string>; // { "course-shortname": "live" }
}
```

### 3. IndexedDB Schema (`src/utils/courseStorageIDB.ts`)

```typescript
Database: "NooraHealthCourses"
Stores:
  - courses: { courseId, shortname, version, downloadedAt, structure }
  - files: { key: "courseId_filepath", content: Uint8Array, mimeType }
Media stored separately with key: "${courseId}_${filename}"
```

### 4. Moodle Content Rendering (`src/components/HtmlContentRenderer.tsx`)

**CRITICAL**: React's `dangerouslySetInnerHTML` doesn't execute scripts. Custom component:

- Sets innerHTML → finds `<script>` tags → replaces with new elements to trigger execution
- Processes CSS/JS inlining for offline mode
- Converts video `<a>` tags to `<video>` elements with IndexedDB blob URLs
- Applies responsive wrapper styles (max-width 600px desktop, 768px tablet)

### 5. State Management Stores

```typescript
// src/store/useStore.ts
- useAuthStore: persist(username, apiKey) only; full user data in memory
- useCourseStore: cache courses in memory with Map<courseId, CachedCourse>
- useDownloadProgressStore: track download phases (downloading 0-50%, installing 51-100%)

// src/store/useMenuStore.ts - UI state (sidebar open/close)
```

### 6. Video System (`VIDEO-SYSTEM-IMPLEMENTATION.md`)

- Media metadata in `module.xml` (filename, digest, downloadUrl)
- URL encoding: HTML uses `%20`, XML uses spaces → decode with `decodeURIComponent()`
- Storage: `mediaDownloadService.ts` handles streaming downloads to IndexedDB
- Playback: `HtmlContentRenderer` replaces `<a href="/video/">` with `<video src="{blob:...}">`

## Developer Workflows

### Development

```powershell
npm run dev  # Next.js dev server on localhost:3000
```

### Key Commands

```powershell
npm run build              # Production build
npm run generate-icons     # Generate PWA icons
npm run pwa:check         # Lighthouse PWA audit
```

### API Configuration

- Base URL: `https://academy-indonesia.noorahealth.org/api/v2/`
- All `/api/*` requests rewrite to staging via `next.config.js`
- Auth: username + api_key (stored in Zustand + encrypted localStorage)
- Use `src/utils/apiClient.ts` for authenticated requests

## File Conventions

### Client/Server Components

- **ALL page components** use `"use client"` (no SSR for auth-protected app)
- Services/utils are plain TS (no directives)
- Layout.tsx is server component wrapping client providers

### Import Paths

- Use `@/*` aliases for all internal imports (maps to `src/*`)
- Example: `import { useAuthStore } from "@/store/useStore"`

### Component Structure

```
src/
  app/               # Next.js pages (all client components)
  components/        # Reusable UI + feature components
    ui/             # shadcn/ui Radix components
    course/         # Course-specific features
  hooks/            # Custom React hooks (9 total)
  services/         # API clients + business logic
  store/            # Zustand stores (3 files)
  utils/            # Utilities (courseStorageIDB, htmlProcessor, etc.)
  types/            # TypeScript interfaces
```

## Course Download System (`DOWNLOAD-PROGRESS-IMPLEMENTATION.md`)

### Two-Phase Progress

1. **Download (0-50%)**: Streaming fetch with ReadableStream chunks
2. **Installation (51-100%)**: Fixed milestones (60% unzip, 70% parse, 80% save, etc.)

### Service Layer

```typescript
// src/services/courseDownloadService.ts
downloadCourseWithProgress(url, courseId, shortname, version, onProgress)
  → Downloads ZIP → Extracts all files → Stores in IndexedDB
```

### UI Component

```typescript
// src/components/CourseDownloadButton.tsx
<CourseDownloadButton
  courseId={course.id}
  downloadUrl={course.download_url}
  isDownloaded={false}
  onDownloadComplete={() => {}}
/>
```

## PWA Implementation (`PWA-IMPLEMENTATION.md`)

### Service Worker

- Custom worker: `public/sw-custom.js` (network-first for APIs, cache-first for assets)
- Offline page: `/offline` route
- Install prompt: Shows after 3 seconds, dismissible (localStorage pref)

### PWA Components

- `<PWAStatus />` - Offline indicator + update prompt
- `<PWAInstallPrompt />` - Custom install banner
- Hook: `usePWA.ts` for status management

## CSS/JS Rendering (`MOODLE-CSS-JS-RENDERING.md`)

### File Extraction

Stores ALL asset types from Moodle .mbz:

- CSS/JS → text
- Fonts → base64 data URIs
- Images/Videos → Uint8Array in IndexedDB

### HTML Processing

- Inline `<link rel="stylesheet">` → `<style>{content}</style>`
- Inline `<script src="">` → `<script>{content}</script>`
- Process CSS url() → convert to blob/data URIs
- **MUST** replace script tags to trigger execution (see HtmlContentRenderer)

## Common Pitfalls

1. **Don't use localStorage for courses** - Always use IndexedDB (`courseStorageIDB.ts`)
2. **HTML content needs script execution** - Use `HtmlContentRenderer`, not `dangerouslySetInnerHTML`
3. **Check offline mode** - Courses from IndexedDB have different data structure than API
4. **Video URL encoding** - Always decode HTML hrefs before matching to XML filenames
5. **Auth state** - Only username + apiKey persisted; refresh full user data from API on mount
6. **Course caching** - Zustand cache is memory-only, IndexedDB for downloads
7. **Client components** - All pages need `"use client"` directive

## Key Files to Reference

- **Course Management**: `src/app/course-management/page.tsx` (tag listing)
- **Tag Courses**: `src/app/course-management/[tagId]/page.tsx` (courses by tag)
- **Course Viewer**: `src/app/course/[id]/view/page.tsx` (shows dual-mode loading)
- **IndexedDB**: `src/utils/courseStorageIDB.ts` + `courseLoaderIDB.ts`
- **HTML Rendering**: `src/components/HtmlContentRenderer.tsx` (script execution pattern)
- **Download**: `src/services/courseDownloadService.ts` (streaming + progress)
- **Media**: `src/services/mediaDownloadService.ts` (video downloads)
- **Auth**: `src/services/authService.ts` + `src/store/useStore.ts`

## Environment Variables

```env
NEXT_PUBLIC_API_URL=https://staging.academy.noorahealth.org/api/v2/
```

## Testing Notes

- PWA features require HTTPS or localhost
- IndexedDB inspection: Chrome DevTools → Application → IndexedDB
- Service worker: Chrome DevTools → Application → Service Workers
- Mock user available in useAuthStore for testing (username: +919999999999_test)

## Implementation Docs

Detailed guides in root directory:

- `COURSE-IMPLEMENTATION-SUMMARY.md` - Course loading architecture
- `VIDEO-SYSTEM-IMPLEMENTATION.md` - Media download + playback
- `PWA-IMPLEMENTATION.md` - PWA features + setup
- `MOODLE-CSS-JS-RENDERING.md` - Asset handling + script execution
- `DOWNLOAD-PROGRESS-IMPLEMENTATION.md` - Download UI patterns
