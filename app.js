const SUPABASE_URL = "https://sjrgwfnxpzwqtehfvduu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmd3Zm54cHp3cXRlaGZ2ZHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODQwNjMsImV4cCI6MjEwMDk2MDA2M30.K1bxrpcuhfpZIkmhLKFYkJ2b1VIRDODnaDgYH-Jekpw";

const xCustomPass = new URLSearchParams(window.location.search).get("xcustompass") || "";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY, {
  global: {
    headers: {
      'X-Custom-Pass': xCustomPass,
    },
  },
}
);


const video = document.getElementById("camera");


let selectedFile = null;
let orientationPermissionRequested = false;
let gyroOrientation = {
    available: false,
    landscape: false,
    beta: 0,
    gamma: 0,
    lastUpdate: 0,
};

function setViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
}

window.addEventListener("resize", setViewportHeight);
window.addEventListener("orientationchange", setViewportHeight);
setViewportHeight();
getPhotoRotationDegrees();

document.addEventListener("DOMContentLoaded", () => {

    const input = document.getElementById("photoInput");
    const statusBox = document.getElementById("status");
    const uploadScreen = document.getElementById("uploadScreen");
    const logo = document.getElementById("logo");

    input?.addEventListener("change", function(e) {

        console.log("File selezionato");

        selectedFile = e.target.files[0];

        console.log(selectedFile);


        if (!selectedFile) {
            return;
        }


        const url = URL.createObjectURL(selectedFile);

        console.log("Preview URL:", url);


        const img = document.getElementById("previewImage");

        img.src = url;


        uploadScreen.classList.add("hidden");


        document
            .getElementById("previewScreen")
            .classList.remove("hidden");


    });

    checkLoginAndStart(statusBox, uploadScreen);

});

async function checkLoginAndStart(statusBox, uploadScreen) {
    statusBox.textContent = "Verifico l'accesso...";

    const { data, error } = await supabaseClient
        .from("login")
        .select("*")
        .limit(1)
        .maybeSingle();

    if (error || !data || data.id !== 1 ) {
        statusBox.textContent = "Accesso negato: impossibile attivare la videocamera.";
        uploadScreen.classList.add("hidden");
        setTimeout(() => statusBox.classList.add("hidden"), 5000);
        return;
    }

    statusBox.textContent = "Accesso autorizzato. Fotocamera attiva.";
    uploadScreen.classList.remove("hidden");
    setTimeout(() => statusBox.classList.add("hidden"), 5000);
    await startCamera();
}

async function sendPhoto(){


    const filename =
        crypto.randomUUID()
        + "-"
        + selectedFile.name;



    const { data, error } = await supabaseClient
        .storage
        .from("photos")
        .upload(filename, selectedFile);
    
    
    if (error) {
        console.error(error);
        return;
    }
    
    console.log("DATA:", data);
    console.log("ERROR:", error);
    const photoId = data.id;
    console.log("ID foto:", photoId);



    const comment =
        document
        .getElementById("comment")
        .value;



    await supabaseClient
    .from("photos_comments")
    .insert({

        filename: filename,
        photo_id: photoId,
        comment: comment,
        created_at: new Date()

    });



    showSuccessMessage();

}

function showSuccessMessage() {
    const overlay = document.getElementById("successOverlay");
    const okButton = document.getElementById("successOk");

    overlay?.classList.remove("hidden");

    okButton?.addEventListener("click", () => {
        overlay?.classList.add("hidden");
        resetUpload();
    }, { once: true });
}


function resetUpload() {

    selectedFile = null;

    // pulisce il campo file
    document.getElementById("takePhoto").value = "";

    // pulisce immagine preview
    document.getElementById("previewImage").src = "";

    // pulisce commento
    document.getElementById("comment").value = "";


    // torna alla schermata iniziale
    document
        .getElementById("previewScreen")
        .classList.add("hidden");


    document
        .getElementById("uploadScreen")
        .classList.remove("hidden");

}

async function startCamera(){

    const fallback = document.getElementById("cameraFallback");

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video:{
                facingMode:"user",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio:false
        });

        video.srcObject = stream;
        video.style.transform = "scaleX(1)";
        video.style.webkitTransform = "scaleX(-1)";
        video.style.transformOrigin = "center center";
        video.play().catch(() => {});
        fallback?.classList.add("hidden");
    } catch (error) {
        console.error("Errore fotocamera:", error);
        fallback?.classList.remove("hidden");

        const statusBox = document.getElementById("status");
        if (statusBox) {
            statusBox.textContent = "Impossibile accedere alla fotocamera. Consenti i permessi o apri la pagina su HTTPS.";
            statusBox.classList.remove("hidden");
        }
    }

}

