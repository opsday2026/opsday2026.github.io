const SUPABASE_URL = "https://sjrgwfnxpzwqtehfvduu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmd3Zm54cHp3cXRlaGZ2ZHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODQwNjMsImV4cCI6MjEwMDk2MDA2M30.K1bxrpcuhfpZIkmhLKFYkJ2b1VIRDODnaDgYH-Jekpw";

const xCustomPass =
    new URLSearchParams(location.search).get("xcustompass") || "";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        global:{
            headers:{
                "X-Custom-Pass":xCustomPass
            }
        }
    }
);

let selectedFile = null;

const takePhoto = document.getElementById("takePhotoButton");
const photoInput = document.getElementById("photoInput");
const preview = document.getElementById("previewImage");
const background = document.getElementById("background");
// const commentSection = document.getElementById("commentSection");
const statusBox = document.getElementById("status");
const uploadScreen = document.getElementById("uploadScreen");
const content = document.getElementById("content");
const unauthorized = document.getElementById("unauthorized");

checkLoginAndStart(statusBox, uploadScreen);
takePhoto.onclick = () => {

    photoInput.click();

};

async function resizeImageFile(file, maxWidth = 1920, maxHeight = 1080, quality = 0.85) {
    if (!file || !file.type.startsWith("image/")) {
        return file;
    }

    const imageUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imageUrl;
        });

        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        const shortSide = Math.min(width, height);
        const longSide = Math.max(width, height);
        const scale = Math.min(1, maxHeight / shortSide, maxWidth / longSide);

        if (scale >= 1) {
            return file;
        }

        const targetWidth = Math.round(width * scale);
        const targetHeight = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, targetWidth, targetHeight);

        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", quality);
        });

        if (!blob) {
            return file;
        }

        const cleanName = file.name.replace(/\.[^.]+$/, "") || "photo";
        return new File([blob], `${cleanName}.jpg`, { type: "image/jpeg" });
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}

photoInput.onchange = async (e)=>{

    const file = e.target.files[0];

    if(!file)
        return;

    selectedFile = await resizeImageFile(file);

    const url = URL.createObjectURL(selectedFile);

    preview.src = url;
    preview.style.display="block";
    preview.style.objectFit="contain";

    background.style.backgroundImage=`url(${url})`;
    background.style.display="block";


    takePhoto.style.display="none";

    // commentSection.style.display="block";
    content.classList.remove("hidden");
    content.style.display="block";


}

document.getElementById("sendButton").onclick = sendPhoto;

async function sendPhoto(){

    if(!selectedFile)
        return;

    const filename =
        crypto.randomUUID() +
        "-" +
        selectedFile.name;

    const {data,error} =
        await supabaseClient
        .storage
        .from("photos")
        .upload(filename,selectedFile);

    if(error){

        alert(error.message);

        return;

    }

    const photoId = data.id;

    await supabaseClient
        .from("photos_comments")
        .insert({

            filename:filename,

            photo_id:photoId,

            comment:
                document
                .getElementById("comment")
                .value,

            created_at:
                new Date()

        });

    showSuccessMessage();

}

function showSuccessMessage() {
    const overlay = document.getElementById("successOverlay");
    const okButton = document.getElementById("successOk");

    overlay?.classList.remove("hidden");

    okButton?.addEventListener("click", () => {
        overlay?.classList.add("hidden");
        resetPage();
    }, { once: true });
}

function resetPage(){

    selectedFile=null;

    photoInput.value="";

    preview.src="";
    preview.style.display="none";

    background.style.display="none";

    document.getElementById("comment").value="";

    // commentSection.style.display="none";

    takePhoto.style.display="block";
    document
        .getElementById("content")
        .classList.add("hidden");

}


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
        unauthorized.classList.remove("hidden");
        setTimeout(() => statusBox.classList.add("hidden"), 5000);
        return;
    }

    statusBox.textContent = "Accesso autorizzato. Fotocamera attiva.";
    uploadScreen.classList.remove("hidden");
    unauthorized.classList.add("hidden");
    setTimeout(() => statusBox.classList.add("hidden"), 5000);
    
}