# Plugin Figma «DSSA → Compositore»

In Figma si fanno contenuti e impaginazione; nel compositore si decide il movimento.
Il plugin legge le tavole selezionate e le passa al compositore come livelli animabili.
Rinviando una tavola modificata, testi, immagini, posizioni e colori si aggiornano e
le animazioni impostate nel compositore restano.

## Installazione (una volta)

1. Figma **desktop** → menu *Plugins → Development → Import plugin from manifest…*
2. Scegli `figma-plugin/manifest.json` di questo repository.
3. Avvia il compositore: `npm run dev` (indirizzo http://localhost:5173) e aprilo nel browser.

## Uso

1. In Figma seleziona una o più tavole (frame). Più tavole diventano le slide di una serie.
2. *Plugins → Development → DSSA → Compositore* → **Invia al compositore**.
3. Nel compositore la tavola si apre come composizione a livelli, con un’animazione di partenza
   in ordine di lettura. Regola ingressi e tempi con la timeline e i pannelli.
4. Cambi qualcosa in Figma? Rinvia: il compositore aggiorna i contenuti e tiene le animazioni.
   Se il compositore non è avviato, **Scarica .dssa.json** e trascina il file nel compositore
   (pulsante «Figma»), oppure esporta da riga di comando:
   `npm run render -- --project tavola.dssa.json --out video.mp4`.

## Come vengono letti i livelli

Si leggono i livelli al primo livello della tavola, dal basso verso l’alto.

| In Figma | Nel compositore |
| --- | --- |
| Istanza di un simbolo (nome del componente con «Simbolo»/«Simboli» e il nome dell’ambito) | Simbolo nativo, animato parte per parte; versione piatta, opaca o iridescente dal nome della variante |
| Marchio (componente con «Marchio», «Logotipo», «Monogramma», «Lockup», o chiamato «DSSA») | Marchio nativo, le righe salgono dalla maschera |
| Etichetta di serie («Etichetta») | Etichetta nativa, con il suo testo |
| Freccia («Freccia») | Freccia nativa che si traccia |
| Testo | Testo nativo: stesso corpo, interlinea, spaziatura, larghezza, allineamento, colore; neretto mantenuto |
| Tutto il resto (foto, gruppi, illustrazioni, pulsanti) | Immagine esportata, animata in blocco |
| Fondo pieno della tavola | Colore del fondo |
| Fondo con immagine o sfumatura | Immagine di fondo, ferma |

Ogni elemento riconosciuto porta con sé anche la sua immagine esportata: nel compositore,
«Usa la grafica esportata da Figma» la mostra identica a Figma (animata in blocco) se il disegno
nativo non coincide.

## Indicazioni nei nomi (facoltative)

Tra parentesi quadre nel nome del livello, valgono al primo invio:

- ingresso: `[maschera]`, `[sali]`, `[parole]`, `[lettere]`, `[dissolvenza]`, `[scala]`, `[tendina]`,
  `[assembla]`, `[ruota]`, `[scorre]`, `[cresce]`, `[fermo]`
- tempi in secondi: `[inizio=1.2]`, `[durata=0.8]`, `[esce=4]`

Esempio: «Titolo [parole] [inizio=0.4]».

## Limiti

- Effetti di Figma (ombre, sfocature, fusioni) restano solo nella grafica esportata.
- Testi ruotati arrivano dritti; caratteri diversi da Basier Circle e Wotfard sono resi con Basier Circle.
- Le posizioni vengono sempre da Figma: gli spostamenti fatti nel compositore su un livello
  arrivato da Figma si perdono al nuovo invio (i tempi e gli effetti invece restano).
- Il riconoscimento usa i nomi dei componenti: se nel file hanno nomi diversi, il plugin li
  esporta come immagini e lo segnala; i nomi si aggiungono in `code.js` (SYMBOL_RULES e regole vicine).
