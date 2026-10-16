# DSSA · Compositore

Compositore di animazioni per i social del corso DSSA (Design Sostenibile per il Sistema Alimentare),
costruito sulle regole del **Manuale della brand identity v1.2**. Funziona come Remotion — ogni
fotogramma è una funzione del numero del frame, quindi anteprima ed esportazione coincidono — ma è
una versione su misura: i modelli, i simboli, i colori e i controlli sono quelli dell'identità.

## Avvio

```bash
npm install
npm run dev          # apre il compositore su http://localhost:5173
```

Per l'esportazione MP4 nel browser serve **Chrome o Edge** (WebCodecs con H.264). Gli altri browser
esportano in VP9, non adatto a Instagram: in quel caso si usa la riga di comando.

## Caratteri

Basier Circle e Wotfard sono commerciali e non sono nel repository. Due modi per usarli:

- trascinarli nel pannello **Caratteri** (restano salvati nel browser);
- copiarli in `public/fonts/` (vedi `public/fonts/LEGGIMI.md`): valgono anche per la riga di comando.

Senza, l'anteprima usa Karla (sostituto documentato a p. 26-27) e il compositore lo segnala.

## Cosa contiene

**Composizioni del feed** (p. 57): Parola, Tratto, Ritratto, Duotono, Solo testo, Simbolo iridescente,
Finestra, Cifra; più Simbolo animato (copertine delle storie in evidenza, p. 56) e la copertina dei
caroselli LinkedIn (p. 58).

**Video e sequenze**: Apertura e chiusura con il marchio (logotipo, monogramma, lockup, p. 12-14),
I 7 ambiti in sequenza, Composizione di forme dal vocabolario (p. 35).

**Composizione libera**: livelli di simboli, forme, testi, marchio, etichetta, immagini, materia
iridescente e freccia, ognuno con il suo ingresso, la sua durata e la sua uscita.

**Ritocchi sui modelli**: ogni elemento di un modello (marchio ed etichetta, titolo, testi, simbolo,
fotografia, cifra, freccia…) si seleziona sull'anteprima e si trascina; la maniglia in basso a destra
lo scala, il pallino nel pannello «Elementi» lo nasconde. Le frecce spostano di 1 px (Maiusc 10 px),
Maiusc durante il trascinamento blocca la direzione, i bordi si agganciano ai margini sicuri e al centro
(Alt per sganciarli). I ritocchi si salvano nel progetto e valgono per il formato corrente: lo stesso
post può avere aggiustamenti diversi in versione Story o LinkedIn. Con le regole del manuale attive il
compositore avvisa se un testo esce dai margini sicuri o viene scalato fuori dalla scala tipografica.

**Serie e caroselli**: «+ Aggiungi una slide» trasforma il progetto in una serie. Le slide stanno in
una striscia sopra l'anteprima: si duplicano, si creano da qualsiasi modello, si riordinano, si
eliminano. Ogni slide ha i suoi testi, colori e ritocchi. Regole automatiche: numero nell'etichetta
(«Libro del mese · 2/5») e freccia o pulsante «avanti» su tutte le slide tranne l'ultima (p. 41).
Esportazioni della serie: **PNG carosello** (.zip, una immagine per slide, per Instagram),
**PDF LinkedIn** (una pagina per slide, p. 58), **Video della serie** (un MP4 con le slide in sequenza,
a taglio netto o in dissolvenza). L'anteprima passa da «Slide» a «Serie intera» per rivedere il video.

**Audio**: nel pannello «Audio» si carica una musica (MP3, WAV, M4A…). Sulla forma d'onda si
clicca il punto da cui far partire il video; si regolano volume, entrata e uscita in dissolvenza.
In anteprima la musica suona a tempo con i fotogrammi (anche saltando nella timeline o nella serie).
«Rileva» stima i battiti al minuto; con «Animazioni a tempo di musica» la pulsazione e l'onda dei
simboli e le rotazioni di 90° delle composizioni cadono sui battiti. La traccia entra nel MP4:
AAC dalla riga di comando e da Chrome/Edge che lo supportano, altrimenti Opus con avviso. Nel video
della serie la musica scorre continua su tutte le slide.

**Modelli della casa**: «+ Salva come modello» conserva il progetto (modello, testi, colori, tempi,
ritocchi di ogni formato, serie; fotografie e musica solo se richiesto) con nome, descrizione e
miniatura. I propri modelli restano nel browser: si aprono con un clic, si rinominano, si
sostituiscono con il progetto corrente, si eliminano, si esportano in .json. I **modelli della
squadra** sono i file .json in `public/libreria/` (vedi `public/libreria/LEGGIMI.md`): chi ne
aggiunge uno al repository lo rende disponibile a tutti. Ne sono inclusi sei di partenza (Open day,
Libro del mese, Sessione di laurea, I 7 ambiti, Chiusura dei video, Carosello a tre slide). Un modello
si esporta anche da riga di comando: `npm run render -- --project public/libreria/open-day-story.json`.

**Più formati in un clic**: «Più formati» apre un riepilogo con l'anteprima del progetto in ogni
formato, gli avvisi del manuale formato per formato e l'indicazione di dove ci sono ritocchi propri.
Si scelgono i formati (scorciatoie Instagram, LinkedIn, Tutti) e cosa esportare: video MP4,
immagine PNG e, per le serie, il carosello (PNG .zip per Instagram, PDF per LinkedIn). Tutto arriva
in un unico .zip.

