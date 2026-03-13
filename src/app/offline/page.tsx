"use client";

import Image from "next/image";

export default function OfflinePage() {
  const handleTryAgain = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="flex flex-col items-center justify-center max-w-md w-full">
        {/* Disconnected Plugs Image */}
        <div className="relative w-64 h-64 md:w-80 md:h-80 mb-8">
          <Image
            src="/other/offline.webp"
            alt="No Internet Connection"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Content Section */}
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Connection lost...
          </h1>

          <p className="text-base md:text-lg text-gray-600 mb-8 max-w-sm">
            Look Like You Have No Internet Connection.
          </p>

          <button
            onClick={handleTryAgain}
            className="bg-[#3ABFF8] hover:bg-[#2BA8DB] text-white font-medium text-lg px-12 py-3 md:px-16 md:py-4 rounded-full transition-colors shadow-lg w-full max-w-xs">
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
