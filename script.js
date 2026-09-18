const supabaseUrl = "https://gwxjvrwyeuiylaoknmqe.supabase.co";
const supabaseKey = "sb_publishable_9uXJEvQ9XvIYvwzrThTy9Q_s1CKhWcO";

const db = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

async function checkSession() {
    const { data, error } = await db.auth.getSession();

    if (error) {
        console.error("Error checking session:", error);
        return;
    }

    if (data.session) {
        console.log("User is logged in:", data.session.user.email);
        getActivities();
    } else {
        console.log("No active session.");
        window.location.href = "login.html";
    }
}

async function getActivities() {
    const { data, error } = await db
        .from("activities")
        .select("*")
        .order("id", { ascending: true });;

    if (error) {
        console.error("Error fetching activities:", error);
        return;
    }

    console.log("Activities:", data);

    renderActivities(data);
}

function renderActivities(activities) {
    const activitiesList = document.getElementById("activities-list");

    activitiesList.innerHTML = "";

    activities.forEach(activity => {
        const activityElement = document.createElement("div");
        activityElement.classList.add("activity");

        activityElement.innerHTML = `
            <div class="activity-row">

                <button class="edit-button">⋮</button>

                <input
                    type="checkbox"
                    class="activity-checkbox"
                    ${activity.completed ? "checked" : ""}
                >

                <button class="activity-title">
                    ${activity.title}
                </button>

                ${activity.completed_date
                ? `<small>${activity.completed_date}</small>`
                : ""
            }

            </div>            

            <div class="activity-description">
                ${activity.description}
            </div>
        `;

        const checkbox = activityElement.querySelector(".activity-checkbox");
        const title = activityElement.querySelector(".activity-title");
        const description = activityElement.querySelector(".activity-description");
        const editButton = activityElement.querySelector(".edit-button");

        checkbox.addEventListener("change", async () => {
            const saved = await updateActivity(activity.id, checkbox.checked);

            if (saved && checkbox.checked) {
                openImageChoice(activity.id);
            }
        });

        title.addEventListener("click", () => {
            description.classList.toggle("show");
        });

        editButton.addEventListener("click", () => {
            openEditPopup(activity);
        });

        activitiesList.appendChild(activityElement);
    });
}

async function updateActivity(id, completed) {
    const completedDate = completed
        ? new Date().toISOString().split("T")[0]
        : null;

    const { error } = await db
        .from("activities")
        .update({
            completed: completed,
            completed_date: completedDate
        })
        .eq("id", id);

    if (error) {
        console.error("Error updating activity:", error);
        return false;
    }

    getActivities();
    return true;
}

async function uploadImageFile(activityId, file) {
    const { data: sessionData } = await db.auth.getSession();

    const userId = sessionData.session.user.id;
    const extension = file.name.split(".").pop();
    const filePath = `${userId}/${activityId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await db.storage
        .from("activity-images")
        .upload(filePath, file);

    if (uploadError) {
        console.error("Error uploading image:", uploadError);
        alert(`Could not upload image: ${uploadError.message}`);
        return null;
    }

    const { data } = db.storage
        .from("activity-images")
        .getPublicUrl(filePath);

    return data.publicUrl;
}

function openEditPopup(activity) {
    const popup = document.createElement("div");

    popup.classList.add("edit-popup");

    popup.innerHTML = `
        <div class="edit-popup-content">

            <h2>Edit Activity</h2>

            <label>
                Title
                <input
                    type="text"
                    id="edit-title"
                    value="${activity.title}"
                >
            </label>

            <label>
                Description
                <textarea id="edit-description">${activity.description}</textarea>
            </label>

            <label>
                Date completed
                <input
                    type="date"
                    id="edit-date"
                    value="${activity.completed_date || ""}"
                >
            </label>         
            
            <label>
                Change photo
                <input
                    type="file"
                    id="edit-image"
                    accept="image/*"
                >
            </label>

            ${activity.image_url
            ? `
                        <img
                            class="edit-image-preview"
                            src="${activity.image_url}"
                            alt="${activity.title}"
                        >

                        <label class="remove-image-label">
                            <input type="checkbox" id="remove-image">
                            Remove current photo
                        </label>
                    `
            : ""
        }

            <div class="edit-popup-buttons">
                <button class="cancel-edit">Cancel</button>
                <button class="save-edit">Save</button>
            </div>

        </div>
    `;

    document.body.appendChild(popup);

    const saveButton = popup.querySelector(".save-edit");
    const cancelButton = popup.querySelector(".cancel-edit");

    saveButton.addEventListener("click", async () => {
        const title = popup.querySelector("#edit-title").value;
        const description = popup.querySelector("#edit-description").value;
        const completedDate = popup.querySelector("#edit-date").value;
        const imageFile = popup.querySelector("#edit-image").files[0];
        const removeImage = popup.querySelector("#remove-image")?.checked;

        let imageUrl = activity.image_url;

        if (removeImage) {
            imageUrl = null;
        }

        if (imageFile) {
            imageUrl = await uploadImageFile(activity.id, imageFile);

            if (!imageUrl) {
                return;
            }
        }

        const { error } = await db
            .from("activities")
            .update({
                title: title.trim(),
                description: description.trim(),
                completed: Boolean(completedDate),
                completed_date: completedDate || null,
                image_url: imageUrl
            })
            .eq("id", activity.id);

        if (error) {
            console.error("Error saving activity:", error);
            return;
        }

        console.log("Activity saved!");

        popup.remove();

        getActivities();
    });

    cancelButton.addEventListener("click", () => {
        popup.remove();
    });
}

function openImageChoice(activityId) {
    const popup = document.createElement("div");

    popup.classList.add("edit-popup");

    popup.innerHTML = `
        <div class="image-choice-popup">
            <p class="eyebrow">Activity complete</p>
            <h2>Add a memory?</h2>
            <p>Upload a photo now, or come back to it later from your Supabase row.</p>

            <div class="edit-popup-buttons">
                <button class="later-button">Later</button>
                <button class="upload-button">Upload photo</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    popup.querySelector(".later-button").addEventListener("click", () => {
        popup.remove();
    });

    popup.querySelector(".upload-button").addEventListener("click", () => {
        popup.remove();
        uploadActivityImage(activityId);
    });
}

async function uploadActivityImage(activityId) {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";

    input.addEventListener("change", async () => {
        const file = input.files[0];

        if (!file) {
            return;
        }

        const { data: sessionData } = await db.auth.getSession();
        const userId = sessionData.session.user.id;

        const extension = file.name.split(".").pop();
        const filePath = `${userId}/${activityId}-${Date.now()}.${extension}`;

        const { error: uploadError } = await db.storage
            .from("activity-images")
            .upload(filePath, file);

        if (uploadError) {
            console.error("Error uploading image:", uploadError);
            return;
        }

        const { data: urlData } = db.storage
            .from("activity-images")
            .getPublicUrl(filePath);

        const { error: updateError } = await db
            .from("activities")
            .update({
                image_url: urlData.publicUrl
            })
            .eq("id", activityId);

        if (updateError) {
            console.error("Error saving image URL:", updateError);
            return;
        }

        getActivities();
    });

    input.click();
}

checkSession();
