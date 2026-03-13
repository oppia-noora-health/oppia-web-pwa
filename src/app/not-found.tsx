import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-4">
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 max-w-6xl">
        {/* Image Section - Desktop */}
        <div className="hidden md:block relative w-80 h-80">
          <Image
            src="/other/404.webp"
            alt="404 Error"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Content Section */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <h1 className="text-6xl md:text-7xl font-bold mb-4">Oops!</h1>
          <p className="text-lg md:text-xl text-gray-700 mb-8 max-w-sm">
            we couldn&apos;t ind this page
            <br />
            you are looking for
          </p>

          {/* Image Section - Mobile */}
          <div className="md:hidden relative w-72 h-72 mb-8">
            <Image
              src="/other/404.webp"
              alt="404 Error"
              fill
              className="object-contain"
              priority
            />
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[#3ABFF8] hover:bg-[#2BA8DB] text-white font-medium px-8 py-3 rounded-full transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
}
