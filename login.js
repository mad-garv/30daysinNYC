const supabaseUrl = "https://gwxjvrwyeuiylaoknmqe.supabase.co";
const supabaseKey = "sb_publishable_9uXJEvQ9XvIYvwzrThTy9Q_s1CKhWcO";


const db = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const { data, error } = await db.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error("Login error:", error);
        loginMessage.textContent = "Login failed. Check your email and password.";
        return;
    }

    console.log("Logged in:", data);
    console.log("Redirecting now...");

    window.location.href = "index.html";
});