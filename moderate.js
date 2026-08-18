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
const thumbnailGallery = document.getElementById("thumbnailGallery");
const showRejectedToggle = document.getElementById("showRejectedToggle");
const rejectedCount = document.getElementById("rejectedCount");

let pendingPhotos = [];
let allPhotos = [];
let currentPhoto = null;
let isProcessing = false;
let pollTimer = null;
let showRejected = false;

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

    // Update the photo in allPhotos array
    const photoIndex = allPhotos.findIndex(p => p.id === currentPhoto.id);
    if (photoIndex !== -1) {
        allPhotos[photoIndex].approved = nextApproved;
    }
    currentPhoto = null;
    // Re-render gallery and load next photo
    await renderThumbnailGallery();
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
    // Filter photos based on current mode (show rejected or pending)
    let photosToLoad = allPhotos.filter(p => 
        showRejected ? p.approved === 1 : p.approved === 0
    );
    console.log("Photos to load:", photosToLoad);
    if (!photosToLoad.length) {
        setEmptyState();
        await renderThumbnailGallery();
        return;
    }

    // Get the first non-viewed or first photo
    let nextPhoto = photosToLoad.find(p => !p.viewed);
    if (!nextPhoto) {
        nextPhoto = photosToLoad[0];
    }

    moderationContent?.classList.remove("hidden");
    currentPhoto = nextPhoto;

    if (!currentPhoto?.filename) {
        await loadNextPhoto();
        return;
    }

    await loadPhotoDetail(currentPhoto);
    await renderThumbnailGallery();
}

async function fetchPendingPhotos() {
    const { data, error } = await supabaseClient
        .from("photos_comments")
        .select("id, photo_id, filename, comment, created_at, viewed, approved")
        .eq("approved", 0)
        .order("id", { ascending: true });

    if (error) {
        console.error(error);
        updateStatus("Errore nel caricamento delle foto da moderare.");
        return [];
    }
    console.log("Pending photos fetched:", data);
    return data || [];
}

async function fetchRejectedPhotos() {
    const { data, error } = await supabaseClient
        .from("photos_comments")
        .select("id, photo_id, filename, comment, created_at, viewed, approved")
        .eq("approved", 1)
        .order("id", { ascending: true });

    if (error) {
        console.error(error);
        return [];
    }
    console.log("Rejected photos fetched:", data);

    return data || [];
}

async function loadAllPhotosForGallery() {
    const pending = await fetchPendingPhotos();
    const rejected = await fetchRejectedPhotos();
    allPhotos = [...pending, ...rejected];
    console.log("All photos loaded for gallery:", allPhotos);
    return allPhotos;
}

async function renderThumbnailGallery() {
    const photosToShow = showRejected ? 
        allPhotos.filter(p => p.approved === 1) : 
        allPhotos.filter(p => p.approved === 0);

    thumbnailGallery.innerHTML = "";

    for (const photo of photosToShow) {
        const thumbnail = document.createElement("div");
        thumbnail.className = "thumbnail-item";
        
        if (currentPhoto && currentPhoto.id === photo.id) {
            thumbnail.classList.add("active");
        }
        
        if (photo.approved === 2) {
            thumbnail.classList.add("approved");
        } else if (photo.approved === 1) {
            thumbnail.classList.add("rejected");
        }

        const img = document.createElement("img");
        img.alt = "Thumbnail";
        
        // Load image URL asynchronously
        getPhotoUrl(photo.filename).then(url => {
            img.src = url;
        });

        const status = document.createElement("div");
        status.className = "thumbnail-status";

        thumbnail.appendChild(img);
        thumbnail.appendChild(status);
        
        thumbnail.addEventListener("click", () => {
            currentPhoto = photo;
            loadPhotoDetail(photo);
            updateActiveThumb();
        });

        thumbnailGallery.appendChild(thumbnail);
    }
}

function updateActiveThumb() {
    document.querySelectorAll(".thumbnail-item").forEach(thumb => {
        thumb.classList.remove("active");
    });
    
    const currentThumbs = document.querySelectorAll(".thumbnail-item");
    const currentIndex = Array.from(currentThumbs).findIndex(thumb => {
        const img = thumb.querySelector("img");
        return img.src && currentPhoto && img.alt === "Thumbnail";
    });

    if (currentIndex >= 0) {
        currentThumbs[currentIndex].classList.add("active");
        currentThumbs[currentIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

async function loadPhotoDetail(photo) {
    const url = await getPhotoUrl(photo.filename);
    photoImage.src = url;
    photoComment.textContent = "Commento: " + (photo.comment || "Nessun commento disponibile.");
    photoInfo.textContent = `Foto caricata il ${new Date(photo.created_at).toLocaleString()}`;
    moderationFrame.classList.remove("hidden");
    moderationActions.classList.remove("hidden");
}

async function refreshPendingPhotos() {
    const freshPhotos = await loadAllPhotosForGallery();
    rejectedCount.textContent = ` (${allPhotos.filter(p => p.approved === 1).length})`;
    if (!freshPhotos.length) {
        return;
    }
    console.log("Refreshed pending photos:", freshPhotos);
    console.log("Current photo:", currentPhoto);
    // Update gallery if current photo was changed
    if (!currentPhoto || !allPhotos.find(p => p.id === currentPhoto.id)) {
        await loadNextPhoto();
    } else {
        await renderThumbnailGallery();
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

    await loadAllPhotosForGallery();
    rejectedCount.textContent = ` (${allPhotos.filter(p => p.approved === 1).length})`;
    await loadNextPhoto();
    startPolling();
}

showRejectedToggle?.addEventListener("change", async () => {
    showRejected = showRejectedToggle.checked;
    currentPhoto = null; // Reset current photo when toggling
    await loadNextPhoto();
});

approveButton?.addEventListener("click", () => updatePhotoDecision(2));
rejectButton?.addEventListener("click", () => updatePhotoDecision(1));

initializeModeration();

