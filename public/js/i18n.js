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
  'Modalità simulata: le risposte di Claude sono finte. Avvia con': 'Demo mode: Claude\'s replies are simulated. Start with',
  'per usare Claude davvero.': 'to use Claude for real.',
  "Aggiorno l'app desktop: tra un minuto si chiude e si riapre da sola, con il nuovo nome e la nuova icona.": 'Updating the desktop app: in a minute it will close and reopen on its own, with the new name and icon.',
  'Mappe': 'Maps', 'mappe': 'maps', 'Chat in questa mappa': 'Chats in this map', 'Impostazioni': 'Settings', 'Scorciatoie': 'Shortcuts',
  'Nuova chat con Claude': 'New chat with Claude', 'Nuova chat con ChatGPT (Codex)': 'New chat with ChatGPT (Codex)',
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
  '✦ Disegnata da Claude': '✦ Drawn by Claude', 'Aa Badge': 'Aa Badge', 'Immagine AI': 'AI image',
  'Claude legge il riassunto della chat e disegna un\'icona vettoriale nei toni del blu.': 'Claude reads the chat summary and draws a vector icon in shades of blue.',
  'Disegna con Claude': 'Draw with Claude', 'Riassumi e ridisegna': 'Summarize and redraw',
  'Contenuto': 'Content', 'Lettere': 'Letters', 'Numero': 'Number', 'Simbolo': 'Symbol', 'Forma': 'Shape', 'Colore': 'Color', 'Stile': 'Style',
  'Sfumato': 'Gradient', 'Pieno': 'Solid',
  'Genera un\'immagine con il servizio scelto nelle impostazioni (Pollinations o Cloudflare).': 'Generates an image with the service chosen in Settings (Pollinations or Cloudflare).',
  'Nuova immagine': 'New image', 'Riassumi e rigenera': 'Summarize and regenerate',
  'Riassunto': 'Summary', 'Parole chiave': 'Keywords', 'Descrizione visiva usata per l\'icona': 'Visual description used for the icon',
  'Aggiorna riassunto': 'Refresh summary', 'Invia': 'Send', 'Stop': 'Stop', 'Annulla': 'Cancel',
  'Icone delle chat': 'Chat icons', 'Disegnate da Claude': 'Drawn by Claude', 'icone vettoriali, nessun servizio esterno': 'vector icons, no external service',
  'Badge standard': 'Standard badges', 'lettere, numeri o simboli che modifichi tu': 'letters, numbers or symbols you edit yourself',
  'Pollinations o Cloudflare': 'Pollinations or Cloudflare', 'Crea l\'icona dopo il primo scambio': 'Create the icon after the first exchange',
  'funziona anche senza chiave, con limiti': 'works without a key too, with limits', 'FLUX, quota gratuita giornaliera': 'FLUX, free daily quota',
  'API key Pollinations': 'Pollinations API key', 'facoltativa, si crea su': 'optional, create one at',
  'Account ID Cloudflare': 'Cloudflare account ID', 'API token Workers AI': 'Workers AI API token',
  'Dashboard, poi AI, Workers AI, Use REST API': 'Dashboard, then AI, Workers AI, Use REST API',
  'Stile grafico delle immagini': 'Image style', 'Isometrico 3D': 'Isometric 3D', 'Acquerello': 'Watercolor', 'Prova generazione': 'Test generation',
  'Modelli': 'Models', 'Nuove chat': 'New chats', 'Riassunti, icone e strumenti della mappa': 'Summaries, icons and map tools',
  'Modello Claude per le chat': 'Claude model for chats', 'Modello Claude per riassunti e strumenti': 'Claude model for summaries and tools',
  'Modello ChatGPT (Codex)': 'ChatGPT (Codex) model', 'Altro…': 'Other…', 'Scrivi il nome del modello': 'Type the model name',
  'Aggiorna il riassunto ogni N messaggi': 'Refresh the summary every N messages', 'Lingua': 'Language',
  'Lingua dell\'app e delle risposte': 'App and reply language',
  'Permetti di cercare sul web nelle chat (Claude e Codex)': 'Allow web search in chats (Claude and Codex)',
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
  'Disposizione automatica': 'Automatic layout', 'Strumenti di Claude per la visione d\'insieme': 'Claude tools for the big picture',
  'Annulla (Ctrl+Z)': 'Undo (Ctrl+Z)', 'Ripeti (Ctrl+Shift+Z)': 'Redo (Ctrl+Shift+Z)', 'Esporta': 'Export',
  'La rotella fa zoom. Clic per farle scorrere la vista (zoom con Ctrl+rotella)': 'The wheel zooms. Click to make it pan instead (zoom with Ctrl+wheel)',
  'La rotella scorre la vista, Ctrl+rotella o pizzico per lo zoom. Clic per cambiare': 'The wheel pans the view, Ctrl+wheel or pinch to zoom. Click to switch',
  'Riduci': 'Zoom out', 'Adatta alla vista (Shift+1)': 'Fit to view (Shift+1)', 'Ingrandisci': 'Zoom in', 'Cambia mappa': 'Change map',
  'Mappa precedente (Q)': 'Previous map (Q)', 'Mappa successiva (E)': 'Next map (E)', 'Tutte le mappe': 'All maps',
  'Torna alla mappa (Esc)': 'Back to the map (Esc)', 'Ruota a sinistra (←)': 'Rotate left (←)', 'Ruota a destra (→)': 'Rotate right (→)',
  'Rigenera l\'icona': 'Regenerate the icon', 'Titolo della chat': 'Chat title', 'Modello che risponde in questa chat': 'Model answering in this chat',
  'Espandi a tutto schermo': 'Expand to full screen', 'Chiudi (Esc)': 'Close (Esc)', 'Nuova chat che continua da questa': 'New chat that continues from this one',
  'Invia a Claude i riassunti delle chat collegate con frecce': 'Send the summaries of chats linked by arrows', 'Elimina la chat': 'Delete the chat',
  'Tipo di icona': 'Icon type', 'Testo del badge': 'Badge text', 'Arrotondato': 'Rounded', 'Cerchio': 'Circle', 'Quadrato': 'Square',
  'Esagono': 'Hexagon', 'Rombo': 'Diamond', 'Colore personalizzato': 'Custom color', 'La mia prima mappa': 'My first map',
  'Scrivi a Claude. Invio per inviare, Shift+Invio per andare a capo.': 'Write to Claude. Enter to send, Shift+Enter for a new line.',
  'Scrivi a ChatGPT. Invio per inviare, Shift+Invio per andare a capo.': 'Write to ChatGPT. Enter to send, Shift+Enter for a new line.',
  'Torna alla mappa (Esc) ': 'Back to the map (Esc)',
  // ---- testi dinamici ----
  'Salvataggio non riuscito: {msg}': 'Save failed: {msg}',
  '1 collegamento suggerito da Claude. Passa sopra l\'etichetta per leggere il motivo.': '1 link suggested by Claude. Hover the label to read why.',
  '{n} collegamenti suggeriti da Claude. Passa sopra un\'etichetta per leggere il motivo.': '{n} links suggested by Claude. Hover a label to read why.',
  'Vista non disponibile: {msg}': 'Overview unavailable: {msg}',
  'Eliminare la chat "{title}"?': 'Delete the chat "{title}"?', 'Eliminare {n} chat?': 'Delete {n} chats?',
  'Le icone spariscono dalla mappa e dall\'elenco, e tutti i messaggi vengono cancellati. L\'operazione non si può annullare.':
    'The icons disappear from the map and the list, and all messages are deleted. This can\'t be undone.',
  'Elimina chat': 'Delete chat', 'Elimina {n} chat': 'Delete {n} chats', '"{title}" non eliminata: {msg}': '"{title}" not deleted: {msg}',
  'Chat eliminata': 'Chat deleted', 'Chat eliminate': 'Chats deleted',
  'Le chat selezionate sono vuote: scrivi almeno un messaggio': 'The selected chats are empty: write at least one message',
  'Claude disegna le icone ({i} di {n})…': 'Drawing icons ({i} of {n})…', 'Icone ridisegnate': 'Icons redrawn',
  'Seleziona almeno due elementi da unire': 'Select at least two items to merge', 'Preparo il contesto con i riassunti…': 'Preparing the context from the summaries…',
  'confluisce in': 'merges into', 'dirama': 'branches', 'La mappa è vuota': 'The map is empty',
  'Claude sintetizza la selezione…': 'Summarizing the selection…', 'Claude sintetizza la mappa…': 'Summarizing the map…',
  'Claude cerca collegamenti tra le idee…': 'Looking for links between ideas…', 'Nessun nuovo collegamento suggerito': 'No new links suggested',
  'Claude raggruppa le idee per temi…': 'Grouping ideas by theme…', 'Mappa non caricata: {msg}': 'Map not loaded: {msg}',
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
  'Claude sta rispondendo…': 'Claude is replying…', 'ChatGPT sta rispondendo…': 'ChatGPT is replying…',
  'ChatGPT (Codex): installazione del supporto in corso…': 'ChatGPT (Codex): installing support…',
  'ChatGPT (Codex): non risulti collegato. Apri l\'app Codex e accedi con il tuo account ChatGPT.': 'ChatGPT (Codex): not signed in. Open the Codex app and sign in with your ChatGPT account.',
  'ChatGPT (Codex): pronto, collegato al tuo account ChatGPT.': 'ChatGPT (Codex): ready, signed in with your ChatGPT account.',
  'ChatGPT (Codex): collegato. Il supporto verrà installato al primo utilizzo (serve qualche secondo).': 'ChatGPT (Codex): signed in. Support will be installed on first use (takes a few seconds).',
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
  'Fai ridisegnare le icone a Claude': 'Have Claude redraw the icons',
  'Allinea a sinistra (Alt+A)': 'Align left (Alt+A)', 'Centra in orizzontale (Alt+H)': 'Center horizontally (Alt+H)', 'Allinea a destra (Alt+D)': 'Align right (Alt+D)',
  'Allinea in alto (Alt+W)': 'Align top (Alt+W)', 'Centra in verticale (Alt+V)': 'Center vertically (Alt+V)', 'Allinea in basso (Alt+S)': 'Align bottom (Alt+S)',
  'Distribuisci in orizzontale (Alt+Shift+H)': 'Distribute horizontally (Alt+Shift+H)', 'Distribuisci in verticale (Alt+Shift+V)': 'Distribute vertically (Alt+Shift+V)',
  '↗ Collega': '↗ Link', 'Collega in ordine di selezione (L)': 'Link in selection order (L)', '✦ Unisci': '✦ Merge', 'Unisci in una nuova chat': 'Merge into a new chat',
  '✦ Sintesi': '✦ Summary', 'Sintesi della selezione': 'Summary of the selection', 'Seleziona contenuto': 'Select contents',
  'Seleziona gli elementi nel riquadro': 'Select the items in the frame', 'Elimina le chat selezionate (Canc)': 'Delete the selected chats (Delete)',
  'Doppio clic per scrivere': 'Double-click to write', 'Chat eliminata ': 'Deleted chat', 'Riquadro ': 'Frame', 'Tema': 'Theme',
  // pannello chat
  'Senza titolo': 'Untitled', 'Claude sta riassumendo la chat…': 'Summarizing the chat…',
  'Scrivi almeno un messaggio prima di creare l\'icona': 'Write at least one message before creating the icon',
  'Claude disegna l\'icona…': 'Drawing the icon…', 'Genero l\'immagine…': 'Generating the image…', 'Riassumo la chat. ': 'Summarizing the chat. ',
  'Icona non creata: {msg}': 'Icon not created: {msg}', 'Risposta non riuscita: {msg}': 'Reply failed: {msg}',
  'Da dove partiamo?': 'Where do we start?',
  'Scrivi la prima idea. Dopo la risposta Claude dà un titolo alla chat e ne disegna l\'icona.': 'Write your first idea. After the reply, the chat gets a title and an icon.',
  '— dalla chat di partenza —': '— from the original chat —', '— nuova diramazione —': '— new branch —',
  'Non ancora disponibile: arriva dopo il primo scambio.': 'Not available yet: it arrives after the first exchange.',
  'Ultimo errore icona: {msg}': 'Last icon error: {msg}',
  'Risponde {who}. Il modello si sceglie prima del primo messaggio.': '{who} is answering. The model is chosen before the first message.',
  'Risponde {who}. Clic per passare a {other}.': '{who} is answering. Click to switch to {other}.',
  'Torna alla mappa (Esc)·': 'Back to the map (Esc)', '(interrotto)': '(stopped)',
};
