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

const takePhoto = document.getElementById("takePhoto");
const photoInput = document.getElementById("photoInput");
const preview = document.getElementById("preview");
const background = document.getElementById("background");
const commentSection = document.getElementById("commentSection");

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

    background.style.backgroundImage=`url(${url})`;
    background.style.display="block";

    takePhoto.style.display="none";

    commentSection.style.display="block";

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

    alert("Foto caricata!");

    resetPage();

}

function resetPage(){

    selectedFile=null;

    photoInput.value="";

    preview.src="";
    preview.style.display="none";

    background.style.display="none";

    document.getElementById("comment").value="";

    commentSection.style.display="none";

    takePhoto.style.display="block";

}