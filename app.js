const SUPABASE_URL = "https://sjrgwfnxpzwqtehfvduu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmd3Zm54cHp3cXRlaGZ2ZHV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODQwNjMsImV4cCI6MjEwMDk2MDA2M30.K1bxrpcuhfpZIkmhLKFYkJ2b1VIRDODnaDgYH-Jekpw";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function uploadPhoto(){

    const file = document.getElementById("fileInput").files[0];

    if(!file){
        alert("Seleziona una foto");
        return;
    }


    const filename = crypto.randomUUID() + "-" + file.name;


    const { data, error } = await supabaseClient
        .storage
        .from("photos")
        .upload(filename, file);


    if(error){
        console.error(error);
        alert("Errore upload");
    }
    else{
        alert("Foto caricata!");
    }
}
