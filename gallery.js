const supabaseUrl = "https://gwxjvrwyeuiylaoknmqe.supabase.co";
const supabaseKey = "sb_publishable_9uXJEvQ9XvIYvwzrThTy9Q_s1CKhWcO";

const db = window.supabase.createClient(supabaseUrl, supabaseKey);
const currentImageIndexByActivityId = new Map();
const galleryImagesByActivityId = new Map();

let activeCarouselActivityId = null;

async function checkSession() {
    const { data, error } = await db.auth.getSession();

    if (error) {        
        return;
    }

    getActivities();
}

async function getActivities() {
    const { data, error } = await db
        .from("activities")
        .select(`
            *,
            activity_images (
                id,
                image_url,
                sort_order,
                created_at
            )
        `)
        .order("id", { ascending: true });

    if (error) {
        console.error("Error fetching activities:", error);
        return;
    }

    const activitiesWithImages = data.map(activity => {
        const relationalImages = [...(activity.activity_images || [])]
            .sort((a, b) => a.sort_order - b.sort_order);

        /*
         * Temporary backward compatibility:
         * if a legacy URL exists but was not migrated for some reason,
         * show it first rather than silently losing it.
         */
        const hasMigratedLegacyImage = relationalImages.some(
            image => image.image_url === activity.image_url
        );

        const images = activity.image_url && !hasMigratedLegacyImage
            ? [
                {
                    id: `legacy-${activity.id}`,
                    image_url: activity.image_url,
                    sort_order: -1
                },
                ...relationalImages
            ]
            : relationalImages;

        galleryImagesByActivityId.set(activity.id, images);

        if (!currentImageIndexByActivityId.has(activity.id)) {
            currentImageIndexByActivityId.set(activity.id, 0);
        }

        return {
            ...activity,
            images
        };
    });

    renderGalleryCards(activitiesWithImages);
}

function renderGalleryCards(activities) {
    const galleryGrid = document.getElementById("gallery-grid");

    galleryGrid.innerHTML = "";

    for (let cardNumber = 1; cardNumber <= 30; cardNumber++) {
        const activity = activities.find(
            activity => Number(activity.id) === cardNumber
        );

        const card = document.createElement("div");
        card.classList.add("grid-day");

        if (activity?.completed) {
            card.classList.add("is-completed");
        }

        if (activity?.id === activeCarouselActivityId) {
            card.classList.add("is-carousel-active");
        }

        const images = activity?.images || [];
        const currentIndex = currentImageIndexByActivityId.get(activity?.id) || 0;
        const currentImage = images[currentIndex];

        card.innerHTML = `
            ${
                !activity || !activity.completed
                    ? `<span class="grid-number">${cardNumber}</span>`
                    : ""
            }

            <div class="grid-content">
                ${
                    activity?.completed
                        ? images.length === 0
                            ? `<div class="image-placeholder">?</div>`
                            : images.length === 1
                                ? `<img src="${currentImage.image_url}" alt="${activity.title}">`
                                : `
                                    <div
                                        class="grid-carousel"
                                        data-activity-id="${activity.id}"
                                    >
                                        <img
                                            class="carousel-image is-current"
                                            src="${currentImage.image_url}"
                                            alt="${activity.title}"
                                        >

                                        <button
                                            class="carousel-arrow carousel-arrow--previous"
                                            type="button"
                                            aria-label="Previous image"
                                        >
                                            ←
                                        </button>

                                        <button
                                            class="carousel-arrow carousel-arrow--next"
                                            type="button"
                                            aria-label="Next image"
                                        >
                                            →
                                        </button>
                                    </div>
                                `
                        : ""
                }

                ${
                    activity?.completed
                        ? `<p class="grid-title">${activity.title}</p>`
                        : ""
                }
            </div>
        `;

        if (activity?.completed && images.length >= 2) {
            addCarouselEvents(card, activity.id);
        }

        galleryGrid.appendChild(card);
    }
}

function activateCarousel(card, activityId) {
    if (activeCarouselActivityId === activityId) {
        return;
    }

    document
        .querySelector(".grid-day.is-carousel-active")
        ?.classList.remove("is-carousel-active");

    activeCarouselActivityId = activityId;
    card.classList.add("is-carousel-active");
}

function addCarouselEvents(card, activityId) {
    const carousel = card.querySelector(".grid-carousel");
    const previousButton = card.querySelector(".carousel-arrow--previous");
    const nextButton = card.querySelector(".carousel-arrow--next");

    card.addEventListener("click", event => {
        if (event.target.closest(".carousel-arrow")) {
            return;
        }

        activateCarousel(card, activityId);
    });

    previousButton.addEventListener("click", event => {
        event.stopPropagation();
        activateCarousel(card, activityId);
        moveCarousel(card, activityId, -1);
    });

    nextButton.addEventListener("click", event => {
        event.stopPropagation();
        activateCarousel(card, activityId);
        moveCarousel(card, activityId, 1);
    });

    let startX = 0;
    let startY = 0;

    carousel.addEventListener("pointerdown", event => {
        startX = event.clientX;
        startY = event.clientY;
    });

    carousel.addEventListener("pointerup", event => {
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;

        const isHorizontalSwipe =
            Math.abs(deltaX) > 45 &&
            Math.abs(deltaX) > Math.abs(deltaY);

        if (!isHorizontalSwipe) {
            return;
        }

        activateCarousel(card, activityId);

        if (deltaX < 0) {
            moveCarousel(card, activityId, 1);
        } else {
            moveCarousel(card, activityId, -1);
        }
    });
}

function moveCarousel(card, activityId, direction) {
    const images = galleryImagesByActivityId.get(activityId);

    if (!images || images.length < 2) {
        return;
    }

    const currentIndex = currentImageIndexByActivityId.get(activityId) || 0;
    const nextIndex =
        (currentIndex + direction + images.length) % images.length;

    const carousel = card.querySelector(".grid-carousel");
    const outgoingImage = carousel.querySelector(".carousel-image.is-current");
    const incomingImage = document.createElement("img");

    incomingImage.classList.add(
        "carousel-image",
        "is-incoming",
        direction === 1 ? "from-right" : "from-left"
    );

    incomingImage.src = images[nextIndex].image_url;
    incomingImage.alt = outgoingImage.alt;

    carousel.appendChild(incomingImage);

    requestAnimationFrame(() => {
        outgoingImage.classList.add(
            "is-outgoing",
            direction === 1 ? "to-left" : "to-right"
        );

        incomingImage.classList.remove("is-incoming", "from-right", "from-left");
        incomingImage.classList.add("is-current");
    });

    outgoingImage.addEventListener("transitionend", () => {
        outgoingImage.remove();
    }, { once: true });

    currentImageIndexByActivityId.set(activityId, nextIndex);
}

checkSession();
