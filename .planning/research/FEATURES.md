# Feature Research: i18n / Localization (v1.3)

**Domain:** Per-player language selection in a real-time browser-based party game
**Researched:** 2026-04-17
**Confidence:** HIGH (language picker UX from Smashing Magazine + SimpleLocalize verified; localStorage persistence from MDN; Paraglide-JS from official docs; game-specific patterns from Shopify i18n engineering guide)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features players assume work. Missing any of these = localization feels broken or was not worth doing.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Language picker on the join screen | First touch-point: the only place to set preference before entering the game | LOW | 3 buttons (EN / CA / ES) rendered as a tab-strip or pill group. Tap-to-select. No dropdown needed for 3 options — dropdowns add an extra tap and a scroll gesture. |
| Language names in their native script | A Catalan speaker cannot read "Catalan"; they read "Català". A Spanish speaker reads "Español" not "Spanish". Displaying in the target language is a UX requirement, not a style preference. | LOW | Always render: English · Català · Español. Never use ISO codes alone (EN/CA/ES) — codes are ambiguous to non-developers. |
| Locale persists across page refreshes | Players may accidentally close the tab or reload. Re-asking language every session = frustrating. | LOW | Write chosen locale to `localStorage` under a stable key (e.g. `octapp_locale`). Read on app init before rendering. If missing, default to `en`. No server round-trip needed. |
| All static UI strings rendered in the chosen locale | The entire point of the feature. Any hardcoded string visible after locale selection = regression. Covers all views: join, groom, party/group, admin dashboard, admin setup. | MEDIUM | Requires extracting every string into a message catalog. The main effort of the milestone. |
| English fallback for untranslated strings | If a string is missing in CA or ES, the user sees English rather than a raw key. Silent, not broken. | LOW | All i18n libraries support fallback locale natively. Configure once, apply globally. Never expose raw message keys (e.g. `game.phase.trivia.title`) to players. |
| Locale is per-device, not broadcast | Each player sees their own language. Other players are unaffected. Locale is purely client-side state. | LOW | Do NOT send locale over WebSocket. Do NOT add locale to the server game state. Store in `localStorage` only. This is the architecturally correct design given the per-device nature of the feature. |

### Differentiators (Nice-to-Have, Not Expected)

Features that add polish. None are blocking for v1.3 to feel complete.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Language switcher accessible from within the game (not just join screen) | A player who picked the wrong language mid-game can self-correct without rejoining | LOW | A small globe icon or gear menu accessible from the party/group view header. Writes to `localStorage`, re-renders reactively. Very low effort if locale is a Svelte store. |
| Locale-aware pluralization for scores and timers | "1 punt" vs "2 punts" (Catalan), "1 punto" vs "2 puntos" (Spanish) — correct grammar feels polished | MEDIUM | ICU MessageFormat syntax via Paraglide-JS supports `{count, plural, one{...} other{...}}`. Required only for strings with variable counts. Affects: token counts, timer "second/seconds", score announcements. |
| Browser language auto-detection as default | If `localStorage` has no preference, check `navigator.language` and pre-select the closest match (e.g. `ca` → CA, `es` → ES, `*` → EN) | LOW | One-liner: `navigator.language.startsWith('ca') ? 'ca' : navigator.language.startsWith('es') ? 'es' : 'en'`. Makes first-load feel smart. Do not auto-navigate — always let the user confirm. |
| Visual feedback on language change (brief flash or label update) | Confirms to the player that the tap registered — avoids double-tapping on slow-load moments | LOW | The native Svelte reactive re-render is usually sufficient. A brief transition on the active pill (0.15s scale or color change) is all that is needed. |

### Anti-Features (Complexity Traps for a Simple Party Game)

