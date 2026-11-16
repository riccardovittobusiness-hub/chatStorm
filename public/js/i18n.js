// Lingua dell'interfaccia. Le chiavi sono i testi italiani; l'inglese è nel dizionario EN.
export let LANG = 'it';
export function setLang(l) { LANG = l === 'en' ? 'en' : 'it'; document.documentElement.lang = LANG; }

/** Traduce un testo (chiave italiana) e sostituisce i segnaposto {nome}. */
export function t(s, vars) {
  let out = LANG === 'en' && EN[s] !== undefined ? EN[s] : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
  return out;
}
/** Plurale semplice: t1 per 1, tn per gli altri (con {n}). */
export const tn = (n, one, many, vars = {}) => t(n === 1 ? one : many, { n, ...vars });

/** Traduce i testi e gli attributi già presenti nella pagina. */
export function translateDOM(root = document.body) {
  if (LANG === 'it') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n; while ((n = w.nextNode())) nodes.push(n);
  for (const node of nodes) {
    if (node.parentElement?.closest('script,style,code')) continue;
    const raw = node.nodeValue, key = raw.trim();
    if (key && EN[key] !== undefined) node.nodeValue = raw.replace(key, EN[key]);
  }
  for (const el of root.querySelectorAll('[title],[placeholder],[aria-label]')) {
    for (const a of ['title', 'placeholder', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v && EN[v.trim()] !== undefined) el.setAttribute(a, EN[v.trim()]);
    }
  }
}

