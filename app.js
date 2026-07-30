const SUPABASE_URL = "IL_TUO_URL";
const SUPABASE_KEY = "LA_TUA_ANON_KEY";

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

    const filename =
        Date.now() + "_" + file.name;


    const { data, error } =
        await supabaseClient
        .storage
        .from("photos")
        .upload(filename,file);


    if(error){
        console.error(error);
        alert("Errore upload");
    }
    else{
        alert("Foto caricata!");
    }
}
