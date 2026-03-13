import { DriveStep } from "driver.js";

// Define page-specific tours for each route in the application
// Tours are shown on first visit to each page

export const pageTours: Record<string, DriveStep[]> = {
  // Home Page (Downloaded Courses) - /course
  "/course": [
    {
      popover: {
        title: "📱 Welcome to Your Home Dashboard",
        description:
          "This is your learning hub! All downloaded courses appear here as cards. Tap any course to continue learning. If you haven't downloaded any courses yet, visit Course Management to get started.",
        side: "over",
      },
    },
    {
      element: "#course-cards-container",
      popover: {
        title: "📚 Your Downloaded Courses",
        description:
          "Each card shows: course title, your progress percentage, and number of activities completed. Tap a card to resume learning from where you left off.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#download-courses-nav",
      popover: {
        title: "➕ Add More Courses",
        description:
          "Click 'Courses' in the sidebar to browse and download new courses. All courses are available offline once downloaded!",
        side: "right",
        align: "start",
      },
    },
  ],

  // Course Management (Tags List) - /course-management
  "/course-management": [
    {
      popover: {
        title: "🗂️ Browse Course Categories",
        description:
          "Courses are organized by topics/categories. Each category card shows the topic name and number of available courses. Select a category to explore courses inside.",
        side: "over",
      },
    },
    {
      element: "#tag-list",
      popover: {
        title: "📋 Category Cards",
        description:
          "Each card displays: category name, course count, and a visual icon. Tap any card to view all courses in that category.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tag-card-0",
      popover: {
        title: "👆 Tap to Explore",
        description:
          "Click on a category to see the full list of courses. Inside, you'll find download buttons to save courses for offline learning.",
        side: "top",
        align: "center",
      },
    },
  ],

  // Course Management Tag Detail - /course-management/[tagId]
  "/course-management/[tagId]": [
    {
      popover: {
        title: "📚 Courses in This Category",
        description:
          "Here are all the courses available in this category. Each course card shows its title, description, status, and download button.",
        side: "over",
      },
    },
    {
      element: "#course-cards-list",
      popover: {
        title: "📖 Course Cards",
        description:
          "Each course card displays: title, brief description, course status (live/draft), and download progress. Scroll to browse all courses.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: ".download-button-0",
      popover: {
        title: "📥 Download for Offline Access",
        description:
          "Tap the download button to save a course to your device. Once downloaded, you can access it anytime without internet! Downloaded courses appear on your Home page.",
        side: "top",
        align: "center",
      },
    },
    {
      popover: {
        title: "✅ After Downloading",
        description:
          "Downloaded courses will appear on your Home page. You can start learning immediately, even offline! Track your progress in the Scorecard.",
        side: "over",
      },
    },
  ],

  // Course Viewer - /course/[id]/view
  "/course/[id]/view": [
    {
      element: "#course-header",
      popover: {
        title: "📖 Course Viewer",
        description:
          "Welcome to your learning space! Here you'll watch videos, read content, listen to audio, view PDFs, and answer quiz questions.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#section-tabs",
      popover: {
        title: "📑 Course Sections",
        description:
          "Each section contains multiple activities. Click on tabs to switch between different sections of the course. Your progress is saved automatically.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#activity-tabs",
      popover: {
        title: "🎯 Activity Tabs",
        description:
          "Each tab represents a learning activity: videos, readings, quizzes, audio lessons, or PDFs. Click tabs to navigate between activities in this section.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#course-content",
      popover: {
        title: "🎬 Interactive Content Area",
        description:
          "This is where you learn! Watch videos, read lessons, view images, listen to audio, or answer quiz questions. All content works offline after download.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "#course-navigation",
      popover: {
        title: "⬅️ ➡️ Navigate Activities",
        description:
          "Use 'Previous' and 'Next' buttons to move through activities. Complete each one to earn points and progress through the course!",
        side: "top",
        align: "center",
      },
    },
    {
      popover: {
        title: "🏆 Earn Points & Track Progress",
        description:
          "Complete activities and quizzes to earn points! Check your progress in the Scorecard and compete on the Leaderboard. Happy learning!",
        side: "over",
      },
    },
  ],

  // Scorecard Page - /scoreboard
  "/scoreboard": [
    {
      popover: {
        title: "📊 Your Learning Analytics",
        description:
          "Welcome to your Scorecard! Track your performance, course progress, activity history, and quiz scores all in one place.",
        side: "over",
      },
    },
    {
      element: "#scorecard-tabs",
      popover: {
        title: "📑 Three Tracking Views",
        description:
          "Switch between 3 tabs: Overview (course progress), Activity (daily learning log), and Quizzes (quiz performance). Each provides unique insights.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#overview-tab",
      popover: {
        title: "📈 Overview Tab",
        description:
          "See all your enrolled courses with completion percentages. Each card shows: course title, activities completed, and overall progress bar.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#activity-tab",
      popover: {
        title: "📅 Activity Tab",
        description:
          "Track your learning activity over time. Filter by Week, Month, or Year to see: when you studied, which activities you completed, and your consistency patterns.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#quizzes-tab",
      popover: {
        title: "❓ Quizzes Tab",
        description:
          "View all quiz attempts and scores by course. See: total quizzes attempted, pass rate, individual quiz scores, and areas for improvement.",
        side: "bottom",
        align: "start",
      },
    },
    {
      popover: {
        title: "💡 Use Your Insights",
        description:
          "Use these analytics to: identify strong areas, find topics needing more practice, maintain learning consistency, and track your growth over time!",
        side: "over",
      },
    },
  ],

  // Points Page - /points
  "/points": [
    {
      popover: {
        title: "🏆 Points & Achievements",
        description:
          "Welcome to your rewards hub! Earn points for completing activities and quizzes. Track your achievements, compete on the leaderboard, and unlock badges.",
        side: "over",
      },
    },
    {
      element: "#total-points-display",
      popover: {
        title: "⭐ Your Total Points (XP)",
        description:
          "This shows your lifetime points earned from all courses. Complete more activities and quizzes to increase your score and climb the leaderboard!",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#points-tabs",
      popover: {
        title: "📊 Three Reward Views",
        description:
          "Switch between 3 tabs: Points (your XP history), Leaderboard (compare with others), and Badges (achievements unlocked).",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#points-history-chart",
      popover: {
        title: "📈 Points History Chart",
        description:
          "Visualize your points earned over time. Filter by Week, Month, or Year to see your learning patterns and consistency.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "#recent-activity-list",
      popover: {
        title: "📝 Recent Activity Log",
        description:
          "Detailed list showing: which activities you completed, when you earned points, and how many points each activity gave you.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "#leaderboard-list",
      popover: {
        title: "🏅 Leaderboard Rankings",
        description:
          "See where you rank among all learners! Your position is highlighted. Compete with others and climb higher by earning more points.",
        side: "top",
        align: "center",
      },
    },
    {
      element: "#badges-collection",
      popover: {
        title: "🎖️ Badges & Awards",
        description:
          "Unlock special badges by achieving milestones: completing courses, quiz streaks, high scores, and special achievements. Collect them all!",
        side: "top",
        align: "center",
      },
    },
    {
      popover: {
        title: "🎯 Keep Earning!",
        description:
          "Complete activities daily to: earn more points, unlock new badges, climb the leaderboard, and stay motivated on your learning journey!",
        side: "over",
      },
    },
  ],

  // Settings Page - /settings
  "/settings": [
    {
      popover: {
        title: "⚙️ Settings & Preferences",
        description:
          "Customize your learning experience! Manage your profile, change language, control notifications, and configure app settings.",
        side: "over",
      },
    },
    {
      element: "#profile-section",
      popover: {
        title: "👤 Profile Information",
        description:
          "View and edit your profile details: name, phone number, email, and profile picture. Keep your information up to date.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#language-selector",
      popover: {
        title: "🌐 Language Preferences",
        description:
          "Choose your preferred language for the app interface. Course content may be available in multiple languages too.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#notification-settings",
      popover: {
        title: "🔔 Notification Controls",
        description:
          "Enable or disable push notifications for: course updates, quiz reminders, achievement unlocks, and learning streak alerts.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#storage-management",
      popover: {
        title: "💾 Storage Management",
        description:
          "See how much storage your downloaded courses use. You can delete courses here to free up space if needed.",
        side: "bottom",
        align: "start",
      },
    },
  ],

  // About & Help Page - /about-help
  "/about-help": [
    {
      popover: {
        title: "ℹ️ About & Help",
        description:
          "Learn about Noora Academy, get help with common questions, and find support resources.",
        side: "over",
      },
    },
    {
      element: "#about-section",
      popover: {
        title: "🏥 About Noora Academy",
        description:
          "Discover our mission to improve health outcomes through accessible education. Learn about our impact and the communities we serve.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#faq-section",
      popover: {
        title: "❓ Frequently Asked Questions",
        description:
          "Find answers to common questions about: downloading courses, offline access, earning points, quiz attempts, and troubleshooting.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#support-contact",
      popover: {
        title: "📞 Contact Support",
        description:
          "Need help? Reach out to our support team via email or phone. We're here to help you succeed in your learning journey!",
        side: "bottom",
        align: "start",
      },
    },
  ],
};

// Helper function to get tour for current page (supports dynamic routes)
export function getTourForPage(pathname: string): DriveStep[] | undefined {
  // Exact match first
  if (pageTours[pathname]) {
    return pageTours[pathname];
  }

  // Handle dynamic routes (e.g., /course/[id]/view -> /course/[id]/view)
  const dynamicRoutes = [
    {
      pattern: /^\/course-management\/\d+$/,
      key: "/course-management/[tagId]",
    },
    { pattern: /^\/course\/\d+\/view$/, key: "/course/[id]/view" },
    { pattern: /^\/course\/\d+$/, key: "/course/[id]" },
  ];

  for (const route of dynamicRoutes) {
    if (route.pattern.test(pathname)) {
      return pageTours[route.key];
    }
  }

  return undefined;
}

// Helper to generate page-specific tour ID for localStorage tracking
export function getPageTourId(pathname: string): string {
  // Remove trailing slashes and sanitize for localStorage key
  const cleanPath = pathname.replace(/\/$/, "").replace(/\//g, "_") || "home";
  return `page_tour_${cleanPath}`;
}
