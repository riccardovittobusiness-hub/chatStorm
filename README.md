# Claude Canvas

**Il brainstorming con Claude, visto dall'alto.**

Quando si ragiona su un'idea con un assistente AI, le conversazioni si accumulano in un elenco verticale e il quadro d'insieme si perde: quale chat approfondiva cosa, dove era nata un'alternativa, quali idee si contraddicono. Claude Canvas trasforma ogni conversazione in un oggetto da disporre nello spazio.

Ogni chat diventa un'**icona** sulla lavagna: dopo i primi messaggi Claude le dà un titolo, ne scrive un riassunto e disegna un'icona che ne rappresenta il contenuto. In alternativa puoi usare badge con lettere, numeri o simboli, scegliendo forma e colore. Le icone si trascinano come sul desktop, si ingrandiscono, si allineano e si collegano con frecce etichettate ("approfondisce", "contraddice", "dipende da"). Accanto alle chat puoi aggiungere note, testi e riquadri tematici, come su una lavagna di Miro.

Ogni progetto vive su una **mappa**, e le mappe sono le facce di un piano che ruota in 3D: si passa dall'una all'altra girando il piano, come in Fez.

Claude non è solo dentro le chat, ma lavora anche sulla mappa:
- **Suggerisce collegamenti** tra idee che non avevi messo in relazione, spiegando perché.
- **Raggruppa per temi** le chat e le note in riquadri.
- **Sintetizza** la mappa o una selezione: idee principali, tensioni, domande aperte, lacune.
- **Dirama** una chat in una nuova che ne eredita tutto il contesto, per esplorare un'alternativa senza perdere l'originale.
- **Unisce** più chat in una conversazione nuova che parte dai loro riassunti.
- Ogni chat può ricevere il **contesto delle chat collegate** con le frecce.

L'app gira sul tuo computer e usa il tuo abbonamento Claude tramite Claude Code, senza chiavi API a consumo. Chat, mappe e icone restano in un archivio locale; le icone le disegna Claude, oppure sono badge che personalizzi tu.

---

## Requisiti
- **Node.js 22.13 o più recente** (`node --version`)
- **Claude Code installato e collegato al tuo account**: esegui `claude` una volta nel terminale e fai `/login` con il tuo abbonamento.
- Controlla che la variabile `ANTHROPIC_API_KEY` **non** sia impostata, altrimenti l'SDK userebbe la API key (a consumo) invece dell'abbonamento.

## Avvio
**App desktop per Mac:** apri la cartella `mac` e fai doppio clic su **`crea-app.command`** (una volta sola).
Scarica Electron, costruisce **ClaudioStorm.app** con la sua icona e la installa nella cartella Applicazioni del tuo utente
(la trovi in Launchpad e con Spotlight; trascinala nel Dock). L'app ha una finestra sua, avvia il server quando la apri
e lo spegne quando la chiudi; i link esterni si aprono nel browser. Dopo un aggiornamento del codice basta riaprirla.
Se nel frattempo è cambiata l'app desktop stessa (cartella `mac/electron`), riesegui `crea-app.command`.
**Importante:** tieni la cartella del progetto nella tua cartella Inizio (per esempio `~/claude-canvas`), non in Download,
Scrivania o Documenti: macOS impedisce all'app di leggere quelle cartelle protette.

**Primo avvio / da Terminale:** doppio clic su **`avvia.command`**. La prima volta installa Claude Code (se manca), apre il login
al tuo account Claude e installa le dipendenze; le volte successive avvia soltanto l'app.

In alternativa, da terminale:
```bash
cd claude-canvas
npm install
npm start
```
Apri **http://localhost:4317**. Tieni aperta la finestra del Terminale finché usi l'app.

Per provare l'interfaccia senza usare Claude: `npm run mock` (risposte e icone simulate).

## Claude e ChatGPT (Codex)
Ogni chat può usare **Claude** (tramite Claude Code) o **ChatGPT** (tramite Codex di OpenAI), entrambi con il tuo abbonamento.
- Il modello si sceglie per ogni chat: menu ▾ accanto a **Chat** nella barra, oppure il pulsante **Claude / ChatGPT**
  in alto nel pannello chat (prima del primo messaggio). Le chat di ChatGPT hanno il segno **GPT** sull'icona.