**Annulla e ripeti**: le frecce ↶ ↷ in alto (o Ctrl/Cmd+Z e Ctrl/Cmd+Maiusc+Z) tornano indietro e
avanti tra le modifiche. Un trascinamento intero, una serie di spostamenti con le frecce o una
digitazione continua contano come un solo passo.

**Timeline**: sotto l'anteprima, una riga per elemento con la barra del suo ingresso, la linea di
permanenza e il segno dell'uscita. Le barre viola (elementi dei modelli) si trascinano per anticipare
o ritardare l'elemento; doppio clic per rimetterlo com'era; il ritardo si scrive anche nel pannello
«Elementi». Le barre fucsia (livelli) si spostano, si allungano dal bordo destro (durata
dell'ingresso) e hanno un segno nero da trascinare per farle uscire prima della fine. Le barre si
agganciano alla testina e agli inizi e alle fini delle altre (Alt per sganciarle); un clic sulla
timeline sposta la testina. I ritardi valgono per formato, come gli altri ritocchi.

**Elementi in più**: a ogni modello si possono aggiungere livelli (testo, simbolo, forma, marchio,
etichetta, immagine, materia iridescente, freccia) disegnati sopra la composizione. Nella composizione
libera i livelli si trascinano direttamente sull'anteprima.

**Formati**: Instagram post e carosello 1080 × 1350, Story e Reel 1080 × 1920, copertina del Reel,
quadrato; LinkedIn 4:5, quadrato, 16:9. Le guide mostrano margini (88 px) e zone dell'interfaccia
(250 px in alto e 340 in basso nelle Story; fascia 240-1680 della copertina Reel; 34 px tagliati
nella griglia 3:4 del profilo).

### Fedeltà al manuale

- **Simboli**: i sette simboli sono ricostruiti come primitive geometriche (cerchio, semicerchio,
  quarto, corona) misurate sui componenti riprodotti a p. 36; ogni parte si anima da sola e
  l'animazione finisce sempre sulla forma esatta. Versioni piatta, iridescente, opaca.
- **Colori**: palette sRGB (p. 20-21), colori derivati del duotono e velatura al 28% (p. 22, 33),
  testo bianco o nero secondo il fondo con i rapporti di contrasto di p. 24.
- **Tipografia**: scala DSSA/Titolo 124-80, Testo 46 e 38, Etichetta 30, Fonte 26 (p. 28), con
  scelta automatica del corpo del titolo per numero di battute.
- **Marchio ed etichetta**: logotipo alto 29 px a 88 px dal margine, etichetta a 0,86 x, lockup con
  interlinea 0,26 x, distanza 0,68 x, denominazione 0,47 x (p. 13, 16, 41).
- **Regole del manuale** (interruttore): attive, limitano le scelte alla palette e alle varianti
  previste; disattive, permettono colori liberi, rotazioni e corpi fuori scala. In entrambi i casi il
  pannello segnala ciò che si allontana dal manuale (contrasto, più di un simbolo, corpo sotto 26 px…).

## Esportazione da riga di comando

Usa Chromium senza interfaccia e ffmpeg (H.264 High, yuv420p, BT.709, faststart): stessa resa
dell'anteprima, qualità controllabile, utile per lotti e per i browser senza H.264.

```bash
npm run build
npm run render -- --list                                         # modelli disponibili
npm run render -- --project progetto.json --out video.mp4        # progetto salvato dal compositore
npm run render -- --composition cifra --format ig-story --out cifra-story.mp4
npm run render -- --project progetto.json --format li-portrait   # stesso progetto, formato LinkedIn
npm run render -- --project progetto.json --png 90 --out copertina.png
npm run render -- --project serie.json --out serie.mp4             # serie: tutte le slide in sequenza
npm run render -- --project serie.json --slide 2 --out slide2.mp4  # una sola slide
npm run render -- --project serie.json --carosello zip             # PNG del carosello (o pdf)
npm run render -- --project progetto.json --formati instagram --out esportazioni   # o linkedin, tutti
npm run render -- --project progetto.json --formati ig-post,li-landscape --png      # immagini fisse
npm run render -- --project serie.json --formati tutti --carosello                  # zip o pdf secondo la piattaforma
```

Opzioni: `--no-audio` (esporta senza musica), `--fps`, `--duration`, `--crf` (qualità, predefinito 16), `--props valori.json` (con
`--composition`), `--chrome` (usa Chrome installato). Richiede `ffmpeg` nel PATH e Chromium
(`npx playwright install chromium`) o Chrome.

## Struttura

```
src/brand/      identità: valori del manuale, simboli e forme, materia iridescente, marchio, duotono
src/engine/     motore: animazione, testo, caratteri, rendering, esportazione
src/templates/  modelli (feed, video, libera): ognuno dichiara i suoi campi e la sua funzione di disegno
src/ui/         pannello dei parametri generato dai campi
scripts/        esportazione da riga di comando
```

### Aggiungere un modello

Un modello è un oggetto `Composition` (`src/engine/types.ts`): un elenco di campi, da cui nasce il
pannello, e una funzione `render(ctx, f, props, env)` che disegna il fotogramma `f.frame`. Si registra
in `src/templates/index.ts`. `src/templates/common.ts` dà fondo, testata, freccia e ritmo comuni;
`src/brand/draw.ts` simboli, marchio, etichetta e duotono.

## Punti aperti

- I simboli iridescenti del file Figma sono immagini 3D: qui la materia è generata (shader) e
  richiama le raggiere e le sfumature di p. 23 senza riprodurle identiche.
- Il manuale non definisce regole per il video (p. 56): ritmi e transizioni sono proposte.
- I modelli LinkedIn completi non sono ancora nel file Figma (p. 58): la copertina segue la slide tipo.
