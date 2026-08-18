const SUPABASE_URL = "https://sjrgwfnxpzwqtehfvduu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmd3Zm54cHp3cXRlaGZ2ZHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODQwNjMsImV4cCI6MjEwMDk2MDA2M30.K1bxrpcuhfpZIkmhLKFYkJ2b1VIRDODnaDgYH-Jekpw";

const xCustomPass = new URLSearchParams(window.location.search).get("xcustompass") || "";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        global: {
            headers: {
                'X-Custom-Pass': xCustomPass,
            },
        },
    }
);

const statusBox = document.getElementById("status");
const photoImage = document.getElementById("photoImage");
const photoComment = document.getElementById("photoComment");
const photoInfo = document.getElementById("photoInfo");
const playPause = document.getElementById("playPause");
const nextPhotoButton = document.getElementById("nextPhotoButton");

let latestCommentId = 0;
let photoQueue = [];
let currentIndex = 0;
let rotationTimer = null;
let fetchTimer = null;
let isPlaying = true;
let activeMode = "new";
let fallbackItems = [];

const CHECK_INTERVAL_MS = 10000;
const PHOTO_ROTATION_MS = 5000;

function shuffleArray(items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

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
        updateStatus("Accesso negato: impossibile mostrare il live wall.");
        return false;
    }

    updateStatus("Accesso autorizzato. Caricamento foto live...");
    setTimeout(() => statusBox.classList.add("hidden"), 5000);
    return true;
}

async function getPhotoUrl(filename) {
    const { data, error } = await supabaseClient
        .storage
        .from("photos")
        .createSignedUrl(filename, 60 * 60);

    if (error || !data?.signedUrl) {
        const { data: publicData } = supabaseClient
            .storage
            .from("photos")
            .getPublicUrl(filename);
        return publicData?.publicUrl || "";
    }

    return data.signedUrl;
}

async function markCommentViewed(id) {
    if (!id) {
        return;
    }

    const { error } = await supabaseClient
        .from("photos_comments")
        .update({ viewed: true })
        .eq("id", id);

    if (error) {
        console.error("Errore aggiornando viewed:", error);
    }
}

async function setPhoto(photo) {
    if (!photo) {
        photoInfo.textContent = "Nessuna foto disponibile.";
        photoComment.textContent = "";
        photoImage.src = "";
        return;
    }

    photoImage.src = photo.url;
    // photoComment.textContent = photo.id + ": " + (photo.comment || "Nessun commento disponibile.");
    photoComment.textContent = (photo.comment || "");
    photoInfo.textContent = `Foto caricata il ${new Date(photo.created_at).toLocaleString()}`;

    if (!photo.viewed) {
        photo.viewed = true;
        await markCommentViewed(photo.id);
    }
}

async function showNextPhoto() {
    if (photoQueue.length === 0) {
        await ensureQueueHasItems();
    }

    const nextItem = photoQueue.shift();
    if (!nextItem) {
        return;
    }

    if (!nextItem.url) {
        nextItem.url = await getPhotoUrl(nextItem.filename);
    }

    if (nextItem.url) {
        await setPhoto(nextItem);
    }
}

function scheduleRotation() {
    if (rotationTimer) {
        clearInterval(rotationTimer);
    }

    if (!isPlaying) {
        return;
    }

    rotationTimer = setInterval(async () => {
        if (photoQueue.length === 0) {
            await ensureQueueHasItems();
        }

        if (photoQueue.length === 0) {
            return;
        }

        const item = photoQueue.shift();
        if (!item) {
            return;
        }

        if (!item.url) {
            item.url = await getPhotoUrl(item.filename);
        }

        if (item.url) {
            await setPhoto(item);
        }
    }, PHOTO_ROTATION_MS);
}

async function ensureQueueHasItems() {
    if (photoQueue.length > 0) {
        return;
    }

    if (activeMode === "new") {
        if (fallbackItems.length > 0) {
            photoQueue = [...fallbackItems];
            activeMode = "fallback";
            return;
        }

        fallbackItems = await fetchFallbackPhotos();
        if (fallbackItems.length > 0) {
            photoQueue = [...fallbackItems];
            activeMode = "fallback";
        }
        return;
    }

    if (fallbackItems.length > 0) {
        photoQueue = [...fallbackItems];
        return;
    }

    fallbackItems = await fetchFallbackPhotos();
    photoQueue = [...fallbackItems];
}

