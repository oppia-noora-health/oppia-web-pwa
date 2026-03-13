import Image from "next/image";

const Hero = () => {
  return (
    <div className="hidden pb-20 lg:flex flex-col lg:flex-1 bg-[url('/login/bg.png')] bg-top-right bg-cover bg-no-repeat items-center justify-center p-12 relative overflow-hidden">
      <Image
        src="/login/login-illustration.png"
        alt="Welcome to Noora Academy"
        width={600}
        height={600}
        className="object-contain"
        priority
      />

      <div className="relative z-10 mt-8 text-center text-white max-w-lg ">
        <h1 className="text-4xl font-bold mb-8">Welcome to Noora Academy</h1>
        <p className="text-lg text-[#CFD9E0]">
          Noora Academy is a mobile learning platform for delivering learning
          content, video and quizzes
        </p>
      </div>
    </div>
  );
};

export default Hero;