const EN = {
  // ---- pagina ----
  'Modalità simulata: le risposte sono finte. Per usare ChatGPT davvero apri l\'app chatStorm.': 'Demo mode: replies are simulated. To use ChatGPT for real, open the chatStorm app.',
  'Collega il tuo ChatGPT': 'Connect your ChatGPT',
  'chatStorm risponde nelle chat usando il tuo abbonamento ChatGPT (Plus o Pro). L\'accesso si fa una volta sola, nel browser, e resta su questo computer.': 'chatStorm replies in chats using your ChatGPT subscription (Plus or Pro). You sign in once, in the browser, and it stays on this computer.',
  'Se il browser non si è aperto,': 'If the browser did not open,', 'apri tu la pagina di accesso': 'open the sign-in page yourself',
  'Più tardi': 'Later', 'Accedi con ChatGPT': 'Sign in with ChatGPT', 'Licenze': 'Licences',
  ', un progetto di': ', a project by',
  'Collegato a ChatGPT: puoi iniziare': 'Connected to ChatGPT: you can start', 'riprova': 'try again',
  'Accesso non completato: {msg}': 'Sign-in not completed: {msg}',
  'Ho aperto il browser: completa l\'accesso lì, poi torna qui.': 'I opened the browser: finish signing in there, then come back here.',
  'Testo non disponibile in questa versione.': 'Text not available in this version.',
  'Nuova versione {v}: scarica': 'New version {v}: download',
  'ChatGPT: collegato al tuo account.': 'ChatGPT: connected to your account.',
  'ChatGPT: non sei ancora collegato. Senza accesso le chat non possono rispondere.': 'ChatGPT: you are not signed in yet. Without it chats cannot reply.',
  'Esporta e importa': 'Export and import', 'Copia la mappa': 'Copy the map', 'Scarica la mappa': 'Download the map',
  'Incolla una mappa': 'Paste a map', 'Importa da un file…': 'Import from a file…',
  'Copia tutta la mappa negli appunti, con le chat complete: si incolla in un\'altra mappa o in una chat con Claude': 'Copy the whole map to the clipboard, with the full chats: paste it into another map or into a chat with Claude',
  'Salva tutta la mappa in un file, con le chat complete': 'Save the whole map to a file, with the full chats',
  'Incolla qui una mappa o una selezione copiata': 'Paste a copied map or selection here',
  'copia la selezione con le sue chat,': 'copies the selection with its chats,', 'la incolla in qualsiasi mappa': 'pastes it into any map',
  'Premi Ctrl+V sulla lavagna per incollare': 'Press Ctrl+V on the board to paste',
  'La mappa è vuota: non c\'è niente da copiare': 'The map is empty: there is nothing to copy',
  'Non riesco a scrivere negli appunti: usa "Scarica la mappa"': 'Cannot write to the clipboard: use "Download the map"',
  '1 elemento copiato. Incollalo in una mappa con Ctrl+V.': '1 element copied. Paste it into a map with Ctrl+V.',
  '{n} elementi copiati. Incollali in una mappa con Ctrl+V.': '{n} elements copied. Paste them into a map with Ctrl+V.',
  'Mappa copiata. Incollala in un\'altra mappa con Ctrl+V, o in una chat con Claude.': 'Map copied. Paste it into another map with Ctrl+V, or into a chat with Claude.',
  'Qui non c\'è una mappa di chatStorm da incollare': 'There is no chatStorm map here to paste',
  'Importo la mappa…': 'Importing the map…', '1 elemento incollato': '1 element pasted', '{n} elementi incollati': '{n} elements pasted',
  'Mappe': 'Maps', 'mappe': 'maps', 'Chat in questa mappa': 'Chats in this map', 'Impostazioni': 'Settings', 'Scorciatoie': 'Shortcuts',
  'Nuova chat (C, o doppio clic sulla lavagna)': 'New chat (C, or double-click the board)',
  'Nota': 'Note', 'Testo': 'Text', 'Riquadro': 'Frame', 'Disponi': 'Arrange',
  'Griglia': 'Grid', 'Albero, segue le frecce': 'Tree, follows the arrows', 'Grafo, avvicina i collegati': 'Graph, pulls linked items together',
  'Aggancia alla griglia': 'Snap to grid',
  'Suggerisci collegamenti': 'Suggest links', 'Raggruppa per temi': 'Group by theme',
  'Sintesi della mappa o della selezione': 'Summarize the map or selection', 'Unisci la selezione in una nuova chat': 'Merge the selection into a new chat',
  'Esporta PNG': 'Export PNG', 'Esporta JSON': 'Export JSON', 'Accetta tutti': 'Accept all', 'Scarta tutti': 'Dismiss all',
  'Doppio clic per iniziare una chat': 'Double-click to start a chat',
  'Ogni conversazione diventa un\'icona che puoi spostare e collegare.': 'Every conversation becomes an icon you can move and connect.',
  'Rotella: zoom': 'Wheel: zoom', 'Rotella: scorri': 'Wheel: scroll',
  'Trascina o usa le frecce per far girare le mappe. Clic su una mappa per entrarci.': 'Drag or use the arrows to spin the maps. Click a map to open it.',
  'Icona e riassunto': 'Icon and summary', '⑂ Dirama': '⑂ Branch', 'Contesto dai collegati': 'Context from linked chats',
  '✦ Disegnata dall\'AI': '✦ Drawn by AI', 'Aa Badge': 'Aa Badge', 'Immagine AI': 'AI image',
  'Il modello legge il riassunto della chat e disegna un\'icona vettoriale nello stile dell\'app.': 'The model reads the chat summary and draws a vector icon in the app\'s style.',
  'Disegna l\'icona': 'Draw the icon', 'Riassumi e ridisegna': 'Summarize and redraw',
  'Contenuto': 'Content', 'Lettere': 'Letters', 'Numero': 'Number', 'Simbolo': 'Symbol', 'Forma': 'Shape', 'Colore': 'Color', 'Stile': 'Style',
  'Sfumato': 'Gradient', 'Pieno': 'Solid',
  'Genera un\'immagine con il servizio scelto nelle impostazioni (Pollinations o Cloudflare).': 'Generates an image with the service chosen in Settings (Pollinations or Cloudflare).',
  'Nuova immagine': 'New image', 'Riassumi e rigenera': 'Summarize and regenerate',
  'Riassunto': 'Summary', 'Parole chiave': 'Keywords', 'Descrizione visiva usata per l\'icona': 'Visual description used for the icon',
  'Aggiorna riassunto': 'Refresh summary', 'Invia': 'Send', 'Stop': 'Stop', 'Annulla': 'Cancel',
  'Icone delle chat': 'Chat icons', 'Disegnate dall\'AI': 'Drawn by AI', 'icone vettoriali, nessun servizio in più': 'vector icons, no extra service',
  'Badge standard': 'Standard badges', 'lettere, numeri o simboli che modifichi tu': 'letters, numbers or symbols you edit yourself',
  'Pollinations o Cloudflare': 'Pollinations or Cloudflare', 'Crea l\'icona dopo il primo scambio': 'Create the icon after the first exchange',
  'funziona anche senza chiave, con limiti': 'works without a key too, with limits', 'FLUX, quota gratuita giornaliera': 'FLUX, free daily quota',
  'API key Pollinations': 'Pollinations API key', 'facoltativa, si crea su': 'optional, create one at',
  'Account ID Cloudflare': 'Cloudflare account ID', 'API token Workers AI': 'Workers AI API token',
  'Dashboard, poi AI, Workers AI, Use REST API': 'Dashboard, then AI, Workers AI, Use REST API',
  'Stile grafico delle immagini': 'Image style', 'Isometrico 3D': 'Isometric 3D', 'Acquerello': 'Watercolor', 'Prova generazione': 'Test generation',
  'Modelli': 'Models', 'Nuove chat': 'New chats', 'Riassunti, icone e strumenti della mappa': 'Summaries, icons and map tools',
  'Modello': 'Model', 'Modello ChatGPT (Codex) per le chat, i riassunti e gli strumenti della mappa': 'ChatGPT (Codex) model for chats, summaries and map tools',
  'Modello ChatGPT (Codex)': 'ChatGPT (Codex) model', 'Altro…': 'Other…', 'Scrivi il nome del modello': 'Type the model name',
  'Aggiorna il riassunto ogni N messaggi': 'Refresh the summary every N messages', 'Lingua': 'Language',
  'Lingua dell\'app e delle risposte': 'App and reply language',
  'Permetti di cercare sul web nelle chat': 'Allow web search in chats',
  'Salva': 'Save', 'Generale': 'General', 'il più capace': 'most capable', 'equilibrato': 'balanced', 'veloce, consuma meno': 'fast, uses less', 'Lavagna': 'Board', 'Doppio clic': 'Double-click',
  'sulla lavagna: nuova chat': 'on the board: new chat', 'su un\'icona: apri la chat': 'on an icon: open the chat',
  'ruota alla mappa precedente / successiva': 'rotate to the previous / next map', 'vista d\'insieme di tutte le mappe': 'overview of all maps',
  'Spazio': 'Space', '+ trascina, o tasto centrale: sposta la vista': '+ drag, or middle button: pan the view', 'Rotella': 'Wheel',
  '+rotella: zoom': '+wheel: zoom', 'adatta alla vista': 'fit to view', 'seleziona,': 'select,', 'mano': 'hand',
  'chat,': 'chat,', 'nota,': 'note,', 'testo,': 'text,', 'riquadro': 'frame', 'Canc': 'Delete', 'elimina,': 'delete,',
  'duplica una nota': 'duplicate a note', 'annulla,': 'undo,', 'ripeti': 'redo', 'Allinea e disponi': 'Align and arrange',
  'a sinistra,': 'left,', 'a destra': 'right', 'in alto,': 'top,', 'in basso': 'bottom', 'centra': 'center', 'distribuisci': 'distribute',
  'griglia,': 'grid,', 'albero,': 'tree,', 'grafo': 'graph', 'Icone e frecce': 'Icons and arrows',
  'ingrandisci / riduci l\'icona': 'enlarge / shrink the icon', 'uguaglia le icone selezionate': 'make selected icons the same size',
  'Trascina dai pallini laterali per creare una freccia': 'Drag from the side dots to create an arrow',
  'collega gli elementi selezionati in ordine': 'link the selected items in order', 'Chiudi': 'Close',
  // ---- attributi ----
  'Nascondi pannello': 'Hide panel', 'Vedi tutte le mappe (M)': 'See all maps (M)', 'Nuova mappa': 'New map', 'Rinomina': 'Rename',
  'Elimina mappa': 'Delete map', 'Cerca per titolo o contenuto': 'Search by title or content', 'Mostra pannello': 'Show panel',
  'Seleziona (V)': 'Select (V)', 'Sposta la vista (H, oppure tieni Spazio)': 'Pan the view (H, or hold Space)',
  'Nuova chat con il modello predefinito (C, o doppio clic sulla lavagna)': 'New chat with the default model (C, or double-click the board)',
  'Scegli il modello per la nuova chat': 'Choose the model for the new chat', 'Nota (N)': 'Note (N)', 'Testo (T)': 'Text (T)', 'Riquadro (F)': 'Frame (F)',
  'Disposizione automatica': 'Automatic layout', 'Strumenti AI per la visione d\'insieme': 'AI tools for the big picture', 'AI': 'AI',
  'Annulla (Ctrl+Z)': 'Undo (Ctrl+Z)', 'Ripeti (Ctrl+Shift+Z)': 'Redo (Ctrl+Shift+Z)', 'Esporta': 'Export',
  'La rotella fa zoom. Clic per farle scorrere la vista (zoom con Ctrl+rotella)': 'The wheel zooms. Click to make it pan instead (zoom with Ctrl+wheel)',
  'La rotella scorre la vista, Ctrl+rotella o pizzico per lo zoom. Clic per cambiare': 'The wheel pans the view, Ctrl+wheel or pinch to zoom. Click to switch',
  'Riduci': 'Zoom out', 'Adatta alla vista (Shift+1)': 'Fit to view (Shift+1)', 'Ingrandisci': 'Zoom in', 'Cambia mappa': 'Change map',
  'Mappa precedente (Q)': 'Previous map (Q)', 'Mappa successiva (E)': 'Next map (E)', 'Tutte le mappe': 'All maps',
  'Torna alla mappa (Esc)': 'Back to the map (Esc)', 'Ruota a sinistra (←)': 'Rotate left (←)', 'Ruota a destra (→)': 'Rotate right (→)',
  'Rigenera l\'icona': 'Regenerate the icon', 'Titolo della chat': 'Chat title', 'Modello che risponde in questa chat': 'Model answering in this chat',
  'Espandi a tutto schermo': 'Expand to full screen', 'Chiudi (Esc)': 'Close (Esc)', 'Nuova chat che continua da questa': 'New chat that continues from this one',
  'Invia al modello i riassunti delle chat collegate con frecce': 'Send the summaries of chats linked by arrows', 'Elimina la chat': 'Delete the chat',
  'Tipo di icona': 'Icon type', 'Testo del badge': 'Badge text', 'Arrotondato': 'Rounded', 'Cerchio': 'Circle', 'Quadrato': 'Square',
  'Esagono': 'Hexagon', 'Rombo': 'Diamond', 'Colore personalizzato': 'Custom color', 'La mia prima mappa': 'My first map',
  'Scrivi a ChatGPT. Invio per inviare, Shift+Invio per andare a capo.': 'Write to ChatGPT. Enter to send, Shift+Enter for a new line.',
  'Torna alla mappa (Esc) ': 'Back to the map (Esc)',
  // ---- testi dinamici ----
  'Salvataggio non riuscito: {msg}': 'Save failed: {msg}',
  '1 collegamento suggerito dall\'AI. Passa sopra l\'etichetta per leggere il motivo.': '1 link suggested by AI. Hover the label to read why.',
  '{n} collegamenti suggeriti dall\'AI. Passa sopra un\'etichetta per leggere il motivo.': '{n} links suggested by AI. Hover a label to read why.',
  'Vista non disponibile: {msg}': 'Overview unavailable: {msg}',
  'Eliminare la chat "{title}"?': 'Delete the chat "{title}"?', 'Eliminare {n} chat?': 'Delete {n} chats?',
  'Le icone spariscono dalla mappa e dall\'elenco, e tutti i messaggi vengono cancellati. L\'operazione non si può annullare.':
    'The icons disappear from the map and the list, and all messages are deleted. This can\'t be undone.',
  'Elimina chat': 'Delete chat', 'Elimina {n} chat': 'Delete {n} chats', '"{title}" non eliminata: {msg}': '"{title}" not deleted: {msg}',
  'Chat eliminata': 'Chat deleted', 'Chat eliminate': 'Chats deleted',
  'Le chat selezionate sono vuote: scrivi almeno un messaggio': 'The selected chats are empty: write at least one message',
  'Disegno le icone ({i} di {n})…': 'Drawing icons ({i} of {n})…', 'Icone ridisegnate': 'Icons redrawn',
  'Seleziona almeno due elementi da unire': 'Select at least two items to merge', 'Preparo il contesto con i riassunti…': 'Preparing the context from the summaries…',
  'confluisce in': 'merges into', 'dirama': 'branches', 'La mappa è vuota': 'The map is empty',
  'Sintetizzo la selezione…': 'Summarizing the selection…', 'Sintetizzo la mappa…': 'Summarizing the map…',
  'Cerco collegamenti tra le idee…': 'Looking for links between ideas…', 'Nessun nuovo collegamento suggerito': 'No new links suggested',
  'Raggruppo le idee per temi…': 'Grouping ideas by theme…', 'Mappa non caricata: {msg}': 'Map not loaded: {msg}',
  'C\'è una sola mappa: creane un\'altra con ＋ nel pannello a sinistra': 'There is only one map: create another with ＋ in the left panel',
  'Nome della mappa': 'Map name', 'Nome non salvato: {msg}': 'Name not saved: {msg}', 'Eliminare la mappa "{name}"?': 'Delete the map "{name}"?',
  'Verrà eliminata anche la chat che contiene, con tutti i messaggi. L\'operazione non si può annullare.':
    'The chat it contains will be deleted too, with all its messages. This can\'t be undone.',
  'Verranno eliminate anche le {n} chat che contiene, con tutti i messaggi. L\'operazione non si può annullare.':
    'The {n} chats it contains will be deleted too, with all their messages. This can\'t be undone.',
  'La mappa e tutto ciò che contiene verranno eliminati. L\'operazione non si può annullare.': 'The map and everything in it will be deleted. This can\'t be undone.',
  'Mappa non eliminata: {msg}': 'Map not deleted: {msg}', 'Mappa eliminata': 'Map deleted',
  'Nessuna chat corrisponde alla ricerca.': 'No chat matches your search.',
  'Nessuna chat in questa mappa. Fai doppio clic sulla lavagna per crearne una.': 'No chats in this map yet. Double-click the board to create one.',
  'Elimina la chat (Canc)': 'Delete the chat (Delete)', '1 messaggio': '1 message', '{n} messaggi': '{n} messages',
  'ChatGPT sta rispondendo…': 'ChatGPT is replying…',
  'Impostazioni salvate': 'Settings saved', 'Funziona': 'It works', 'genero…': 'generating…', 'Non riuscita: {msg}': 'Failed: {msg}',
  'Avvio non riuscito: {msg}': 'Startup failed: {msg}', 'Predefinito': 'Default', 'Predefinito ({name})': 'Default ({name})',
  'Mappa vuota': 'Empty map', 'Crea una nuova mappa': 'Create a new map', 'Aperta ora': 'Open now', '1 chat': '1 chat', '{n} chat': '{n} chats',
  // barra contestuale
  '✓ Accetta': '✓ Accept', '✕ Scarta': '✕ Dismiss', 'Accetta il collegamento': 'Accept the link', 'Scarta': 'Dismiss', 'Accetta': 'Accept',
  'Etichetta (es. approfondisce)': 'Label (e.g. expands on)', 'Curva': 'Curved', 'Dritta': 'Straight', 'A gomito': 'Elbow',
  'Tratteggiata / continua': 'Dashed / solid', 'Punta finale': 'End arrow', 'Due punte': 'Both ends', 'Nessuna punta': 'No arrow',
  'Inverti direzione': 'Reverse direction', 'Elimina (Canc)': 'Delete (Delete)', '💬 Apri': '💬 Open', 'Apri la chat (doppio clic)': 'Open the chat (double-click)',
  '⑂ Dirama': '⑂ Branch', 'Nuova chat che parte da questa': 'New chat starting from this one', '🎨 Icona': '🎨 Icon', 'Modifica l\'icona': 'Edit the icon',
  'Riduci icona ([)': 'Shrink icon ([)', 'Ingrandisci icona (])': 'Enlarge icon (])', 'Uguaglia le dimensioni (=)': 'Same size (=)',
  'Icone numerate in ordine di selezione': 'Number icons in selection order', 'Icone con le iniziali del titolo': 'Icons with title initials',
  'Fai ridisegnare le icone all\'AI': 'Have the AI redraw the icons',
  'Allinea a sinistra (Alt+A)': 'Align left (Alt+A)', 'Centra in orizzontale (Alt+H)': 'Center horizontally (Alt+H)', 'Allinea a destra (Alt+D)': 'Align right (Alt+D)',
  'Allinea in alto (Alt+W)': 'Align top (Alt+W)', 'Centra in verticale (Alt+V)': 'Center vertically (Alt+V)', 'Allinea in basso (Alt+S)': 'Align bottom (Alt+S)',
  'Distribuisci in orizzontale (Alt+Shift+H)': 'Distribute horizontally (Alt+Shift+H)', 'Distribuisci in verticale (Alt+Shift+V)': 'Distribute vertically (Alt+Shift+V)',
  '↗ Collega': '↗ Link', 'Collega in ordine di selezione (L)': 'Link in selection order (L)', '✦ Unisci': '✦ Merge', 'Unisci in una nuova chat': 'Merge into a new chat',
  '✦ Sintesi': '✦ Summary', 'Sintesi della selezione': 'Summary of the selection', 'Seleziona contenuto': 'Select contents',
  'Seleziona gli elementi nel riquadro': 'Select the items in the frame', 'Elimina le chat selezionate (Canc)': 'Delete the selected chats (Delete)',
  'Doppio clic per scrivere': 'Double-click to write', 'Chat eliminata ': 'Deleted chat', 'Riquadro ': 'Frame', 'Tema': 'Theme',
  // pannello chat
  'Senza titolo': 'Untitled', 'Riassumo la chat…': 'Summarizing the chat…',
  'Scrivi almeno un messaggio prima di creare l\'icona': 'Write at least one message before creating the icon',
  'Disegno l\'icona…': 'Drawing the icon…', 'Genero l\'immagine…': 'Generating the image…', 'Riassumo la chat. ': 'Summarizing the chat. ',
  'Icona non creata: {msg}': 'Icon not created: {msg}', 'Risposta non riuscita: {msg}': 'Reply failed: {msg}',
  'Da dove partiamo?': 'Where do we start?',
  'Scrivi la prima idea. Dopo la risposta la chat riceve un titolo e la sua icona.': 'Write your first idea. After the reply, the chat gets a title and an icon.',
  '— dalla chat di partenza —': '— from the original chat —', '— nuova diramazione —': '— new branch —',
  'Non ancora disponibile: arriva dopo il primo scambio.': 'Not available yet: it arrives after the first exchange.',
  'Ultimo errore icona: {msg}': 'Last icon error: {msg}',
  'Risponde {who}. Il modello si sceglie prima del primo messaggio.': '{who} is answering. The model is chosen before the first message.',
  'Risponde {who}. Clic per passare a {other}.': '{who} is answering. Click to switch to {other}.',
  'Torna alla mappa (Esc)·': 'Back to the map (Esc)', '(interrotto)': '(stopped)',
};
