# Tabliczka mnożenia — quiz

Prosta webowa apka do ćwiczenia mnożenia i dzielenia. Static HTML/CSS/JS,
bez buildu, bez zależności.

## Uruchom lokalnie

```bash
cd tabliczka
python3 -m http.server 8000
# otwórz http://localhost:8000
```

(Albo dowolny inny static server. Otwieranie `index.html` bezpośrednio
przez `file://` też zadziała — localStorage przetrwa reload.)

## Parametry sesji

- **Liczba zadań** — ile pytań per sesja (default 10).
- **Typ** — mnożenie, dzielenie, albo mix (default).
- **Czynnik min / max** — zakres czynników (default 2..10).
- **Iloczyn min / max** — zakres wyniku mnożenia / dzielnej (default 20..100).
- **Wyklucz trywialne** — odrzuca `×0`, `×1`, `×10` oraz pary gdzie oba
  czynniki są `< 4` (np. `3×3`, `2×3`). Default: włączone.

Ustawienia trzymane w `localStorage` (klucz `tabliczka:settings`). Historia
ostatnich 10 sesji w `tabliczka:history`.

## Deploy na GitHub Pages

1. Utwórz pusty repo na GitHub, np. `tabliczka`.
2. W katalogu `tabliczka/`:
   ```bash
   git init
   git add .
   git commit -m "Initial: tabliczka mnożenia"
   git branch -M main
   git remote add origin git@github.com:<twoj-user>/tabliczka.git
   git push -u origin main
   ```
3. W repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
   Branch: `main`, folder: `/ (root)`. Zapisz.
4. Po ~1 min apka dostępna pod: `https://<twoj-user>.github.io/tabliczka/`.

Plik `.nojekyll` w repo wyłącza przetwarzanie Jekyll — GH Pages serwuje
pliki dokładnie tak jak są.

## Smoke test w DevTools

W konsoli dostępny `window.tabliczka`:

```js
const s = window.tabliczka.DEFAULT_SETTINGS;
window.tabliczka.validPairs(s).length;             // ile unikalnych par
window.tabliczka.generateSession(s).slice(0, 5);   // podgląd pytań
```

Żadna para z `generateSession` nie powinna być trywialna (`2×3`, `3×4`,
`x×1`, `x×10`) gdy `wykluczTrywialne: true`.
