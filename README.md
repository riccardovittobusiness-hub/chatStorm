# chatStorm

**Il brainstorming con ChatGPT, visto dall'alto.**

Quando si ragiona su un'idea con un assistente AI, le conversazioni si accumulano in un elenco verticale e il quadro d'insieme si perde: quale chat approfondiva cosa, dove era nata un'alternativa, quali idee si contraddicono. chatStorm trasforma ogni conversazione in un oggetto da disporre nello spazio.

Ogni chat diventa un'**icona** sulla lavagna: dopo i primi messaggi il modello le dà un titolo, ne scrive un riassunto e disegna un'icona che ne rappresenta il contenuto. In alternativa puoi usare badge con lettere, numeri o simboli, scegliendo forma e colore. Le icone si trascinano come sul desktop, si ingrandiscono, si allineano e si collegano con frecce etichettate ("approfondisce", "contraddice", "dipende da"). Accanto alle chat puoi aggiungere note, testi e riquadri tematici, come su una lavagna di Miro.

Ogni progetto vive su una **mappa**, e le mappe sono le facce di un piano che ruota in 3D: si passa dall'una all'altra girando il piano, come in Fez.

L'AI non è solo dentro le chat, ma lavora anche sulla mappa:
- **Suggerisce collegamenti** tra idee che non avevi messo in relazione, spiegando perché.
- **Raggruppa per temi** le chat e le note in riquadri.
- **Sintetizza** la mappa o una selezione: idee principali, tensioni, domande aperte, lacune.
- **Dirama** una chat in una nuova che ne eredita tutto il contesto, per esplorare un'alternativa senza perdere l'originale.
- **Unisce** più chat in una conversazione nuova che parte dai loro riassunti.
- Ogni chat può ricevere il **contesto delle chat collegate** con le frecce.

L'app gira sul tuo computer e usa **ChatGPT tramite Codex di OpenAI**, con il tuo abbonamento ChatGPT (Plus o Pro), senza chiavi API a consumo. Chat, mappe e icone restano in un archivio locale; le icone le disegna il modello, oppure sono badge che personalizzi tu.

---

