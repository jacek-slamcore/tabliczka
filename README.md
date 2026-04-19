# Tabliczka mnozenia

Prosta webowa apka do cwiczenia mnozenia i dzielenia. Static HTML/CSS/JS,
bez buildu, bez zaleznosci.

## Uruchom lokalnie

```bash
cd tabliczka
python3 -m http.server 8000
# otwarz http://localhost:8000
```

(Albo dowolny inny static server. Otwieranie `index.html` bezposrednio
przez `file://` tez zadziala — localStorage przetrwa reload.)

## Parametry sesji

- **Liczba zadan** — ile pytan per sesja (default 20).
- **Typ** — mnozenie, dzielenie, albo mix (default).
- **Czynnik min / max** — zakres czynnikow (default 2..15).
- **Iloczyn min / max** — zakres wyniku mnozenia / dzielnej (default 20..144).
- **Wyklucz trywialne** — odrzuca `x0`, `x1`, `x10` oraz pary gdzie oba
  czynniki sa `< 4` (np. `3×3`, `2×3`). Default: wlaczone.

Ustawienia trzymane w `localStorage` (klucz `tabliczka:settings`). Historia
ostatnich 10 sesji w `tabliczka:history`.

## Deploy na GitHub Pages

1. Utworz pusty repo na GitHub, np. `tabliczka`.
2. W katalogu `tabliczka/`:
   ```bash
   git init
   git add .
   git commit -m "Initial: tabliczka mnozenia"
   git branch -M main
   git remote add origin git@github.com:<twoj-user>/tabliczka.git
   git push -u origin main
   ```
3. W repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
   Branch: `main`, folder: `/ (root)`. Zapisz.
4. Po ~1 min apka dostepna pod: `https://<twoj-user>.github.io/tabliczka/`.

Plik `.nojekyll` w repo wylacza przetwarzanie Jekyll — GH Pages serwuje
pliki dokladnie tak jak sa.

## Smoke test w DevTools

W konsoli dostepny `window.tabliczka`:

```js
const s = window.tabliczka.DEFAULT_SETTINGS;
window.tabliczka.validPairs(s).length;             // ile unikalnych par
window.tabliczka.generateSession(s).slice(0, 5);   // podglad pytan
```

Zadna para z `generateSession` nie powinna byc trywialna (`2*3`, `3*4`,
`x*1`, `x*10`) gdy `wykluczTrywialne: true`.
