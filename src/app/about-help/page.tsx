"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const highlightStyle = `
  @keyframes sectionHighlight {
    0% {
      background-color: transparent;
    }
    10% {
      background-color: rgba(34, 197, 94, 0.2);
    }
    90% {
      background-color: rgba(34, 197, 94, 0.2);
    }
    100% {
      background-color: transparent;
    }
  }
  
  .section-highlight {
    animation: sectionHighlight 2s ease-in-out;
  }
`;

const aboutSections = [
  {
    id: "about-overview",
    title: "About",
    content: `Version: 7.4.11-noora.22`,
    description: `OppiaMobile is the mobile learning platform from Digital Campus to deliver learning content, multimedia and quizzes on your smartphone. All the content and activities can be accessed and used even when you don't have an internet connection available on your mobile.`,
  },
  {
    id: "partners",
    title: "Partners",
    content: `The development of OppiaMobile is made possible with the support and collaboration of our partners:`,
    list: ["Universidad de Alcalá (UAH)"],
  },
  {
    id: "previous-funders",
    title: "Previous Funders",
    list: [
      "UK Aid (from the British people)",
      "AECID",
      "mPowering Frontline Health Workers",
      "Last Mile Health",
      "Community Health Academy",
    ],
  },
  {
    id: "contributors",
    title: "Contributors",
    content: `Acknowledgements and contributors to the code include:`,
    list: [
      "Safdar Ali & Durba Gogia – Hindi translation",
      "Roman Blanco – Spanish translation",
      "Marijs Carrin – Testing and development",
      "Joseba S. – Technical development, performance improvements and bug fixes",
      "Adrián Domínguez – Technical development, performance improvements and bug fixes",
      "Julio Berzal – Technical development, performance improvements and bug fixes",
      "Laila Hussain – Urdu translation",
      "Lebanese Alternative Learning – Arabic (Lebanese) translation and funding for drag and drop quizzes",
      "Last Mile Health – Funding for additional development",
      "David Gil de Gómez Pérez – Technical development, performance improvements and bug fixes",
      "Lex Myers",
      "Kawesi Hakim",
      "Ziirofan",
    ],
  },
];

const helpSections = [
  {
    id: "installing-new-courses",
    title: "Installing new courses",
    content: `To install a new course, from the homepage, press on the menu button and go to 'Manage courses'. This will give you a list of the courses to select to download. you will need an active internet connection to get the list of courses and to install them.`,
  },
  {
    id: "playing-media",
    title: "Playing media and videos",
    content: `When there are videos in your course, you only need to press to play on them. If you receive a message that the video could not be played, it is likely that you haven't yet downloaded that video.`,
  },
  {
    id: "points-badges",
    title: "Points, Badges and Certificates - What are they?",
    content: `Noora Academy has gamification built-in, so you will gain points, badges and certificates as you progress through the course content.`,
    subsections: [
      {
        title: "Points",
        content: `Points are given when you interact with the course content, for example, reading a page, attempting a quiz or watching a video. You will gain more points if you regularly you look at the course content.`,
      },
      {
        title: "Badges",
        content: `Badges are given when you complete a course, which means you have passed all the quizzes in the course and completed at least 80% of the other activities.`,
      },
      {
        title: "Certificates",
        content: `Some courses also give you certificates when you complete them. You can download these certificates in pdf format from the, for printing or showing to your supervisor.`,
      },
    ],
  },
  {
    id: "need-help",
    title: "Need further help or have queries/feedback?",
    content: `We hope you enjoy using Noora Academy. If you have any issues, comments, feedback etc, then please feel free to contact us via the Noora Academy Community site`,
  },
];

export default function AboutHelpPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"about" | "help">("about");

  const scrollToSection = (id: string) => {
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        const elementPosition =
          element.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - 70;
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });

        // Add highlight effect after scroll
        setTimeout(() => {
          element.classList.add("section-highlight");
          setTimeout(() => {
            element.classList.remove("section-highlight");
          }, 2000);
        }, 500);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-white">
      <style>{highlightStyle}</style>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-lg">Back</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          About & Help
        </h1>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab("about")}
            className={`px-6 py-3 text-base font-medium border-b-2 transition-colors ${
              activeTab === "about"
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            About
          </button>
          <button
            onClick={() => setActiveTab("help")}
            className={`px-6 py-3 text-base font-medium border-b-2 transition-colors ${
              activeTab === "help"
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            Help
          </button>
        </div>

        {/* About Tab Content */}
        {activeTab === "about" && (
          <div className="space-y-8">
            {aboutSections.map((section) => (
              <div key={section.id} id={section.id} className="scroll-mt-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  {section.title}
                </h2>
                {section.content && (
                  <p className="text-gray-700 text-base leading-relaxed mb-4">
                    {section.content}
                  </p>
                )}
                {section.description && (
                  <p className="text-gray-700 text-base leading-relaxed mb-4">
                    {section.description}
                  </p>
                )}
                {section.list && (
                  <ul className="space-y-2 ml-4">
                    {section.list.map((item, index) => (
                      <li key={index} className="flex gap-3">
                        <span className="w-2 h-2 rounded-full bg-cyan-600 mt-2 shrink-0"></span>
                        <span className="text-gray-700 text-base leading-relaxed">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Help Tab Content */}
        {activeTab === "help" && (
          <>
            {/* Table of Contents */}
            <div className="mb-8">
              <ul className="space-y-2">
                {helpSections.map((section) => (
                  <li key={section.id}>
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className="text-cyan-600 hover:underline text-base text-left">
                      • {section.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Content Sections */}
            <div className="space-y-8">
              {helpSections.map((section) => (
                <div key={section.id} id={section.id} className="scroll-mt-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">
                    {section.title}
                  </h2>
                  <p className="text-gray-700 text-base leading-relaxed mb-4">
                    {section.content}
                  </p>

                  {section.subsections && (
                    <div className="space-y-4 mt-4 ml-4">
                      {section.subsections.map((subsection, index) => (
                        <div key={index}>
                          <h3 className="text-base font-bold text-gray-900 mb-2">
                            {subsection.title}
                          </h3>
                          <p className="text-gray-700 text-base leading-relaxed">
                            {subsection.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