## Requisiti
- **Un Mac** (Apple Silicon o Intel). chatStorm è un'app desktop: non si usa dal browser.
- **Node.js 22.13 o più recente** ([nodejs.org](https://nodejs.org)).
- **Un account ChatGPT Plus o Pro.** Il login si fa una volta durante l'installazione e vale anche se hai già fatto
  l'accesso nell'app Codex. Le variabili `OPENAI_API_KEY` e `CODEX_API_KEY` vengono ignorate: l'app usa il tuo
  abbonamento, non una API key a consumo.

## Installazione
1. Scarica il progetto (**Code → Download ZIP** su GitHub, oppure `git clone`) e metti la cartella nella tua cartella
   **Inizio** (per esempio `~/chatStorm`). Non in Download, Scrivania o Documenti: macOS impedisce all'app di leggere
   quelle cartelle protette.
2. Fai doppio clic su **`installa.command`**. Installa le dipendenze, apre il login al tuo account ChatGPT,
   costruisce **chatStorm.app** e la mette nella cartella Applicazioni del tuo utente. Si fa una volta sola.
3. Apri **chatStorm** da Applicazioni, Launchpad o Spotlight, e trascinala nel Dock.

L'app ha una finestra sua: avvia il motore locale quando la apri e lo spegne quando la chiudi. Il motore risponde
solo all'app, con un codice segreto salvato in `data/.app-token`: se apri l'indirizzo in un browser vedi solo un invito
ad aprire l'app. I link esterni nelle chat si aprono nel browser.

L'app **si aggiorna da sola**: dopo un aggiornamento del codice basta riaprirla. Se cambiano nome, icona o
`mac/electron`, all'apertura si ricostruisce in background (`mac/aggiorna-app.sh`, log in `data/app-build.log`),
si chiude e si riapre aggiornata.

**Per chi sviluppa:** `npm run mock` apre l'interfaccia nel browser con risposte e icone simulate, senza ChatGPT.


## ChatGPT (Codex)
Le chat, i riassunti, le icone e gli strumenti della mappa usano **ChatGPT tramite il Codex SDK di OpenAI**
(`@openai/codex-sdk`), con il login ChatGPT del tuo computer.
- In ⚙ Impostazioni → Modello scegli il modello: GPT-5.6 Sol, Terra o Luna, oppure **Altro…** per scriverne un altro.
- Codex lavora in una cartella vuota in sola lettura (`data/codex-workspace`): non vede l'archivio delle chat.
- "Dirama" crea una nuova chat che riceve la conversazione come contesto.
- Perché solo ChatGPT: OpenAI permette ai progetti open source e a quelli personali che girano in locale di usare
  l'abbonamento ChatGPT dei loro utenti. Anthropic invece chiede ai prodotti costruiti con l'Agent SDK di Claude
  di usare una API key a consumo, quindi questa versione pubblica non include Claude.

## Lingua
In ⚙ Impostazioni → Generale scegli **Italiano** o **English**: cambia la lingua dell'interfaccia e quella in cui rispondono
il modello (riassunti, titoli e strumenti della mappa compresi).

## Design
L'interfaccia usa l'identità visiva di [Ci siamo](https://www.cisiamoagency.com/): fondo ghiaccio marmorizzato con grana, superfici navy
(`#1B1B39`), azioni blu (`#3965FA`) a pillola col pallino, accenti azzurri e gialli, Bricolage Grotesque con Fraunces corsivo.
Il logo è una variazione di quello di Ci siamo: al posto della mano, un occhio disegnato con lo stesso tratto (`public/img/occhio.svg`,
icona dell'app in `mac/icon.svg`).

## Icone delle chat
Si sceglie in ⚙ **Impostazioni → Icone delle chat**:
- **Disegnate dall'AI** (predefinito): dopo il primo scambio il modello riassume la chat e disegna un'icona vettoriale (SVG)
  a tratto spesso, nello stile del logo, con la palette del marchio. Nessun servizio in più: usa il tuo abbonamento. L'SVG viene ripulito da script e risorse esterne.
- **Badge standard**: lettere, numero o simbolo, con forma (arrotondato, cerchio, quadrato, esagono, rombo), colore e stile
  (sfumato o pieno) modificabili.
- **Immagine AI**: Pollinations.ai (anche senza chiave) o Cloudflare Workers AI, con chiave nelle impostazioni.

Ogni chat si può cambiare dal pannello chat → **Icona e riassunto**, oppure dal pulsante **🎨 Icona** sopra l'icona selezionata.
Con più chat selezionate: **#** le numera in ordine di selezione, **Aa** mette le iniziali, **✦** le fa ridisegnare all'AI.

## Mappe
- Ogni mappa è una faccia di un piano che ruota in 3D: frecce **‹ ›** in basso, tasti **Q** / **E**, o clic su una mappa nel pannello a sinistra.
- **Vista d'insieme** (tasto **M**, pulsante ⧉ o clic sul nome della mappa in basso): tutte le mappe si dispongono su un anello 3D con l'anteprima del contenuto. Trascina o usa le frecce per farle girare, clic per entrare, scheda ＋ per crearne una nuova.
- **＋** crea una mappa e ne apre subito la rinomina. Doppio clic sul nome (o ✎) per rinominarla, 🗑 per eliminarla dopo una conferma.
- Eliminare una mappa elimina anche le chat che contiene.
- Il pannello a sinistra mostra solo le chat della mappa aperta. Il pulsante ⤢ nel pannello chat la espande a tutto schermo (Esc per tornare alla mappa). Eliminare una chat (dal pannello, dalla mappa con Canc o dal pannello chat)
  chiede conferma e cancella anche i messaggi.
- Le chat create con la prima versione che non stavano su nessuna mappa vengono raccolte nella mappa "Chat recuperate".

## Cosa c'è nell'MVP
- **Lavagna**: zoom, spostamento della vista (Spazio + trascina, tasto centrale o strumento mano), minimappa, adatta alla vista, griglia con aggancio.
- **Icone-chat**: trascinabili, **ridimensionabili** (maniglia in basso a destra, pulsanti −/＋, tasti `[` `]`, `=` per uguagliarle). Doppio clic apre la chat.
- **Post-it, testi, riquadri** (spostando un riquadro si sposta anche il contenuto).
- **Frecce**: si trascinano dai pallini laterali; etichetta, forma (curva/dritta/gomito), tratteggio, punte, colore, inversione.
- **Allinea e distribuisci** (barra contestuale o Alt+A/D/W/S/H/V), **disposizioni automatiche**: griglia, albero (segue le frecce), grafo a forze.
- **Annulla/ripeti**, salvataggio automatico, ricerca nelle chat della mappa, esporta PNG e JSON.
- **Strumenti AI** (menu ✦ AI):
  - *Suggerisci collegamenti*: frecce gialle tratteggiate con relazione e motivazione; accetti o scarti.
  - *Raggruppa per temi*: crea riquadri tematici e vi dispone gli elementi.
  - *Sintesi*: post-it con idee principali, tensioni, domande aperte, lacune (della selezione o di tutta la mappa).
  - *Unisci*: nuova chat che parte dai riassunti degli elementi selezionati.
  - *Dirama*: nuova chat che riceve tutta la conversazione di un'altra come contesto.
  - *Contesto dai collegati*: ogni chat può ricevere i riassunti dei nodi collegati con frecce.

Premi `?` nell'app per l'elenco delle scorciatoie.

## Dati e privacy
- Tutto l'archivio sta in `data/` (`canvas.db` SQLite + `data/icons/`). Per fare un backup copia quella cartella.
- I messaggi vengono comunque inviati a OpenAI per generare le risposte; la conservazione dipende dalle impostazioni del tuo account ChatGPT.
- Il server ascolta solo su `127.0.0.1`.
- Le chiavi dei servizi immagini sono salvate in chiaro in `data/canvas.db`: non condividere quella cartella.

## Struttura
```
installa.command   installazione con doppio clic: dipendenze, login a ChatGPT, app in Applicazioni
server/index.js    motore locale: API, streaming, accesso solo dall'app (server/app-token.js)
server/model.js    ponte verso il modello (+ modalità simulata)
server/codex.js    Codex SDK di OpenAI (ChatGPT)
server/ai.js       riassunto → prompt icona, collegamenti, temi, sintesi, contesto dai collegati
server/images.js   Pollinations / Cloudflare
server/svg.js      pulizia degli SVG disegnati dal modello
mac/electron/      app desktop (Electron): avvia il motore e gli passa il codice segreto
mac/aggiorna-app.sh   ricostruisce l'app in background quando cambia (lo lancia il server)
server/db.js       SQLite (node:sqlite)
public/            interfaccia (JavaScript puro, nessuna build)
```

## Limiti noti
- Le chat esistenti su chatgpt.com non sono importabili: questa app ha un suo archivio.
- I caratteri (Bricolage Grotesque, Fraunces) arrivano da Google Fonts; offline si usano quelli di sistema.
- Nelle chat Codex lavora in sola lettura in una cartella vuota, con al massimo la ricerca web: niente file o comandi sul tuo computer.

## Licenza
chatStorm è distribuita con la **[PolyForm Noncommercial 1.0.0](LICENSE.md)**.
- **Uso libero per scopi non commerciali:** uso personale, studio, hobby, sperimentazione, scuole, università,
  enti di ricerca, no profit e pubblica amministrazione. Puoi modificarla e ridistribuirla alle stesse condizioni,
  mantenendo la licenza e la riga `Required Notice` con il copyright.
- **Uso commerciale escluso:** per usarla in un'attività a scopo di lucro, integrarla in un prodotto o in un servizio
  a pagamento, serve una licenza commerciale. Scrivici tramite [cisiamoagency.com](https://www.cisiamoagency.com).
- Il nome **chatStorm**, il logo con l'occhio e l'identità visiva di **Ci siamo** non sono coperti dalla licenza:
  restano marchi di Ci siamo e non si possono usare per prodotti derivati.
- La licenza riguarda il codice di chatStorm. Le dipendenze (Codex SDK di OpenAI, Electron e le altre) hanno le loro
  licenze, e l'uso di ChatGPT resta soggetto ai termini di OpenAI.

## Chi l'ha fatta
chatStorm è un progetto di **[Ci siamo](https://www.cisiamoagency.com)**, a cura di Riccardo Vitto.
