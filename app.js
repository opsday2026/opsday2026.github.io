const SUPABASE_URL = "https://sjrgwfnxpzwqtehfvduu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmd3Zm54cHp3cXRlaGZ2ZHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODQwNjMsImV4cCI6MjEwMDk2MDA2M30.K1bxrpcuhfpZIkmhLKFYkJ2b1VIRDODnaDgYH-Jekpw";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


let selectedFile = null;



document
.getElementById("photoInput")
.addEventListener(
"change",
function(e){


    selectedFile = e.target.files[0];


    if(!selectedFile)
        return;


    const url = URL.createObjectURL(selectedFile);


    document
    .getElementById("previewImage")
    .src=url;



    document
    .getElementById("uploadScreen")
    .classList.add("hidden");


    document
    .getElementById("previewScreen")
    .classList.remove("hidden");


});

async function sendPhoto(){


    const filename =
        crypto.randomUUID()
        + "-"
        + selectedFile.name;



    const upload =
        await supabaseClient
        .storage
        .from("photos")
        .upload(filename, selectedFile);



    if(upload.error){

        alert(upload.error.message);
        return;

    }



    const comment =
        document
        .getElementById("comment")
        .value;



    await supabaseClient
    .from("photos_comments")
    .insert({

        filename: filename,
        comment: comment,
        created_at: new Date()

    });



    alert("Foto inviata 🎉");

}