function updateGyroOrientation(event) {
    if (typeof event?.beta !== "number" || typeof event?.gamma !== "number") {
        return;
    }

    const landscape = Math.abs(event.gamma) > 45;
    gyroOrientation = {
        available: true,
        landscape,
        beta: event.beta,
        gamma: event.gamma,
        lastUpdate: Date.now(),
    };
}

function startOrientationTracking() {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
        return;
    }

    window.addEventListener("deviceorientation", (event) => {
        updateGyroOrientation(event);
    }, true);

    window.addEventListener("orientationchange", () => {
        gyroOrientation.available = false;
        gyroOrientation.landscape = false;
        gyroOrientation.beta = 0;
        gyroOrientation.gamma = 0;
        gyroOrientation.lastUpdate = 0;
    });
}

function registerOrientationPermissionPrompt() {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
        return;
    }

    const triggerPermission = () => {
        ensureOrientationPermission();
    };

    window.addEventListener("pointerdown", triggerPermission, { once: true });
    window.addEventListener("touchstart", triggerPermission, { once: true });
    window.addEventListener("click", triggerPermission, { once: true });
}

async function ensureOrientationPermission() {
    if (typeof DeviceOrientationEvent === "undefined") {
        return false;
    }

    if (typeof DeviceOrientationEvent.requestPermission !== "function") {
        return true;
    }

    if (orientationPermissionRequested) {
        return gyroOrientation.available;
    }

    try {
        const response = await DeviceOrientationEvent.requestPermission();
        orientationPermissionRequested = true;
        return response === "granted";
    } catch (error) {
        console.warn("Impossibile richiedere il permesso per il giroscopio:", error);
        return false;
    }
}

function getPhotoRotationDegrees() {
    if (gyroOrientation.available && Date.now() - gyroOrientation.lastUpdate < 1000) {
        if (gyroOrientation.gamma < -45) {
            return 90;
        }

        if (gyroOrientation.gamma > 45) {
            return -90;
        }

        if (Math.abs(gyroOrientation.beta) > 90) {
            return 180;
        }
    }

    if (window.orientation !== undefined) {
        return -window.orientation;
    }

    const orientationType = screen?.orientation?.type;
    if (orientationType?.includes("landscape-primary")) {
        return -90;
    }

    if (orientationType?.includes("landscape-secondary")) {
        return 90;
    }

    return 0;
}

async function capturePhotoFromVideo() {
    const canvas = document.getElementById("canvas");
    const sourceWidth = video.videoWidth || video.clientWidth || 1280;
    const sourceHeight = video.videoHeight || video.clientHeight || 720;
    const rotationDegrees = getPhotoRotationDegrees();
    const needsRotation = rotationDegrees !== 0;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sourceWidth;
    tempCanvas.height = sourceHeight;

    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.save();
    tempCtx.translate(sourceWidth, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
    tempCtx.restore();

    if (!needsRotation) {
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0, sourceWidth, sourceHeight);
        return canvas;
    }

    const rotationRadians = (rotationDegrees * Math.PI) / 180;
    const rotatedCanvas = document.createElement("canvas");
    rotatedCanvas.width = Math.abs(rotationDegrees) === 90 ? sourceHeight : sourceWidth;
    rotatedCanvas.height = Math.abs(rotationDegrees) === 90 ? sourceWidth : sourceHeight;

    const rotatedCtx = rotatedCanvas.getContext("2d");
    rotatedCtx.save();
    rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedCtx.rotate(rotationRadians);
    rotatedCtx.drawImage(tempCanvas, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
    rotatedCtx.restore();

    canvas.width = rotatedCanvas.width;
    canvas.height = rotatedCanvas.height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(rotatedCanvas, 0, 0);

    return canvas;
}

startOrientationTracking();
registerOrientationPermissionPrompt();

const takePhoto = document.getElementById("takePhoto");

if (takePhoto) {
    takePhoto.addEventListener("click", async () => {
    await ensureOrientationPermission();

    const canvas = await capturePhotoFromVideo();

    canvas.toBlob((blob)=>{

        selectedFile = new File(
            [blob],
            crypto.randomUUID()+".jpg",
            {
                type:"image/jpeg"
            }
        );


        const url = URL.createObjectURL(blob);


        document
        .getElementById("previewImage")
        .src=url;

        document.getElementById("comment").value = "";

        document
        .getElementById("uploadScreen")
        .classList.add("hidden");


        document
        .getElementById("previewScreen")
        .classList.remove("hidden");


    },
    "image/jpeg",
    0.85);


    });
}
