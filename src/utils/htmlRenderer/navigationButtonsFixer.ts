/**
 * Fix navigation buttons to work on desktop (add click handlers in addition to touchstart)
 * Noora Academy courses use custom carousel sections that require manual navigation setup
 */
export function fixNavigationButtons(wrapper: HTMLElement | null): void {
  if (!wrapper) return;

  // Find all carousel sections with slides
  const sections = wrapper.querySelectorAll(
    "content-section, audio-section, info-section, noor-section",
  );

  sections.forEach((section) => {
    const prevBtn = section.querySelector("#prevBtn");
    const nextBtn = section.querySelector("#nextBtn");

    if (!prevBtn || !nextBtn) {
      return;
    }

    // Store reference to the section's changeSlide function
    // We'll trigger navigation by simulating scroll or finding the handler
    const slides = section.querySelectorAll("slide, content");
    if (slides.length === 0) {
      return;
    }

    let currentSlide = 0;
    const slideWidth = slides[0].getBoundingClientRect().width;

    // Add click handler for prev button
    prevBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (currentSlide > 0) {
        currentSlide--;
        (section as HTMLElement).scroll({
          left: currentSlide * slideWidth,
          behavior: "smooth",
        });

        // Update button visibility
        (prevBtn as HTMLElement).style.visibility =
          currentSlide === 0 ? "hidden" : "visible";
        (nextBtn as HTMLElement).style.visibility =
          currentSlide === slides.length - 1 ? "hidden" : "visible";
      }
    });

    // Add click handler for next button
    nextBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (currentSlide < slides.length - 1) {
        currentSlide++;
        (section as HTMLElement).scroll({
          left: currentSlide * slideWidth,
          behavior: "smooth",
        });

        // Update button visibility
        (prevBtn as HTMLElement).style.visibility =
          currentSlide === 0 ? "hidden" : "visible";
        (nextBtn as HTMLElement).style.visibility =
          currentSlide === slides.length - 1 ? "hidden" : "visible";
      }
    });

    // Initialize button visibility
    (prevBtn as HTMLElement).style.visibility = "hidden";
    (nextBtn as HTMLElement).style.visibility =
      slides.length > 1 ? "visible" : "hidden";
  });
}