Features that seem reasonable but would create unjustified complexity for a one-time event app.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| URL-based locale routing (`/ca/join`, `/es/party`) | Standard i18n pattern; Paraglide-JS is designed around it | SSR is disabled on all game routes. URL routing adds path-management complexity, redirect logic, and conflicts with the existing join-code + WebSocket flow. Gains zero value for a single-session app. | Store locale in `localStorage` only. Paraglide-JS supports `localStorage` strategy. Keep URL paths unchanged. |
| Translating user-authored content (trivia questions, scavenger clues, rewards) | "Wouldn't it be nicer if content was also translated?" | User-authored content is configured once per event in a single language — translating it would require admin translation UI, per-locale content storage, and WebSocket state changes. Massive scope for zero real benefit. | Explicitly document: only static UI strings are translated. User content is single-language. Admin is told this at setup time. |
| Flag icons as locale identifiers | Flags are visually obvious; easy to implement | Flags represent countries, not languages. Spanish is spoken in 20+ countries. Catalan has no country flag. Flags offend or confuse subsets of users. Current UX consensus (2025) explicitly discourages flags. | Native language names in text: "English · Català · Español". |
| Auto-translate user content via API | "Machine translation could handle the trivia questions" | Requires an external API, credentials, network calls during gameplay, error handling, and translation quality review. Breaks the scoped design of locale as client-side only. | Out of scope. User-authored content stays in the author's language. |
| Per-locale UI layout variants | "The admin wants to check that CA translations fit the layout" | For 3 languages across EN/CA/ES, text expansion is at most ~20-30%. Tailwind's flex/auto layout already handles this. Maintaining locale-specific layout variants = unnecessary file count. | Design all UI with CSS flex/auto sizing from the start. Avoid fixed pixel widths on text containers. |
| Cookie-based locale with SSR hydration | "Proper i18n uses HTTP Accept-Language + cookies" | SvelteKit SSR is disabled on all game routes (confirmed v1.0 architectural decision). Cookie/SSR hydration complexity gains nothing. The app hydrates client-side; localStorage is the correct and simpler choice. | `localStorage` only. Read once on mount. Reactively drive a Svelte store. |
| Translation management platform / external CMS | "Crowdin / Phrase / Localazy would scale better" | The message catalog has ~100-200 strings across 3 languages. All translations are done once before the event by the developer. A translation platform adds login, export/import workflow, and tooling complexity with no practical benefit at this scale. | JSON files in the repo. One file per locale (`en.json`, `ca.json`, `es.json`). Translate directly in the editor. |

---

## Feature Dependencies

```
Language picker (join screen)
    └──writes──> localStorage["octapp_locale"]
    └──updates──> locale Svelte store

Locale Svelte store
    └──drives──> all UI string rendering (via i18n library)
    └──read on mount by all game views (join, groom, party, admin)
    └──no WebSocket dependency

Static string catalog (en/ca/es JSON)
    └──consumed by──> i18n library
    └──covers──> all views (join, groom, party/group, admin dashboard, admin setup)
    └──fallback──> en for any missing ca/es key

localStorage read (app init)
    └──sets initial locale for──> locale store
    └──fallback to──> navigator.language detection → en

Locale store (reactive)
    └──re-renders──> all translated strings reactively on change
    └──no page reload required
    └──no WebSocket message emitted
```

### Dependency Notes

- **Locale is fully client-side:** No server-side changes required. The WebSocket state model, game phases, and real-time sync are untouched.
- **All views depend on the locale store:** Join wizard, groom view, party/group view, admin dashboard, admin setup — all must import the locale store and use translated strings. This is a broad surface change (many files) but uniform in pattern.
- **User-authored content (chapters, trivia, clues, rewards) has no dependency** on the locale system — it renders as raw strings, unchanged.
- **Paraglide-JS strategy conflict to avoid:** If using Paraglide-JS with the `localStorage` strategy, disable the `url` strategy entirely to prevent it from trying to parse locale from path segments. The strategy array should be: `["localStorage", "baseLocale"]`.

---

## MVP Definition

### Launch With (v1.3)

Minimum viable product — what is needed for the localization feature to feel complete and shippable.

- [ ] i18n library installed and configured with `en` / `ca` / `es` locales and English fallback
- [ ] Language picker on the join screen — 3 pill/tab buttons: "English · Català · Español"
- [ ] Locale written to `localStorage` on selection and read on mount
- [ ] All static strings extracted from all views into message catalog (en/ca/es JSON)
- [ ] All views render strings from the message catalog (no hardcoded strings remaining)
- [ ] English fallback verified: no raw keys visible if a ca/es string is missing

### Add After Validation

- [ ] In-game language switcher accessible from party/group view — add if any player reports being stuck in the wrong language
- [ ] Browser `navigator.language` auto-detection as default — low effort, feels polished, add in same PR as picker

### Future Consideration (v2+)

- [ ] Locale-aware pluralization for score/token strings — only worth adding if the app runs a second event with higher presentation standards
- [ ] Locale-aware number formatting — not relevant for this app; scores are single-digit counts

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Language picker (join screen, 3 options) | HIGH | LOW | P1 |
| Locale persisted in localStorage | HIGH | LOW | P1 |
| All static strings extracted + translated | HIGH | MEDIUM (broad surface) | P1 |
| English fallback for missing keys | HIGH | LOW (library default) | P1 |
| Locale is per-device / not broadcast | HIGH (correctness) | LOW | P1 |
| Native language name display | MEDIUM | LOW | P1 |
| navigator.language auto-detect | MEDIUM | LOW | P2 |
| In-game language switcher | LOW | LOW | P2 |
| Locale-aware pluralization | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1.3 to be considered done
- P2: Should have — add in same milestone if low-effort
- P3: Nice to have — defer to a hypothetical v1.4+

