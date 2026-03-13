import { DriveStep } from "driver.js";

// ========================================
// PAGE-SPECIFIC TOURS
// ========================================

// Home Page (Downloaded Courses) Tour
export const getHomePageTour = (): DriveStep[] => [
  {
    popover: {
      title: "Welcome to Your Home",
      description:
        "All your downloaded courses appear here as cards. Tap any course to continue learning!",
      side: "over",
    },
  },
  {
    element: "#home-page-content",
    popover: {
      title: "Your Downloaded Courses",
      description:
        "Each card shows a course you've downloaded. Your progress is automatically saved and courses work offline!",
      side: "bottom",
      align: "center",
    },
  },
  {
    popover: {
      title: "Download More Courses",
      description:
        "To add more courses, use the 'View Courses' menu in the sidebar to browse categories and download courses for offline learning.",
      side: "over",
    },
  },
];

// Course Management Page (Tag List) Tour
export const getCourseManagementTour = (): DriveStep[] => [
  {
    popover: {
      title: "Discover New Courses",
      description:
        "Courses are organized into categories or topics. Each category contains related courses you can download or stream.",
      side: "over",
    },
  },
  {
    element: "#tag-list",
    popover: {
      title: "Browse Categories",
      description:
        "Each card shows a course category with the number of available courses. Click any card to explore courses in that topic.",
      side: "bottom",
      align: "start",
    },
  },
  {
    popover: {
      title: "How to Download",
      description:
        "Click on any category to see the courses inside. Then tap the download button on courses you want to learn. Downloaded courses appear on your Home page!",
      side: "over",
    },
  },
];

