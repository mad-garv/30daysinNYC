const supabaseUrl = "https://gwxjvrwyeuiylaoknmqe.supabase.co";
const supabaseKey = "sb_publishable_9uXJEvQ9XvIYvwzrThTy9Q_s1CKhWcO";

const db = window.supabase.createClient(supabaseUrl, supabaseKey);

async function checkSession() {
    const { data, error } = await db.auth.getSession();

    if (error || !data.session) {
        window.location.href = "login.html";
        return;
    }

    getActivities();
}

async function getActivities() {
    const { data, error } = await db
        .from("activities")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        console.error("Error fetching activities:", error);
        return;
    }

    renderJourneyCards(data);
}

function renderJourneyCards(activities) {
    const journeyCalendar = document.getElementById("journey-calendar");

    journeyCalendar.innerHTML = "";

    for (let cardNumber = 1; cardNumber <= 30; cardNumber++) {
        const activity = activities.find(
            activity => Number(activity.id) === cardNumber
        );

        const card = document.createElement("div");
        card.classList.add("calendar-day");

        if (activity && activity.completed) {
            card.classList.add("is-completed");
        }

        if (activity && activity.completed && activity.image_url) {
            card.classList.add("has-image");
        }

        card.innerHTML = `
            ${!activity || !activity.completed
                        ? `<span class="calendar-number">${cardNumber}</span>`
                        : ""
                    }

            <div class="calendar-content">
                ${activity && activity.completed
                        ? activity.image_url
                            ? `<img src="${activity.image_url}" alt="${activity.title}">`
                            : `<div class="image-placeholder">?</div>`
                        : ""
                    }

                ${activity && activity.completed
                        ? `<p class="calendar-title">${activity.title}</p>`
                        : ""
                    }
            </div>
        `;
        journeyCalendar.appendChild(card);
    }
}

checkSession();
