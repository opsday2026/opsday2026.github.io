const SUPABASE_URL = "https://sjrgwfnxpzwqtehfvduu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmd3Zm54cHp3cXRlaGZ2ZHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODQwNjMsImV4cCI6MjEwMDk2MDA2M30.K1bxrpcuhf[...] 

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const video = document.getElementById("camera");




let selectedFile = null;
let lastObjectUrl = null;


document.addEventListener("DOMContentLoaded", () => {

    const input = document.getElementById("photoInput");

    input.addEventListener("change", function(e) {

        console.log("File selezionato");

        selectedFile = e.target.files[0];

        console.log(selectedFile);


        if (!selectedFile) {
            return;
        }


        // revoca eventuale object URL precedente
        if (lastObjectUrl) {
            try { URL.revokeObjectURL(lastObjectUrl); } catch (err) { /* ignore */ }
            lastObjectUrl = null;
        }

        const url = URL.createObjectURL(selectedFile);
        lastObjectUrl = url;

        console.log("Preview URL:", url);


        const img = document.getElementById("previewImage");

        img.src = url;


        document
            .getElementById("uploadScreen")
            .classList.add("hidden");


        document
            .getElementById("previewScreen")
            .classList.remove("hidden");


    });

});



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


    alert("Foto inviata 🎉");
    resetUpload();

}


function resetUpload() {

    selectedFile = null;

    // revoca l'object URL usato per la preview (se presente)
    if (lastObjectUrl) {
        try { URL.revokeObjectURL(lastObjectUrl); } catch (e) { /* ignore */ }
        lastObjectUrl = null;
    }

    // pulisce il campo file (photoInput NON takePhoto)
    const photoInput = document.getElementById("photoInput");
    if (photoInput) photoInput.value = "";

    // pulisce immagine preview
    const preview = document.getElementById("previewImage");
    if (preview) {
        preview.src = "";
    }

    // pulisce commento
    const commentEl = document.getElementById("comment");
    if (commentEl) commentEl.value = "";


    // torna alla schermata iniziale
    const previewScreen = document.getElementById("previewScreen");
    if (previewScreen) previewScreen.classList.add("hidden");


    const uploadScreen = document.getElementById("uploadScreen");
    if (uploadScreen) uploadScreen.classList.remove("hidden");

}

async function startCamera(){

    const stream = await navigator.mediaDevices.getUserMedia({

        video:{
            facingMode:"user"
        },

        audio:false

    });


    video.srcObject = stream;

}

const takePhoto = document.getElementById("takePhoto");



takePhoto.addEventListener("click", () => {


    const canvas = document.getElementById("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;


    const ctx = canvas.getContext("2d");


    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );


    canvas.toBlob((blob)=>{


        selectedFile = new File(
            [blob],
            crypto.randomUUID()+".jpg",
            {
                type:"image/jpeg"
            }
        );


        // revoca eventuale object URL precedente
        if (lastObjectUrl) {
            try { URL.revokeObjectURL(lastObjectUrl); } catch (err) { /* ignore */ }
            lastObjectUrl = null;
        }

        const url = URL.createObjectURL(blob);
        lastObjectUrl = url;


        document
        .getElementById("previewImage")
        .src=url;


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


startCamera();
