// RealVoiceMessage — plugin dla Kettu (rodzina Vendetta/Bunny/Revenge)
//
// CO ROBI: wysyla zalaczony plik audio jako PRAWDZIWA glosowke Discorda - czyli dokladnie
// ten sam trik co dziala juz na Macu w Equicordzie (plugin "voiceMessages"): ustawia w
// zapytaniu REST do Discorda flage VOICE_MESSAGE (1 << 13) oraz pola waveform/duration_secs
// na zalaczniku. To wlasnie te trzy rzeczy sprawiaja ze Discord (backend, nie klient!) uznaje
// wiadomosc za glosowke - wiec widzi ja poprawnie KAZDY odbiorca, na kazdym kliencie, nie
// tylko w Kettu. Kod REST payloadu ponizej jest 1:1 skopiowany z dzialajacego juz pluginu na
// Macu (patrz Discord_Vencord_Equicord_Custom_Plugins w vaulcie) - ta czesc jest sprawdzona.
//
// NIEPEWNA CZESC (normalne przy kazdym modzie mobilnym, moze wymagac debugowania na zywo):
// to, pod jaka dokladnie nazwa/ksztaltem Kettu udostepnia modul do robienia zapytan REST.
// Ponizej probujemy kilku najbardziej prawdopodobnych nazw po kolei i piszemy do logu/toastu
// ktora zadzialala (albo ze zadna nie zadzialala) - zeby latwo bylo to poprawic na podstawie
// zrzutu ekranu z bledem.
//
// UZYCIE: w oknie czatu dolacz plik audio normalnie (spinacz/plus), i na POCZATKU tresci
// wiadomosci wpisz dokladnie "/voice" (reszta tekstu po spacji jest opcjonalna i zostanie
// wyslana jako podpis). Plugin przechwyci wysylke, zdejmie prefiks "/voice " z tresci, doda
// wlasciwe flagi/metadane do zalacznika audio i wysle jako prawdziwa glosowke.

const VOICE_MESSAGE_FLAG = 1 << 13; // 8192 - ta sama flaga co w oficjalnym kliencie Discorda
const DEFAULT_WAVEFORM = "AAAAAAAAAAAA"; // placka fala - wplywa TYLKO na wyglad paskow, nie na
                                          // to czy wiadomosc "liczy sie" jako glosowka
const DEFAULT_DURATION_SECS = 4; // fallback gdy nie da sie odczytac realnego czasu trwania

const PREFIX = "/voice";

let unpatch = null;

function log(...args) {
    try { vendetta?.logger?.log?.("[RealVoiceMessage]", ...args); } catch (e) { /* noop */ }
}
function err(...args) {
    try { vendetta?.logger?.error?.("[RealVoiceMessage]", ...args); } catch (e) { /* noop */ }
}
function toast(message, type) {
    try { vendetta?.ui?.toasts?.showToast?.(message, { type }); } catch (e) { /* noop */ }
}

function isAudioAttachment(att) {
    if (!att) return false;
    if (att.content_type?.startsWith?.("audio/")) return true;
    if (att.mimeType?.startsWith?.("audio/")) return true;
    if (att.filename && /\.(ogg|opus|mp3|m4a|wav|aac|flac)$/i.test(att.filename)) return true;
    return false;
}

function findAudioAttachmentIndex(attachments) {
    if (!Array.isArray(attachments)) return -1;
    return attachments.findIndex(isAudioAttachment);
}

// Przerabia body zapytania REST POST /channels/:id/messages na "glosowke", JESLI
// tresc wiadomosci zaczyna sie od "/voice" i jest dokladnie jeden zalacznik audio.
// Zwraca true jesli cos zmienilo (do logowania).
function tryTransformBody(body) {
    if (!body || typeof body.content !== "string") return false;
    if (!body.content.startsWith(PREFIX)) return false;

    const attachments = body.attachments;
    const idx = findAudioAttachmentIndex(attachments);
    if (idx === -1) {
        toast("RealVoiceMessage: dolacz plik audio przed wyslaniem /voice", "danger");
        return false;
    }

    body.content = body.content.slice(PREFIX.length).replace(/^\s/, "");
    body.flags = (body.flags || 0) | VOICE_MESSAGE_FLAG;

    const attachment = attachments[idx];
    attachment.waveform = attachment.waveform || DEFAULT_WAVEFORM;
    attachment.duration_secs = attachment.duration_secs || DEFAULT_DURATION_SECS;

    return true;
}

// Probujemy znalezc modul REST pod kilkoma najbardziej prawdopodobnymi "sygnaturami".
// findByProps w rodzinie Vendetta/Bunny zwraca modul ktory ma WSZYSTKIE podane klucze.
function findRestModule() {
    const { findByProps } = vendetta.metro;
    const candidates = [
        ["post", "get", "put", "patch", "del"],
        ["post", "get", "put", "patch"],
        ["getAPIBaseURL", "post"],
    ];
    for (const props of candidates) {
        try {
            const mod = findByProps(...props);
            if (mod?.post) {
                log("Znaleziono modul REST po propsach:", props.join(","));
                return mod;
            }
        } catch (e) { /* probuj dalej */ }
    }
    return null;
}

function onLoad() {
    const RestAPI = findRestModule();

    if (!RestAPI) {
        err("Nie znalazlem modulu REST (RestAPI) - API klienta Kettu moglo sie zmienic.");
        toast("RealVoiceMessage: nie moge sie podpiac pod wysylke (zglos Tomkowi ze findByProps nie trafil)", "danger");
        return;
    }

    const { before } = vendetta.patcher;

    unpatch = before("post", RestAPI, (args) => {
        try {
            const config = args[0];
            if (!config || typeof config.url !== "string") return;
            if (!/\/channels\/\d+\/messages$/.test(config.url)) return;

            const changed = tryTransformBody(config.body);
            if (changed) {
                log("Wyslano jako glosowke, url:", config.url);
                toast("Wysylam jako glosowke...", "success");
            }
        } catch (e) {
            err("Blad podczas przechwytywania zapytania:", e);
        }
    });

    log("Zaladowano.");
}

function onUnload() {
    try { unpatch?.(); } catch (e) { /* noop */ }
    unpatch = null;
    log("Odladowano.");
}

module.exports = { onLoad, onUnload };