// Tag Courses Page (Courses in a Category) Tour
export const getTagCoursesTour = (): DriveStep[] => [
  {
    popover: {
      title: "Courses in This Category",
      description:
        "Here are all the courses available in this topic. Browse through the list and download the ones that interest you!",
      side: "over",
    },
  },
  {
    element: ".course-card:first-child",
    popover: {
      title: "Course Information",
      description:
        "Each card shows the course title, description, language, and download status. Review the details to see what you'll learn!",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: ".download-button",
    popover: {
      title: "Download to Learn",
      description:
        "Tap the download button to save a course to your device. You'll see download progress, and once complete, the course appears on your Home page!",
      side: "left",
      align: "center",
    },
  },
  {
    popover: {
      title: "Offline Learning",
      description:
        "Downloaded courses work completely offline with all videos, audio, and interactive content. Download on WiFi to save mobile data!",
      side: "over",
    },
  },
];

// Scoreboard Page Tour
export const getScoreboardTour = (): DriveStep[] => [
  {
    popover: {
      title: "Track Your Progress",
      description:
        "Your learning progress page. See your quiz results and daily progress in one place!",
      side: "over",
    },
  },
  {
    element: "#scorecard-page-content",
    popover: {
      title: "Three Tabs to Explore",
      description:
        "Overview shows your enrolled courses with completion %. Activity tracks your daily learning. Quizzes displays all your quiz attempts and scores.",
      side: "bottom",
      align: "center",
    },
  },
];

// Points Page Tour
export const getPointsTour = (): DriveStep[] => [
  {
    popover: {
      title: "Earn Rewards and Points",
      description:
        "Every activity earns you points. Track your achievements on the leaderboard and unlock badges!",
      side: "over",
    },
  },
  {
    element: "#points-tabs",
    popover: {
      title: "Your Achievements Hub",
      description:
        "Three tabs - Points, Leaderboard, and Badges. Complete activities to earn more rewards.",
      side: "bottom",
      align: "center",
    },
  },
];

// Settings Page Tour
export const getSettingsTour = (): DriveStep[] => [
  {
    popover: {
      title: "Customize Your Experience",
      description:
        "Adjust settings to match your preferences including language, text size, and more.",
      side: "over",
    },
  },
  {
    element: ".settings-language",
    popover: {
      title: "Language & Text Size",
      description:
        "Choose your preferred language and adjust text size for comfortable reading.",
      side: "right",
      align: "start",
    },
  },
];

// Course Details Page Tour
export const getCourseDetailsTour = (): DriveStep[] => [
  {
    popover: {
      title: "Course Overview",
      description:
        "View course description, lessons, activities, and your progress all in one place!",
      side: "over",
    },
  },
  {
    element: "#course-sections",
    popover: {
      title: "Course Structure",
      description:
        "Courses are divided into lessons with activities. Click any lesson to expand and see the activities in it.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#activity-item",
    popover: {
      title: "Start Learning",
      description:
        "Click on any activity to begin. Your progress is saved automatically as you complete each activity!",
      side: "right",
      align: "start",
    },
  },
];

// Course Viewer Page Tour
export const getCourseViewerTour = (): DriveStep[] => [
  {
    popover: {
      title: "Learning in Progress",
      description:
        "Welcome to the course viewer. Watch videos, read lessons, listen to audios, and answer quizzes here.",
      side: "over",
    },
  },
  {
    element: "#activity-tabs",
    popover: {
      title: "Navigate Activities",
      description:
        "Each tab is a different activity. Click tabs to switch between videos, readings, and quizzes in this lesson.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#course-navigation",
    popover: {
      title: "Previous & Next Buttons",
      description:
        "Use these buttons to move through activities. Your progress is auto-saved so you can resume anytime!",
      side: "top",
      align: "center",
    },
  },
];

// Complete app tour - navigates through pages to guide users (kept for backward compatibility)
export const getCompleteAppTour = (router: any): DriveStep[] => [
  {
    popover: {
      title: "Welcome to Noora Academy! 🎓",
      description:
        "Let's take a quick tour! Learn how to download courses, track progress, and earn points.",
      side: "over",
    },
  },
  {
    element: "#home-page-content",
    popover: {
      title: "📱 Your Home Dashboard",
      description:
        "Downloaded courses appear here as cards. Tap any card to start learning!",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "#download-courses-nav",
    popover: {
      title: "📚 Download Courses",
      description:
        "Click 'Courses' menu → Browse categories → Tap download button. Downloaded courses work offline!",
      side: "right",
      align: "start",
    },
  },
  {
    popover: {
      title: "🚀 You're Ready!",
      description:
        "Use Scorecard to track progress and Points to see achievements. Start by downloading your first course. Happy learning!",
      side: "over",
    },
  },
];

export const courseManagementTour: DriveStep[] = [
  {
    element: "#course-management-header",
    popover: {
      title: "Course Categories 📚",
      description:
        "Courses are organized by topics. Browse different categories to find courses that interest you.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "#tag-list",
    popover: {
      title: "Select a Category 👆",
      description:
        "Click on any category card to view all courses in that topic. Each card shows the number of available courses.",
      side: "bottom",
      align: "start",
    },
  },
  {
    popover: {
      title: "Download for Offline Access 📥",
      description:
        "Inside each category, you can download courses to learn offline. Downloaded courses appear on your Home screen!",
      side: "over",
    },
  },
];

export const courseViewerTour: DriveStep[] = [
  {
    element: "#course-header",
    popover: {
      title: "Course Viewer 📖",
      description:
        "Welcome to the course viewer! Here you'll watch videos, read content, listen to audio, and take quizzes.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "#activity-tabs",
    popover: {
      title: "Activity Navigation 📑",
      description:
        "Each tab represents a different activity in the lesson - videos, readings, quizzes, and more. Click tabs to switch between activities.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "#course-content",
    popover: {
      title: "Interactive Content 🎬",
      description:
        "This is your learning space! Watch videos, read lessons, listen to audio, view PDFs, and answer quiz questions.",
      side: "top",
      align: "center",
    },
  },
  {
    element: "#course-navigation",
    popover: {
      title: "Navigate Activities ⬅️ ➡️",
      description:
        "Use Previous and Next buttons to move through activities. Complete each one to earn points and progress!",
      side: "top",
      align: "center",
    },
  },
];

export const scorecardTour: DriveStep[] = [
  {
    popover: {
      title: "Your Learning Analytics 📊",
      description:
        "Track your performance, quiz scores, and learning progress all in one place!",
      side: "over",
    },
  },
];

export const pointsTour: DriveStep[] = [
  {
    popover: {
      title: "Earn Rewards! 🏆",
      description:
        "Complete activities and quizzes to earn points. Track your achievements and see how you're doing!",
      side: "over",
    },
  },
];
