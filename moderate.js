const SUPABASE_URL = "https://sjrgwfnxpzwqtehfvduu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmd3Zm54cHp3cXRlaGZ2ZHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODQwNjMsImV4cCI6MjEwMDk2MDA2M30.K1bxrpcuhfpZIkmhLKFYkJ2b1VIRDODnaDgYH-Jekpw";

const xCustomPass = new URLSearchParams(window.location.search).get("xcustompass") || "";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: {
        headers: {
            "X-Custom-Pass": xCustomPass,
        },
    },
});

const statusBox = document.getElementById("status");
const moderationContent = document.getElementById("moderationContent");
const photoImage = document.getElementById("photoImage");
const photoComment = document.getElementById("photoCommentMod");
const photoInfo = document.getElementById("photoInfoMod");
const approveButton = document.getElementById("approveButton");
const rejectButton = document.getElementById("rejectButton");
const moderationFrame = document.getElementById("moderationFrame");
const moderationActions = document.getElementById("moderationActions");

let pendingPhotos = [];
let currentPhoto = null;
let isProcessing = false;
let pollTimer = null;

const POLL_INTERVAL_MS = 10000;

function updateStatus(text) {
    if (statusBox) {
        statusBox.textContent = text;
    }
}

async function checkLogin() {
    const { data, error } = await supabaseClient
        .from("login")
        .select("*")
        .limit(1)
        .maybeSingle();

    if (error || !data || data.id !== 1) {
        updateStatus("Accesso negato: impossibile accedere alla moderazione.");
        return false;
    }

    updateStatus("Accesso autorizzato. Caricamento foto da moderare...");
    setTimeout(() => statusBox.classList.add("hidden"), 5000);
    return true;
}

async function getPhotoUrl(filename) {
    const { data, error } = await supabaseClient.storage.from("photos").createSignedUrl(filename, 60 * 60);

    if (error || !data?.signedUrl) {
        const { data: publicData } = supabaseClient.storage.from("photos").getPublicUrl(filename);
        return publicData?.publicUrl || "";
    }

    return data.signedUrl;
}


async function updatePhotoDecision(nextApproved) {
    if (!currentPhoto || isProcessing) {
        return;
    }

    isProcessing = true;

    const { error } = await supabaseClient
        .from("photos_comments")
        .update({
            approved: nextApproved,
            viewed: true,
        })
        .eq("id", currentPhoto.id);

    isProcessing = false;

    if (error) {
        console.error(error);
        updateStatus("Errore durante l'aggiornamento della foto.");
        return;
    }

    await loadNextPhoto();
}

function setEmptyState() {
    moderationContent?.classList.remove("hidden");
    photoImage.src = "";
    photoComment.textContent = "Nessuna foto da moderare.";
    photoInfo.textContent = "Tutte le foto sono già state esaminate.";
    moderationFrame.classList.add("hidden");
    moderationActions.classList.add("hidden");
}

async function loadNextPhoto() {
    if (!pendingPhotos.length) {
        pendingPhotos = await fetchPendingPhotos();
    }

    if (!pendingPhotos.length) {
        setEmptyState();
        return;
    }

    moderationContent?.classList.remove("hidden");
    currentPhoto = pendingPhotos.shift();

    if (!currentPhoto?.filename) {
        await loadNextPhoto();
        return;
    }

    const url = await getPhotoUrl(currentPhoto.filename);
    photoImage.src = url;
    photoComment.textContent = "Commento: " + (currentPhoto.comment || "Nessun commento disponibile.");
    photoInfo.textContent = `Foto caricata il ${new Date(currentPhoto.created_at).toLocaleString()}`;
    moderationFrame.classList.remove("hidden");
    moderationActions.classList.remove("hidden");
}

async function fetchPendingPhotos() {
    const { data, error } = await supabaseClient
        .from("photos_comments")
        .select("id, photo_id, filename, comment, created_at, viewed")
        .eq("approved", 0)
        .order("id", { ascending: true });

    if (error) {
        console.error(error);
        updateStatus("Errore nel caricamento delle foto da moderare.");
        return [];
    }

    return data || [];
}

async function refreshPendingPhotos() {
    const freshPhotos = await fetchPendingPhotos();

    if (!freshPhotos.length) {
        return;
    }

    if (!currentPhoto || !pendingPhotos.length) {
        pendingPhotos = freshPhotos;
        await loadNextPhoto();
        return;
    }

    const existingIds = new Set(pendingPhotos.map((photo) => photo.id));
    const newPhotos = freshPhotos.filter((photo) => !existingIds.has(photo.id));

    if (newPhotos.length) {
        pendingPhotos = [...newPhotos, ...pendingPhotos];
        await loadNextPhoto();
    }
}

function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }

    pollTimer = setInterval(() => {
        refreshPendingPhotos();
    }, POLL_INTERVAL_MS);
}

async function initializeModeration() {
    const loggedIn = await checkLogin();
    if (!loggedIn) {
        return;
    }

    await loadNextPhoto();
    startPolling();
}

approveButton?.addEventListener("click", () => updatePhotoDecision(2));
rejectButton?.addEventListener("click", () => updatePhotoDecision(1));

initializeModeration();
