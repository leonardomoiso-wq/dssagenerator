# Modelli della squadra

Ogni file `.json` di questa cartella compare nel compositore, nella colonna di sinistra, sotto
«Modelli della casa · Della squadra». Cliccandolo si apre come progetto di partenza.

Per aggiungere un modello:

1. nel compositore salva il progetto con «+ Salva come modello»;
2. dal menu ⋯ del modello scegli «Esporta il file (per la squadra)»;
3. copia il file qui e pubblicalo nel repository (commit e push).

Il nome del file non conta: il compositore mostra il nome scritto nel modello. Per togliere un
modello si elimina il file. Meglio salvare i modelli senza fotografie: restano leggeri e non
diffondono immagini di persone senza liberatoria (manuale, p. 60).

Un modello si esporta anche da riga di comando, come un progetto:

    npm run render -- --project public/libreria/open-day-story.json --formati instagram
