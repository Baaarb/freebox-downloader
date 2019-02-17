/**
* Effectue une requete synchrone du type specifié (GET, POST, PUt, DELETE, ...)
* Renvoi un objet json correspondant a la reponse
* TODO : devenir asinchrone !
*/
function doRequest(type, url, params) {
    var req = new XMLHttpRequest();
    req.open(type, url, false); //synchronous
    req.send(params);
    if (req.status == 200) {
        console.log(req.responseText);
        var resJson = JSON.parse(req.responseText);
    }
    return resJson;
}


/////////////////////////////

var FBX_URL = '';
// https://[api_domain]:[freebox_port]/[api_base_url]/v[major_api_version]/

/**
* Decouverte et constriction de FBX_URL
* TODO: GESTION ERREUR
*/
function discover() {
    console.log("1.. DISCOVER...");
    var url = "http://mafreebox.freebox.fr/api_version";
    var jsonDiscover = doRequest('GET', url, null);
    console.log("API DOMMAIN : " + jsonDiscover.api_domain);
    var apiVersionMajor = parseInt(jsonDiscover.api_version);
    FBX_URL = "https://" + jsonDiscover.api_domain + ':' + jsonDiscover.https_port  + jsonDiscover.api_base_url + 'v' + apiVersionMajor + '/';
    ///LOCAL
    FBX_URL = "http://mafreebox.freebox.fr" + jsonDiscover.api_base_url + 'v' + apiVersionMajor + '/';
    console.log('DISCOVERED URL : ' + FBX_URL);
}

/**
* Envoi la raquete d'autorisation. Recupere et retransmet app_token ,et track_id
**/
function requestAuthorisation() {
    var requestAuthUrl = FBX_URL + 'login/authorize';
    var requestAuthParams = {
        "app_id":"fr.baaarb.freebox-downloader",
        "app_name":"Freebox Downloader",
        "app_version":"1.0",
        "device_name":"Navigateur"
    };

    var jsonAuthResponse = doRequest('POST', requestAuthUrl, requestAuthParams);
    //todo : exception
    //if (! jsonAuthResponse.success ) EXCEPTION
    return jsonAuthResponse;
}


var processVerifEtatValidation = null;
var countVerif;
var appliAccepteeParUtilisateur = false;

function verifReponseUtilisateur(authInfo) {
    countVerif--;
    if (countVerif == 0) {
        console.log('aucune reponse apres toutes les tentatives...');
        appliAccepteeParUtilisateur = false;
        clearInterval(processVerifEtatValidation);
    }
    else {
        $url = FBX_URL + 'login/authorize/' + authInfo.track_id;
        var userResponse = doRequest('GET', $url, null);
        switch (userResponse.result.status) {
            case 'granted':
                console.log("USER A ACCEPTE : arret des requetes de verif et stockage de app_token...")
                clearInterval(processVerifEtatValidation);
                appliAccepteeParUtilisateur = true;
                //todo: SUCCESS : STORE authInfo.app_token
                browser.storage.sync.set("app_token", authInfo.app_token);
                break;

            case 'unknown':
                console.log("Invalid ou revoqué");
                //todo : gerer revocation
                clearInterval(processVerifEtatValidation);
                appliAccepteeParUtilisateur = false;
                break;

            case 'pending':
                console.log("En attente... Encore " + countVerif + " requetes..." );
                break;

            case 'timeout':
                console.log("Timeout de la frebox" );
                clearInterval(processVerifEtatValidation);
                appliAccepteeParUtilisateur = false;
                break;

            case 'denied':
                console.log("Refus explicite de l'utilisateur" );
                clearInterval(processVerifEtatValidation);
                appliAccepteeParUtilisateur = false;
                break;

            default:
                appliAccepteeParUtilisateur = false;
        }
    }
}

/**
*  Traque la reponse de l'utilisateur.
* 10 requetes * 5 secondes de wait avant d'annuler.
* authInfo : {app_token:"xxxxxx", "track_id', "yyyyyy"}
* des que la requete /authorize/[track_id} vaut  GRANTED : OK on est authorisé : **STORE APP_TOKEN**
* PENDING : wait 5sec...
* TIMEOUT : FAIL
* DENIED : FAIL
* UNKNOWN : //TODO : gerer revocation
*/

function attendReponseUtilisateur(authInfo) {
    var maxRequest = 10;
    var waitRequest = 5;

    countVerif = maxRequest;
    processVerifEtatValidation = setInterval(verifReponseUtilisateur, waitRequest* 1000, authInfo);
    //ici : on a un etat de la reponse utilisateur dans appliAccepteeParUtilisateur
    //TODO: EDIT PAGE de PREF => OK / ERR

}


function associer() {
    console.log("démarrage de l'association avec la freebox");
    //1.discovery
    discover();
    //2.authorize
    var jsonAuthResponse = requestAuthorisation();
    //
    //3.if authorise OK...
    attendReponseUtilisateur(jsonAuthResponse.result);
}

//////////////////////////////////////////////////////////////////////////
/// ICI on ESt ASSOCOER et IL y a un app_token




document.querySelector("#btnAssocier").addEventListener("click", associer);