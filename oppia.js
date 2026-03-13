$(document).ready(function () {
  $("[name=reveal]").each(function (i) {
    var revealSection = $(this).addClass("showmore revealed");
    var target = $("#answer" + $(this).attr("id"));

    function revealContent() {
      target.addClass("revealed");
      revealSection.removeClass("revealed");
    }

    target.addClass("showmore").show();
    if (revealSection.has("button").length > 0) {
      revealSection.find("button").on("click", function () {
        inputValue = revealSection.find("input").eq(0).val();
        if (inputValue != null && inputValue != "") {
          revealContent();
        } else {
          var errorMsg = revealSection.find(".error-msg");
          if (errorMsg.length == 0) {
            errorMsg = $(
              '<div class="error-msg" style="display:none;">You have to enter some text.</div>',
            );
            revealSection.append(errorMsg);
          }
          errorMsg.fadeIn();
        }
      });
    } else {
      revealSection.on("click", revealContent);
    }
  });

  // Slider functionality
  const slides = document.querySelectorAll("slide");
  const totalSlides = slides.length;

  if (totalSlides > 0) {
    let currentSlide = 0;
    slides[currentSlide].classList.add("active");
    const slide = document.querySelector("slide");
    const sliderContainer = slide.parentNode;
    const slideStyle = window.getComputedStyle(slide);
    const slideWidth =
      slide.offsetWidth +
      parseFloat(slideStyle.marginRight) +
      parseFloat(slideStyle.marginLeft);

    if (sliderContainer.getAttribute("pagination") === "true") {
      const pagination = document.createElement("div");
      pagination.classList.add("pagination");
      for (let i = 0; i < totalSlides; i++) {
        const paginationItem = document.createElement("div");
        paginationItem.classList.add("pagination-item");
        pagination.appendChild(paginationItem);
      }
      sliderContainer.appendChild(pagination);

      // Position pagination based on container position (desktop only)
      function updatePaginationPosition() {
        if (window.innerWidth >= 768) {
          const rect = sliderContainer.getBoundingClientRect();
          const containerWidth = rect.width;

          pagination.style.position = "fixed";
          pagination.style.width = containerWidth * 0.8 + "px";
          pagination.style.left = rect.left + containerWidth * 0.1 + "px";
          pagination.style.top = rect.top + 45 + "px";
        } else {
          // Mobile: reset to default (absolute positioning from CSS)
          pagination.style.position = "";
          pagination.style.width = "";
          pagination.style.left = "";
          pagination.style.top = "";
        }
      }

      // Always bind handlers so desktop layout fixes after hydration/resizes
      updatePaginationPosition();
      window.addEventListener("resize", updatePaginationPosition);
      window.addEventListener("scroll", updatePaginationPosition);
      // Re-run after layout settles (fonts/images)
      requestAnimationFrame(updatePaginationPosition);
      setTimeout(updatePaginationPosition, 250);
    }

    const paginationItems = document.querySelectorAll(".pagination-item");
    if (paginationItems.length > 0) {
      paginationItems[0].classList.add("active");
    }

    function changeSlide(direction) {
      currentSlide = Math.max(
        0,
        Math.min(currentSlide + direction, totalSlides - 1),
      );

      slides[currentSlide].classList.add("active");
      if (direction > 0) {
        slides[currentSlide - 1].classList.remove("active");
      } else {
        slides[currentSlide + 1].classList.remove("active");
      }

      if (paginationItems.length > 0) {
        if (direction > 0) {
          paginationItems[currentSlide].classList.add("active");
        } else {
          paginationItems[currentSlide + 1].classList.remove("active");
        }
      }

      updateSlider();
    }

    function updateSlider() {
      // Get the first slide to calculate its total width including margin
      const firstSlide = slides[0];
      const slideStyle = window.getComputedStyle(firstSlide);
      const slideWidth = firstSlide.offsetWidth;
      const marginLeft = parseFloat(slideStyle.marginLeft);
      const marginRight = parseFloat(slideStyle.marginRight);
      const totalSlideWidth = slideWidth + marginLeft + marginRight;

      sliderContainer.scroll({
        left: currentSlide * totalSlideWidth,
        behavior: "smooth",
      });
      updateButtonVisibility();

      console.log("currentSlide:", currentSlide);
      console.log("slideWidth:", slideWidth);
      console.log("marginLeft:", marginLeft);
      console.log("marginRight:", marginRight);
      console.log("totalSlideWidth:", totalSlideWidth);
      console.log("scrollLeft:", currentSlide * totalSlideWidth);
    }

    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    let mouseStartX = 0;
    let mouseEndX = 0;
    let isMouseDragging = false;

    // Touch events
    sliderContainer.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    });

    function handleTouchEnd(e) {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;

      deltaX = touchEndX - touchStartX;
      deltaY = touchEndY - touchStartY;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal Scroll
        if (deltaX < 0) {
          console.log("swipe left");
          changeSlide(1); // Swipe left
        } else {
          console.log("swipe right");
          changeSlide(-1); // Swipe right
        }
      }
    }

    sliderContainer.addEventListener("touchcancel", handleTouchEnd);
    sliderContainer.addEventListener("touchend", handleTouchEnd);

    // Mouse events for desktop
    sliderContainer.addEventListener("mousedown", (e) => {
      // Don't interfere with audio seek slider dragging
      if (e.target.classList.contains("seek-slider")) {
        return;
      }
      isMouseDragging = true;
      mouseStartX = e.clientX;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (isMouseDragging) {
        mouseEndX = e.clientX;
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (isMouseDragging) {
        mouseEndX = e.clientX;
        const deltaX = mouseEndX - mouseStartX;

        if (Math.abs(deltaX) > 50) {
          if (deltaX < 0) {
            console.log("drag left");
            changeSlide(1); // Drag left
          } else {
            console.log("drag right");
            changeSlide(-1); // Drag right
          }
        }
        isMouseDragging = false;
      }
    });

    if (sliderContainer) {
      const prevBtn = document.createElement("div");
      prevBtn.id = "prevBtn";
      prevBtn.innerHTML = "&#10094;";
      prevBtn.addEventListener("click", function () {
        changeSlide(-1);
      });
      prevBtn.addEventListener("touchstart", function () {
        changeSlide(-1);
      });
      sliderContainer.appendChild(prevBtn);

      const nextBtn = document.createElement("div");
      nextBtn.id = "nextBtn";
      nextBtn.innerHTML = "&#10095;";
      nextBtn.addEventListener("click", function () {
        changeSlide(1);
      });
      nextBtn.addEventListener("touchstart", function () {
        changeSlide(1);
      });
      sliderContainer.appendChild(nextBtn);

      // Position buttons based on container position (desktop only)
      let buttonHeightCached = null;
      let prevBtnWidthCached = null;
      let nextBtnWidthCached = null;

      function updateButtonPositions() {
        if (window.innerWidth >= 768) {
          // Cache button dimensions on first call
          if (buttonHeightCached === null) {
            buttonHeightCached = prevBtn.offsetHeight;
            prevBtnWidthCached = prevBtn.offsetWidth;
            nextBtnWidthCached = nextBtn.offsetWidth;
          }

          const rect = sliderContainer.getBoundingClientRect();
          const containerHeight = rect.height;
          const containerBottom = rect.bottom;
          const containerRight = rect.right;

          prevBtn.style.position = "fixed";
          prevBtn.style.left = rect.left + rect.width * 0.1 + "px";
          prevBtn.style.top =
            containerBottom -
            containerHeight * 0.05 -
            buttonHeightCached +
            "px";
          prevBtn.style.transform = "none";
          prevBtn.style.bottom = "";

          nextBtn.style.position = "fixed";
          nextBtn.style.left =
            containerRight - rect.width * 0.1 - nextBtnWidthCached + "px";
          nextBtn.style.top =
            containerBottom -
            containerHeight * 0.05 -
            buttonHeightCached +
            "px";
          nextBtn.style.transform = "none";
          nextBtn.style.bottom = "";
        } else {
          // Mobile: reset to default (absolute positioning from CSS)
          prevBtn.style.position = "";
          prevBtn.style.left = "";
          prevBtn.style.top = "";
          prevBtn.style.transform = "";
          prevBtn.style.bottom = "";

          nextBtn.style.position = "";
          nextBtn.style.left = "";
          nextBtn.style.right = "";
          nextBtn.style.top = "";
          nextBtn.style.transform = "";
          nextBtn.style.bottom = "";
        }
      }

      // Always bind handlers so desktop layout fixes after hydration/resizes
      setTimeout(updateButtonPositions, 100);
      window.addEventListener("resize", updateButtonPositions);
      window.addEventListener("scroll", updateButtonPositions);
      // Re-run after layout settles (fonts/images)
      requestAnimationFrame(updateButtonPositions);
      setTimeout(updateButtonPositions, 250);

      function updateButtonVisibility() {
        prevBtn.style.visibility = currentSlide === 0 ? "hidden" : "visible";
        nextBtn.style.visibility =
          currentSlide === totalSlides - 1 ? "hidden" : "visible";
      }

      updateButtonVisibility();
    }
  }

  // Cards functionality
  const cards = document.querySelectorAll("card");

  if (cards.length > 0) {
    let currentCard = 0;
    cards[0].classList.add("active");
    cards[1].classList.add("next");

    $("card").on("click", function () {
      $("card").css({ "pointer-events": "none" });

      // Add styles to indicate the card is being clicked
      $("card.active")
        .css({
          transform: "scale(1.7)", // Slightly zoom in
          "background-color": "#ffcccc", // Change background color
          transition: "transform 0.3s ease, background-color 0.3s ease",
        })
        .addClass("animate-leave");

      setTimeout(function () {
        $("card.animate-leave")
          .addClass("animate-back")
          .removeClass("animate-leave");
        $("card").parent().prepend($(".animate-back"));

        // Reset the active card's transformation
        cards[currentCard].classList.remove("active");

        $("card.next").addClass("active").removeClass("next");
        currentCard = (currentCard + 1) % cards.length;

        const nextCard = cards[(currentCard + 1) % cards.length];
        nextCard.classList.add("next");

        // Add style to the next card to highlight it
        $("card.next").css({
          transform: "scale(1.05)", // Slight zoom in to highlight the next card
          "background-color": "#ccffcc", // Change background color of next card
          transition: "transform 0.3s ease, background-color 0.3s ease",
        });
      }, 300);

      setTimeout(function () {
        $("card.animate-back").removeClass("animate-back");

        // Reset styles and re-enable pointer events
        $("card").css({
          "pointer-events": "auto",
          transform: "scale(1)", // Reset the scale of all cards
          "background-color": "", // Reset the background color
        });
      }, 700);
    });
  }

  var knowMoreButtons = $("know-more item");
  if (knowMoreButtons.length) {
    var modalFade = $('<div class="modal-fade"></div>')
      .prependTo($("body"))
      .hide();
    knowMoreButtons.find("modal").append('<div class="close"></div>').hide();

    knowMoreButtons.on("click", function () {
      var button = $(this);
      var modal = button.find("modal");

      var nextBtn = button.next().length
        ? button.next()
        : knowMoreButtons.first();
      knowMoreButtons.removeAttr("highlighted");
      nextBtn.attr("highlighted", true);

      modalFade.fadeIn(300);
      modal.show().on("click", function (event) {
        event.stopPropagation();
        modal.hide();
        modalFade.fadeOut();
      });
    });
  }

  // Buttons functionality
  $("noora-button").on("click", function () {
    const clickedButton = $(this);

    if (clickedButton.attr("type") === "modal") {
      return;
    }

    const color = clickedButton.attr("color");
    if (color === "green") {
      clickedButton.attr("color", "pink");
    } else {
      clickedButton.attr("color", "green");
    }
  });

  var currentPlayIcon = null;

  $(".audio-player-container").each(function (i, elem) {
    const playerContainer = $(elem);
    const playIcon = playerContainer.find(".play-icon");
    const seekSlider = playerContainer.find(".seek-slider")[0];
    let playState = "play";

    /* Implementation of the functionality of the audio player */

    const audio = playerContainer.find("audio")[0];
    const duration = playerContainer.find(".duration");
    let raf = null;

    playIcon.on("click", () => {
      if (playState === "play") {
        if (currentPlayIcon != null) {
          currentPlayIcon.click();
        }
        playIcon.removeClass("pause");
        playIcon.addClass("play");
        audio.play();
        requestAnimationFrame(whilePlaying);
        playState = "pause";
        currentPlayIcon = playIcon;
      } else {
        playIcon.removeClass("play");
        playIcon.addClass("pause");
        audio.pause();
        cancelAnimationFrame(raf);
        playState = "play";
        currentPlayIcon = null;
      }
    });

    $(seekSlider)
      .on("input", (e) => {
        rangeInput = e.target;
        if (rangeInput === seekSlider[0]) {
          playerContainer.css(
            "--seek-before-width",
            (rangeInput.value / rangeInput.max) * 100 + "%",
          );
        }
        duration.text(calculateTime(audio.duration - seekSlider.value));
        if (!audio.paused) {
          cancelAnimationFrame(raf);
        }
      })
      .on("change", () => {
        audio.currentTime = seekSlider.value;
        if (!audio.paused) {
          requestAnimationFrame(whilePlaying);
        }
      });

    const calculateTime = (secs) => {
      const minutes = Math.floor(secs / 60);
      const seconds = Math.floor(secs % 60);
      const returnedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
      return `${minutes}:${returnedSeconds}`;
    };

    const displayDuration = () => {
      duration.text(calculateTime(audio.duration));
    };

    const setSliderMax = () => {
      seekSlider.max = Math.floor(audio.duration);
    };

    const displayBufferedAmount = () => {
      const bufferedAmount = Math.floor(
        audio.buffered.end(audio.buffered.length - 1),
      );
      playerContainer.css(
        "--buffered-width",
        `${(bufferedAmount / seekSlider.max) * 100}%`,
      );
    };

    const whilePlaying = () => {
      seekSlider.value = Math.floor(audio.currentTime);
      duration.text(calculateTime(audio.duration - seekSlider.value));
      playerContainer.css(
        "--seek-before-width",
        `${(seekSlider.value / seekSlider.max) * 100}%`,
      );
      raf = requestAnimationFrame(whilePlaying);
    };

    if (audio.readyState > 0) {
      displayDuration();
      setSliderMax();
      displayBufferedAmount();
    } else {
      audio.addEventListener("loadedmetadata", () => {
        displayDuration();
        setSliderMax();
        displayBufferedAmount();
      });
    }

    audio.addEventListener("progress", displayBufferedAmount);
  });
});

function changeAudioSource(newSource) {
  $("audio").each(function (i, audioElement) {
    audioElement.src =
      newSource + audioElement.src.replace("file:///audio/", "");
    audioElement.load();
  });
}
