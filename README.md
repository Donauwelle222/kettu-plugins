# kettu-plugins

Pluginy do Kettu (mod Discorda na iOS, rodzina Vendetta/Bunny/Revenge).

## RealVoiceMessage

Wysyła dowolny plik audio jako PRAWDZIWĄ głosówkę Discorda (ta sama flaga/waveform/duration
co oficjalny klient desktopowy), widoczną poprawnie u każdego odbiorcy, nie tylko w Kettu.

Źródło do wklejenia w Kettu (Przeglądarka Dodatków → "+" → Install a plugin):

https://donauwelle222.github.io/kettu-plugins/RealVoiceMessage/

### Jak to działa

Dołącz pojedynczy plik audio (bez żadnego tekstu w wiadomości) i wyślij normalnie. Plugin
podczepia się pod `fetch`/`XMLHttpRequest` (realny request sieciowy, tuż przed wysłaniem do
Discorda) i dopisuje do żądania POST `/channels/:id/messages` flagę `VOICE_MESSAGE` (`1 << 13`)
oraz pola `duration_secs`/`waveform` na załączniku — dokładnie to, czego wymaga backend Discorda,
żeby uznać wiadomość za prawdziwą głosówkę, niezależnie od tego, jakiego klienta używa odbiorca.

Plik audio musi być prawidłowo zakodowany jako **OggOpus** (kontener `.ogg`, kodek `opus`) —
inne kodeki w pliku `.ogg` (np. Vorbis) mogą się wysłać, ale nie zostaną poprawnie odtworzone.
Przykładowa konwersja przez ffmpeg:

```
ffmpeg -i input.mp3 -c:a libopus -ar 48000 -ac 1 -b:a 32k voicemessage.ogg
```

Potwierdzone działanie: wysłane z Kettu na iOS, odebrane jako prawdziwa głosówka (bąbelek z
falą dźwiękową) na zupełnie nieimodowanym Discordzie desktopowym.