function enqueueComments(comments) {
    if (!comments || comments.length === 0) {
        return;
    }

    const newItems = comments
        .filter((row) => row.filename)
        .map((row) => ({
            id: row.id,
            filename: row.filename,
            comment: row.comment,
            created_at: row.created_at,
            viewed: !!row.viewed,
            url: null,
        }))
        .sort((a, b) => a.id - b.id);

    newItems.forEach((item) => {
        if (item.id > latestCommentId) {
            latestCommentId = item.id;
        }
    });

    if (activeMode === "new") {
        photoQueue = [...photoQueue, ...newItems];
    } else {
        photoQueue = [...newItems, ...photoQueue];
        activeMode = "new";
    }

    if (!rotationTimer && isPlaying) {
        scheduleRotation();
    }
}

async function fetchUnviewedComments() {
    const { data, error } = await supabaseClient
        .from("photos_comments")
        .select("id, photo_id, filename, comment, created_at, viewed")
        .eq("viewed", false)
        .eq("approved", 2)
        .order("id", { ascending: true })
        .limit(20);

    if (error) {
        console.error(error);
        updateStatus("Errore nel caricamento dei commenti non visualizzati.");
        return [];
    }

    return data || [];
}

async function fetchNewComments() {
    const { data, error } = await supabaseClient
        .from("photos_comments")
        .select("id, photo_id, filename, comment, created_at, viewed")
        .eq("viewed", false)
        .eq("approved", 2)
        .order("id", { ascending: true })
        .limit(20);

    if (error) {
        console.error(error);
        updateStatus("Errore nel caricamento dei nuovi commenti.");
        return [];
    }

    return data || [];
}

async function fetchFallbackPhotos() {
    const { data, error } = await supabaseClient
        .from("photos_comments")
        .select("id, photo_id, filename, comment, created_at, viewed")
        .eq("viewed", true)
        .eq("approved", 2)
        .order("id", { ascending: false })
        .limit(20);

    if (error) {
        console.error(error);
        updateStatus("Errore nel caricamento delle foto vecchie.");
        return [];
    }

    return shuffleArray(
        (data || []).filter((row) => row.filename)
    );
}

async function initializeLiveWall() {
    const loggedIn = await checkLogin();
    if (!loggedIn) {
        return;
    }

    const unviewed = await fetchUnviewedComments();
    if (unviewed.length > 0) {
        enqueueComments(unviewed);
        const firstItem = photoQueue.shift();
        if (firstItem) {
            firstItem.url = await getPhotoUrl(firstItem.filename);
            await setPhoto(firstItem);
        }
    } else {
        fallbackItems = await fetchFallbackPhotos();
        if (fallbackItems.length > 0) {
            photoQueue = [...fallbackItems];
            activeMode = "fallback";
            const firstItem = photoQueue.shift();
            if (firstItem) {
                firstItem.url = await getPhotoUrl(firstItem.filename);
                await setPhoto(firstItem);
            }
        } else {
            updateStatus("Nessuna foto trovata.");
        }
    }

    if (photoQueue.length > 0) {
        scheduleRotation();
    }

    fetchTimer = setInterval(async () => {
        if (!isPlaying) {
            return;
        }

        const newComments = await fetchNewComments();
        if (newComments.length === 0) {
            return;
        }

        enqueueComments(newComments);
    }, CHECK_INTERVAL_MS);
}

function updatePlayButton() {
    if (!playPause) return;

    // SVG icons
    const playSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 3v18l15-9L5 3z" fill="currentColor"/></svg>';
    const pauseSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor"/></svg>';

    playPause.innerHTML = isPlaying ? pauseSvg : playSvg;
    playPause.setAttribute('aria-label', isPlaying ? 'Pausa' : 'Play');
}

function togglePlayPause() {
    isPlaying = !isPlaying;
    updatePlayButton();

    if (!isPlaying) {
        if (rotationTimer) {
            clearInterval(rotationTimer);
            rotationTimer = null;
        }
        return;
    }

    if (photoQueue.length > 0 && !rotationTimer) {
        scheduleRotation();
    }
}

playPause?.addEventListener("click", () => {
    togglePlayPause();
});

nextPhotoButton?.addEventListener("click", () => {
    showNextPhoto();
});

// render initial icon state
updatePlayButton();

initializeLiveWall();
