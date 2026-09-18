const supabaseUrl = "https://gwxjvrwyeuiylaoknmqe.supabase.co";
const supabaseKey = "sb_publishable_9uXJEvQ9XvIYvwzrThTy9Q_s1CKhWcO";

const db = window.supabase.createClient(supabaseUrl, supabaseKey);

const journeyDays = 30;

async function checkSession() {
    const { data, error } = await db.auth.getSession();

    if (error || !data.session) {
        window.location.href = "login.html";
        return;
    }

    renderJourneyCards();
    getCompletedActivities();
}

async function getCompletedActivities() {
    const { data, error } = await db
        .from("activities")
        .select("*")
        .eq("completed", true)
        .not("journey_order", "is", null)
        .order("journey_order", { ascending: true });

    if (error) {
        console.error("Error fetching completed activities:", error);
        return;
    }

    renderCompletedActivities(data);
}

function renderJourneyCards() {
    const journeyCalendar = document.getElementById("journey-calendar");

    journeyCalendar.innerHTML = "";

    for (let i = 1; i <= journeyDays; i++) {
        const card = document.createElement("div");

        card.classList.add("calendar-day");
        card.dataset.order = i;

        card.innerHTML = `
            <span class="calendar-number">${i}</span>
            <div class="calendar-content"></div>
        `;

        journeyCalendar.appendChild(card);
    }
}

function renderCompletedActivities(activities) {
    activities.forEach(activity => {
        const card = document.querySelector(
            `.calendar-day[data-order="${activity.journey_order}"]`
        );

        if (!card) {
            return;
        }

        const content = card.querySelector(".calendar-content");

        content.innerHTML = `
            ${
                activity.image_url
                    ? `<img src="${activity.image_url}" alt="${activity.title}">`
                    : `<div class="image-placeholder">?</div>`
            }

            <p class="calendar-title">${activity.title}</p>
        `;
    });
}

checkSession();