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
checkLoginAndStart(statusBox, uploadScreen);
takePhoto.onclick = () => {

    photoInput.click();

};

photoInput.onchange = (e)=>{

    selectedFile = e.target.files[0];

    if(!selectedFile)
        return;

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
        setTimeout(() => statusBox.classList.add("hidden"), 5000);
        return;
    }

    statusBox.textContent = "Accesso autorizzato. Fotocamera attiva.";
    uploadScreen.classList.remove("hidden");
    setTimeout(() => statusBox.classList.add("hidden"), 5000);
    
}