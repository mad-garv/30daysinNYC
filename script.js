const supabaseUrl = "https://gwxjvrwyeuiylaoknmqe.supabase.co";
const supabaseKey = "sb_publishable_9uXJEvQ9XvIYvwzrThTy9Q_s1CKhWcO";

const db = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

const MAX_IMAGES_PER_ACTIVITY = 6;

function renderNav(isLoggedIn) {
    const nav = document.querySelector("#site-nav");

    if (!nav) {
        return;
    }

    nav.innerHTML = `
        ${
            !isLoggedIn
                ? `<a href="login.html">Login</a>`
                : ""
        }

        <a href="index.html">Checklist</a>
        <a href="gallery.html">Gallery</a>
    `;

    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
        nav.addEventListener("click", function (event) {
            if (!nav.classList.contains("is-open")) {
                event.preventDefault();
                nav.classList.add("is-open");
            }
        });
    
        document.addEventListener("click", function (event) {
            if (!nav.contains(event.target)) {
                nav.classList.remove("is-open");
            }
        });
    }
}

async function checkSession() {
    const { data, error } = await db.auth.getSession();

    if (error) {
        console.error("Error checking session:", error);
        return;
    }

    const isLoggedIn = Boolean(data.session);

    window.isLoggedIn = isLoggedIn;

    renderNav(isLoggedIn);

    getActivities();
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
    if (!window.isLoggedIn) {
        editButton.style.display = "none";
        checkbox.disabled = true;
    }

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
            if (!window.isLoggedIn) {
                checkbox.checked = activity.completed;
                return;
            }

            const saved = await updateActivity(activity.id, checkbox.checked);

            if (saved && checkbox.checked) {
                openImageChoice(activity.id);
            }
        });

        title.addEventListener("click", () => {
            description.classList.toggle("show");
        });

        editButton.addEventListener("click", () => {
            if (!window.isLoggedIn) {
                return;
            }

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

async function uploadImageFiles(activityId, files) {
    const selectedFiles = Array.from(files);

    if (selectedFiles.length === 0) {
        return;
    }

    const { data: existingImages, error: existingImagesError } = await db
        .from("activity_images")
        .select("id, sort_order")
        .eq("activity_id", activityId)
        .order("sort_order", { ascending: true });

    if (existingImagesError) {
        throw existingImagesError;
    }

    if (existingImages.length + selectedFiles.length > MAX_IMAGES_PER_ACTIVITY) {
        throw new Error(
            `You can add up to ${MAX_IMAGES_PER_ACTIVITY} images per activity.`
        );
    }

    const { data: sessionData } = await db.auth.getSession();
    const userId = sessionData.session.user.id;

    const lastSortOrder = existingImages.length
        ? existingImages[existingImages.length - 1].sort_order
        : -1;

    const uploadedPaths = [];
    const insertedImageIds = [];

    try {
        for (const [index, file] of selectedFiles.entries()) {
            const extension = file.name.split(".").pop();
            const filePath =
                `${userId}/${activityId}/${crypto.randomUUID()}.${extension}`;

            const { error: uploadError } = await db.storage
                .from("activity-images")
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            uploadedPaths.push(filePath);

            const { data: urlData } = db.storage
                .from("activity-images")
                .getPublicUrl(filePath);

            const { data: insertedImage, error: insertError } = await db
                .from("activity_images")
                .insert({
                    activity_id: activityId,
                    image_url: urlData.publicUrl,
                    sort_order: lastSortOrder + index + 1
                })
                .select("id")
                .single();

            if (insertError) {
                throw insertError;
            }

            insertedImageIds.push(insertedImage.id);
        }
    } catch (error) {
        /*
         * Compensation cleanup:
         * remove only records/files created in this attempted upload.
         */
        if (insertedImageIds.length) {
            await db
                .from("activity_images")
                .delete()
                .in("id", insertedImageIds);
        }

        if (uploadedPaths.length) {
            await db.storage
                .from("activity-images")
                .remove(uploadedPaths);
        }

        throw error;
    }
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
                Add photos
                <input
                    type="file"
                    id="edit-images"
                    accept="image/*"
                    multiple
                >
            </label>

            

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
        const imageFiles = popup.querySelector("#edit-images").files;

        const { error } = await db
            .from("activities")
            .update({
                title: title.trim(),
                description: description.trim(),
                completed: Boolean(completedDate),
                completed_date: completedDate || null
            })
            .eq("id", activity.id);

        if (error) {
            console.error("Error saving activity:", error);
            return;
        }

        try {
            await uploadImageFiles(activity.id, imageFiles);
        } catch (error) {
            console.error("Error adding photos:", error);
            alert(`Activity details were saved, but photos were not added: ${error.message}`);
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
            <p>Upload a photo now, or come back to it later.</p>

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
    input.multiple = true;

    input.addEventListener("change", async () => {
        if (input.files.length === 0) {
            return;
        }

        try {
            await uploadImageFiles(activityId, input.files);
            getActivities();
        } catch (error) {
            console.error("Error uploading photos:", error);
            alert(`Could not add photos: ${error.message}`);
        }
    });

    input.click();
}

checkSession();