- In ⚙ Impostazioni → Modelli scegli il modello predefinito per le nuove chat e quello per riassunti, icone e strumenti della mappa.
- Per ChatGPT serve aver fatto l'accesso a Codex con il tuo account ChatGPT (per esempio nell'app Codex). Il supporto Codex
  (`@openai/codex-sdk`) viene installato da `avvia.command`, o automaticamente al primo utilizzo.
- Codex lavora in una cartella vuota in sola lettura (`data/codex-workspace`): non vede l'archivio delle chat.
- "Dirama" su una chat di ChatGPT crea una nuova chat che riceve la conversazione come contesto.

## Icone delle chat
Si sceglie in ⚙ **Impostazioni → Icone delle chat**:
- **Disegnate da Claude** (predefinito): dopo il primo scambio il modello scelto per gli strumenti (Claude o ChatGPT) riassume la chat e disegna un'icona vettoriale (SVG)
  nei toni del blu. Nessun servizio esterno: usa il tuo abbonamento. L'SVG viene ripulito da script e risorse esterne.
- **Badge standard**: lettere, numero o simbolo, con forma (arrotondato, cerchio, quadrato, esagono, rombo), colore e stile
  (sfumato o pieno) modificabili.
- **Immagine AI**: Pollinations.ai (anche senza chiave) o Cloudflare Workers AI, con chiave nelle impostazioni.

Ogni chat si può cambiare dal pannello chat → **Icona e riassunto**, oppure dal pulsante **🎨 Icona** sopra l'icona selezionata.
Con più chat selezionate: **#** le numera in ordine di selezione, **Aa** mette le iniziali, **✦** le fa ridisegnare a Claude.

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
- **Strumenti di Claude** (menu ✦ Claude):
  - *Suggerisci collegamenti*: frecce gialle tratteggiate con relazione e motivazione; accetti o scarti.
  - *Raggruppa per temi*: crea riquadri tematici e vi dispone gli elementi.
  - *Sintesi*: post-it con idee principali, tensioni, domande aperte, lacune (della selezione o di tutta la mappa).
  - *Unisci*: nuova chat che parte dai riassunti degli elementi selezionati.
  - *Dirama*: nuova chat che continua il contesto completo di un'altra (fork della sessione).
  - *Contesto dai collegati*: ogni chat può ricevere i riassunti dei nodi collegati con frecce.

Premi `?` nell'app per l'elenco delle scorciatoie.

## Dati e privacy
- Tutto l'archivio sta in `data/` (`canvas.db` SQLite + `data/icons/`). Per fare un backup copia quella cartella.
- I messaggi vengono comunque inviati ad Anthropic per generare le risposte; la conservazione dipende dalle tue impostazioni privacy su claude.ai.
- Il server ascolta solo su `127.0.0.1`.
- Le chiavi dei servizi immagini sono salvate in chiaro in `data/canvas.db`: non condividere quella cartella.

## Struttura
```
server/index.js    server HTTP, API, streaming
server/claude.js   ponte con l'Agent SDK di Claude (+ modalità simulata)
server/codex.js    ponte con il Codex SDK di OpenAI (ChatGPT)
server/ai.js       riassunto → prompt icona, collegamenti, temi, sintesi, contesto dai collegati
server/images.js   Pollinations / Cloudflare
server/svg.js      pulizia degli SVG disegnati da Claude
mac/electron/      app desktop (Electron)
mac/crea-app.command  costruisce e installa ClaudioStorm.app
server/db.js       SQLite (node:sqlite)
public/            interfaccia (JavaScript puro, nessuna build)
```

## Limiti noti
- Le chat esistenti su claude.ai non sono importabili: questa app ha un suo archivio.
- I caratteri (Bricolage Grotesque, Instrument Sans) arrivano da Google Fonts; offline si usano quelli di sistema.
- Nelle chat Claude ha solo ricerca web e lettura pagine (niente file o comandi), per sicurezza.
- Modelli: lascia vuoto per il predefinito, oppure scrivi un alias come `sonnet`, `opus`, `haiku`.
