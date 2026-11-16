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

## Scarica e installa
chatStorm è un'app per Mac che contiene già tutto: non serve installare Node.js né usare il Terminale.

1. **Scarica** il file per il tuo Mac dalla pagina delle [versioni](https://github.com/riccardovittobusiness-hub/chatStorm/releases/latest):
   - Mac con chip Apple (M1 e successivi): [chatStorm-arm64.dmg](https://github.com/riccardovittobusiness-hub/chatStorm/releases/latest/download/chatStorm-arm64.dmg)
   - Mac con processore Intel: [chatStorm-x64.dmg](https://github.com/riccardovittobusiness-hub/chatStorm/releases/latest/download/chatStorm-x64.dmg)
2. **Apri** il `.dmg` e trascina **chatStorm** nella cartella **Applicazioni**.
3. **Primo avvio.** L'app non è ancora firmata con Apple, quindi macOS avvisa che non può verificare lo sviluppatore.
   Vai in **Impostazioni di Sistema → Privacy e sicurezza**, scorri in basso e premi **Apri comunque**. Si fa una volta sola.
4. **Accedi con ChatGPT.** Al primo avvio chatStorm ti chiede di collegare il tuo account: premi il pulsante e completa
   l'accesso nel browser. Serve un abbonamento **ChatGPT Plus o Pro**; l'app usa quello, non una API key a consumo.

Come funziona l'app:
- Ha una finestra sua: non apre il browser e non usa porte né indirizzi `localhost`. Quando la apri avvia il suo motore
  locale, che comunica con la finestra attraverso un file privato del tuo utente, e lo spegne quando la chiudi.
- **Mappe e chat** stanno in `~/Library/Application Support/chatStorm/data`: restano lì anche quando aggiorni l'app.
- **Nuove versioni:** all'avvio l'app chiede a GitHub qual è l'ultima versione pubblicata e, se ce n'è una più recente,
  mostra un pulsante per scaricarla. Per aggiornare si scarica il nuovo `.dmg` e si sostituisce l'app in Applicazioni.
- Chi aveva installato chatStorm dalla cartella del progetto (`~/chatStorm`) ritrova le sue mappe: al primo avvio l'app le copia.

## Per chi sviluppa
Servono un Mac e Node.js 22.13 o più recente.
```bash
npm install
npm run mock     # l'interfaccia nel browser (http://localhost:4317) con risposte e icone simulate, senza ChatGPT
npm run app      # l'app vera, avviata dalla cartella del progetto
npm run dist     # costruisce dist/chatStorm-<arch>.dmg (mac/build-dmg.sh)
```
I `.dmg` pubblicati li costruisce GitHub Actions (`.github/workflows/build.yml`), che prova anche che l'app parta:
un tag `v1.2.3` uguale alla versione in `package.json` crea la Release con i due file.
La firma è ancora locale ("ad hoc"): la firma Developer ID e la notarizzazione di Apple andranno aggiunte in `mac/build-dmg.sh`.

## ChatGPT (Codex)
Le chat, i riassunti, le icone e gli strumenti della mappa usano **ChatGPT tramite il Codex SDK di OpenAI**
(`@openai/codex-sdk`), incluso nell'app. L'accesso si fa con **Accedi con ChatGPT** (al primo avvio o da Impostazioni)
e resta sul tuo computer, in `~/.codex`: vale anche se avevi già fatto l'accesso nell'app Codex.
- In ⚙ Impostazioni → Modello scegli il modello: GPT-5.6 Sol, Terra o Luna, oppure **Altro…** per scriverne un altro.
- Codex lavora in una cartella vuota in sola lettura: non vede l'archivio delle chat.
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

## Copiare, scaricare e incollare le mappe
Una mappa, o una sua parte, si può portare ovunque come **un unico JSON** che contiene elementi, frecce e le chat complete
(titolo, riassunto, messaggi, icona).
- **Copia**: seleziona qualcosa e premi **Ctrl/Cmd+C**, oppure menu **⇩ → Copia la mappa** per copiarla tutta.
- **Incolla**: **Ctrl/Cmd+V** su qualsiasi lavagna, anche in un'altra mappa o su un altro computer. Le chat incollate sono copie
  indipendenti: puoi continuarle, e il modello riceve come contesto quanto era stato detto.
- **File**: menu **⇩ → Scarica la mappa** salva un file `.chatstorm.json`; **Importa da un file…** lo rimette su una lavagna.
- **Come brief per un assistente AI**: il JSON si apre con un campo `about` che ne spiega la struttura. Incollato in una chat
  con Claude, o salvato nella cartella di un progetto per Claude Code, fa da brief: idee, collegamenti, temi e conversazioni.
- Le icone disegnate dall'AI e i badge viaggiano con la mappa; le icone generate come immagini no (la chat riparte dal badge).
- Un file importato è trattato come dato non fidato: restano solo i campi conosciuti e gli SVG vengono ripuliti.

## Cosa c'è nell'MVP
- **Lavagna**: zoom, spostamento della vista (Spazio + trascina, tasto centrale o strumento mano), minimappa, adatta alla vista, griglia con aggancio.
- **Icone-chat**: trascinabili, **ridimensionabili** (maniglia in basso a destra, pulsanti −/＋, tasti `[` `]`, `=` per uguagliarle). Doppio clic apre la chat.
- **Post-it, testi, riquadri** (spostando un riquadro si sposta anche il contenuto).
- **Frecce**: si trascinano dai pallini laterali; etichetta, forma (curva/dritta/gomito), tratteggio, punte, colore, inversione.
- **Allinea e distribuisci** (barra contestuale o Alt+A/D/W/S/H/V), **disposizioni automatiche**: griglia, albero (segue le frecce), grafo a forze.
- **Annulla/ripeti**, salvataggio automatico, ricerca nelle chat della mappa, esporta PNG.
- **Mappe portatili**: copia, scarica e incolla una mappa intera o una selezione, con tutte le sue chat (vedi sotto).
- **Strumenti AI** (menu ✦ AI):
  - *Suggerisci collegamenti*: frecce gialle tratteggiate con relazione e motivazione; accetti o scarti.
  - *Raggruppa per temi*: crea riquadri tematici e vi dispone gli elementi.
  - *Sintesi*: post-it con idee principali, tensioni, domande aperte, lacune (della selezione o di tutta la mappa).
  - *Unisci*: nuova chat che parte dai riassunti degli elementi selezionati.
  - *Dirama*: nuova chat che riceve tutta la conversazione di un'altra come contesto.
  - *Contesto dai collegati*: ogni chat può ricevere i riassunti dei nodi collegati con frecce.

Premi `?` nell'app per l'elenco delle scorciatoie.

## Dati e privacy
- Tutto l'archivio sta in `~/Library/Application Support/chatStorm/data` (`canvas.db` SQLite e la cartella `icons`).
  Per fare un backup copia quella cartella, oppure scarica le mappe in JSON.
- I messaggi vengono inviati a OpenAI per generare le risposte; la conservazione dipende dalle impostazioni del tuo account ChatGPT.
- Il motore non apre porte di rete: risponde solo alla finestra dell'app.
- All'avvio l'app legge da GitHub il numero dell'ultima versione pubblicata. Non invia nessun dato tuo.
- Le chiavi dei servizi immagini sono salvate in chiaro in `canvas.db`: non condividere quella cartella.
- Le licenze dei componenti inclusi si leggono nell'app: **Scorciatoie → Licenze**.

## Struttura
```
server/index.js    motore locale: API e streaming su un socket privato dell'app (senza porte)
server/model.js    ponte verso il modello (+ modalità simulata)
server/codex.js    Codex SDK di OpenAI (ChatGPT)
server/ai.js       riassunto → prompt icona, collegamenti, temi, sintesi, contesto dai collegati
server/images.js   Pollinations / Cloudflare
server/svg.js      pulizia degli SVG disegnati dal modello
server/portable.js mappe portatili: esporta e importa il JSON con elementi, frecce e chat
server/update.js   avviso di nuove versioni
mac/electron/      app desktop (Electron): avvia il motore e mostra chatstorm://app nella sua finestra
mac/build-dmg.sh   costruisce l'app e il .dmg; mac/prova-app.sh prova che parta; mac/licenze.mjs raccoglie le licenze incluse
server/db.js       SQLite (node:sqlite)
public/            interfaccia (JavaScript puro, nessuna build)
```

## Limiti noti
- Le chat esistenti su chatgpt.com non sono importabili: questa app ha un suo archivio.
- I caratteri (Bricolage Grotesque, Fraunces) arrivano da Google Fonts; offline si usano quelli di sistema.
- Solo per Mac. L'app non è ancora firmata con Apple: al primo avvio serve "Apri comunque" (vedi sopra).
- Nelle chat Codex lavora in sola lettura in una cartella vuota, con al massimo la ricerca web: niente file o comandi sul tuo computer.

## Licenza
chatStorm è distribuita con la **[PolyForm Noncommercial 1.0.0](LICENSE.md)**.
- **Uso libero per scopi non commerciali:** uso personale, studio, hobby, sperimentazione, scuole, università,
  enti di ricerca, no profit e pubblica amministrazione. Puoi modificarla e ridistribuirla alle stesse condizioni,
  mantenendo la licenza e la riga `Required Notice` con il copyright.
- **Uso commerciale escluso:** per usarla in un'attività a scopo di lucro, integrarla in un prodotto o in un servizio
  a pagamento, serve una licenza commerciale. Scrivici tramite [cisiamoagency.com](https://www.cisiamoagency.com).
- La licenza copre il codice, non il nome **chatStorm**, il logo con l'occhio e l'identità visiva di **Ci siamo**:
  per usarli in un progetto derivato serve il nostro permesso. Se ridistribuisci una versione modificata, dalle un nome
  e un logo tuoi.
- La licenza riguarda il codice di chatStorm. Le dipendenze (Codex SDK di OpenAI, Electron e le altre) hanno le loro
  licenze, e l'uso di ChatGPT resta soggetto ai termini di OpenAI.

## Chi l'ha fatta
chatStorm è un progetto di **[Ci siamo](https://www.cisiamoagency.com)**, a cura di Riccardo Vitto.