---

## Game-Specific Localization Patterns

These are specific to the existing minigame and overlay mechanics, which the generic i18n literature does not cover.

### Countdown Timers

Timers display as numbers (15, 14, 13…). Numbers are language-neutral — do not localize digit rendering. The label around the timer ("seconds remaining", if any) should be translated. Currently the trivia timer is a radial SVG with no text label — no localization needed for the visual component.

**Pattern:** Localize the surrounding context label, not the numeral itself.

### Score and Token Announcements

Strings like "You earned 20 tokens" or "Groom lost 10 points" include variable counts. For EN, a simple `{count} tokens` interpolation is sufficient. For CA/ES, pluralization may apply:
- "1 punt guanyat" vs "2 punts guanyats" (Catalan)
- "1 punto ganado" vs "2 puntos ganados" (Spanish)

For v1.3 MVP: use `{count} token(s)` or "{count} punts" — grammatically informal but acceptable for a party game. Perfect grammar is a differentiator, not table stakes.

**Pattern:** Keep interpolation simple. Avoid sentence construction that requires grammatical agreement on variable words. Translate the whole phrase as a unit: `"earned_tokens": "{count} tokens guanyats"`.

### Minigame Overlays (Win/Loss/Power-Up/Sabotage)

Overlays are full-screen CSS-class-toggled elements (confirmed pattern from PROJECT.md). They contain short declarative strings ("Correct!", "Time's Up!", "Sabotage!", emoji-storm label). These are ideal for translation — short, unambiguous, no interpolation needed.

**Pattern:** All overlay strings are table stakes for translation. They are high-visibility and highly noticeable if left in English.

### Chapter Transition / Recap Cards

Recap cards appear on chapter unlock and may contain structured text (chapter name, reward preview label, score delta). Chapter names are user-authored content — do NOT translate them. Only the structural chrome labels (e.g. "Chapter Complete", "Your reward:", "Points earned:") should be in the catalog.

**Pattern:** Translate structural labels; leave user-authored chapter titles, reward names, and trivia questions as-is.

### Admin Dashboard and Setup

Admin is a single person (the event host) who presumably speaks one language. However, localizing the admin UI is explicitly in scope for v1.3 per PROJECT.md. Admin uses the same join flow — their locale preference is set on the join screen the same way.

**Pattern:** Admin strings go in the same catalog. No special admin-only locale mechanism needed.

---

## Mobile UX Considerations

All players use the app on mobile browsers (iOS Safari / Android Chrome — confirmed constraint). The language picker is specifically on the join screen, which is the first thing every player sees.

**Picker layout:** 3 inline pill/tab buttons centered horizontally. Each is at minimum 44×44px tappable area (iOS HIG minimum). All three options visible simultaneously — no dropdown, no scroll, no extra tap required. This is optimal for exactly 3 choices.

**Placement on join screen:** Picker should be visible without scrolling on a standard phone viewport (375px width, ~700px height). Position near the top or immediately below the game title/logo — before the name input or join code entry. Players must see it before they commit to joining.

**Active state:** The selected locale pill gets a distinct fill color (not just an outline change — outline-only is not finger-distinguishable on mobile). The other two pills are ghost/outline style.

**Persistence feedback:** No toast or flash needed. The reactive re-render of the page strings in the new language is itself the confirmation. If strings visibly change language on tap, the user knows it worked.

**Text expansion:** CA and ES strings are typically 10-30% longer than EN. All text containers must use CSS auto-sizing (no fixed pixel widths on button labels or UI strings). This is already aligned with the app's Tailwind v4 CSS-first approach.

---

## Sources

- Language selector UX best practices: https://www.smashingmagazine.com/2022/05/designing-better-language-selector/
- Flags in language selectors (why to avoid): https://simplelocalize.io/blog/posts/flags-as-language-in-language-selector/
- Language selector best practices 10 tips: https://simplelocalize.io/blog/posts/language-selector-best-practices/
- Paraglide-JS SvelteKit integration + localStorage strategy: https://inlang.com/m/gerre34r/library-inlang-paraglideJs/sveltekit
- i18n best practices for frontend (Shopify Engineering): https://shopify.engineering/internationalization-i18n-best-practices-front-end-developers
- Pluralization complexity across languages: https://phrase.com/blog/posts/internationalization-beyond-code-a-developers-guide-to-real-world-language-challenges/
- localStorage for locale persistence: https://app.studyraid.com/en/read/15039/520172/persisting-language-preference
- i18n technical guide (SimpleLocalize): https://simplelocalize.io/blog/posts/internationalization-guide-software-localization/

---

*Feature research for: i18n / localization — octapp v1.3*
*Researched: 2026-04-17*
